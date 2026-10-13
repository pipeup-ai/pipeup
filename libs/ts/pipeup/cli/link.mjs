// pipeup watch / pipeup comments: the live link between a page shown from this computer and an agent on it.
// Everything stays on this computer: the server listens on 127.0.0.1 only, and answers only the page it serves.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The agents add-on that ships with this install; `watch` serves it to the pages that need it. */
const ADDON_FILE = fileURLToPath(new URL("../dist/pipeup.agents.js", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};
const MAX_BODY = 8 * 1024 * 1024;
const attr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The page for the browser: its own html tag, plus the link's address and the agent it lists, and the agents add-on when it needs one. */
export function served(html, { base, agent, key, file, addon = false }) {
  const out = html.replace(/<html\b([^>]*)>/i, (_, rest) => {
    let tag = rest;
    const listed = /\sdata-pipeup-agents\s*=\s*"([^"]*)"/i.exec(tag);
    if (listed) tag = tag.replace(listed[0], ` data-pipeup-agents="${attr(`${listed[1]} ${key}`.trim())}"`);
    else tag += ` data-pipeup-agents="${key}"`;
    tag += ` data-pipeup-link="${base}" data-pipeup-link-agent="${attr(agent)}" data-pipeup-link-file="${attr(file)}"`;
    return `<html${tag}>`;
  });
  if (!addon) return out;
  // After the page's own scripts: an add-on registers in any order. The page's file on disk is not touched.
  const tag = `<script src="${base}/agents.js"></script>`;
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, () => `${tag}</body>`) : out + tag;
}

/** Which of Pipeup's agent support a version has: before 0.6 none, 0.6.x built in, 0.7 and later in the agents add-on. */
function byVersion(v) {
  const m = /^(\d+)\.(\d+)\.\d+/.exec(v);
  if (!m) return null;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > 0 || minor >= 7 ? "addon" : minor === 6 ? "builtin" : "old";
}

/** The same, read from a Pipeup script's own text: it carries the names of what it supports. */
function bySignature(text) {
  if (!text.includes("pipeup-root")) return null;
  if (text.includes("pipeupReplies")) return "builtin";
  return text.includes("listnote") ? "addon" : "old";
}

/**
 * What the page's Pipeup can do for an agent, found without running the page: "old" (before 0.6, can't take an
 * agent), "builtin" (0.6.x, agent support is part of it), "addon" (0.7 or later: the agents add-on serves an agent),
 * or "unknown" (a floating address, or no Pipeup script to read). `loaded` says the page already includes the add-on.
 */
export async function pageSupport(html, dir) {
  const result = { support: "unknown", version: "", loaded: false };
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (/agents(\.min)?\.js|@pipeup\/agents/i.test(src)) result.loaded = true;
    const named = /pipeup(?:@|-)(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/.exec(src);
    if (named && result.support === "unknown") {
      result.support = byVersion(named[1]) ?? "unknown";
      result.version = named[1];
      continue;
    }
    if (result.support !== "unknown" || /^(https?:)?\/\//i.test(src)) continue;
    try {
      const path = /^file:/i.test(src)
        ? fileURLToPath(src.split(/[?#]/)[0])
        : resolve(dir, decodeURIComponent(src.split(/[?#]/)[0]));
      result.support = bySignature(await readFile(path, "utf8")) ?? "unknown";
    } catch {
      // a script that can't be read says nothing about Pipeup
    }
  }
  // A Pipeup carried inside the page itself.
  if (result.support === "unknown") result.support = bySignature(html) ?? "unknown";
  return result;
}

/** Starts the link for a page file. Resolves to { url, close }. */
export async function watch({ page, agent, key, port = 0, log = console.log }) {
  const file = resolve(page);
  const dir = dirname(file);
  const name = basename(file);
  const base = `/__pipeup/${randomBytes(18).toString("base64url")}`;
  const sidecar = file.replace(/\.[^./\\]*$/, "") + ".comments.json";
  let origin = "";
  let host = "";

  // Which Pipeup the page uses decides whether the agents add-on is added to what it shows.
  const found = await pageSupport(await readFile(file, "utf8"), dir);
  if (found.support === "old")
    throw new Error(
      `this page uses ${found.version ? `Pipeup ${found.version}` : "a Pipeup older than 0.6"}, which can't take an agent. Use Pipeup 0.6 or later (pin an exact version) and run this again`,
    );
  const addon = found.support !== "builtin" && !found.loaded;
  let addonCode = "";
  if (addon) {
    try {
      addonCode = await readFile(ADDON_FILE, "utf8");
    } catch {
      throw new Error("the agents add-on isn't in this install of pipeup (dist/pipeup.agents.js is missing)");
    }
  }

  const send = (res, status, body = "", type = "text/plain; charset=utf-8") => {
    res.writeHead(status, {
      "content-type": type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(body);
  };

  const server = createServer(async (req, res) => {
    try {
      // Only this computer's own address: a name that points here from another site is refused.
      if (req.headers.host !== host) return send(res, 403, "wrong host");
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith("/__pipeup/")) {
        if (addon && url.pathname === `${base}/agents.js` && req.method === "GET")
          return send(res, 200, addonCode, TYPES[".js"]);
        if (url.pathname !== `${base}/comments` || req.method !== "POST") return send(res, 404, "not found");
        if (req.headers.origin !== origin) return send(res, 403, "wrong origin");
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > MAX_BODY) return send(res, 413, "too big");
          chunks.push(c);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return send(res, 400, "not json");
        }
        if (body?.v !== 1 || !body.open || !body.all) return send(res, 400, "not a comments snapshot");
        const tmp = `${sidecar}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(body));
        await rename(tmp, sidecar);
        log(`Shared ${body.open.threads.length} open comment${body.open.threads.length === 1 ? "" : "s"}.`);
        return send(res, 204);
      }
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed");
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = `/${name}`;
      const target = resolve(join(dir, path));
      if (target !== dir && !target.startsWith(dir + sep)) return send(res, 404, "not found");
      let bytes;
      try {
        bytes = await readFile(target);
      } catch {
        return send(res, 404, "not found");
      }
      if (target === file)
        bytes = Buffer.from(served(bytes.toString("utf8"), { base, agent, key, file, addon }));
      send(
        res,
        200,
        req.method === "HEAD" ? "" : bytes,
        TYPES[extname(target).toLowerCase()] ?? "application/octet-stream",
      );
    } catch {
      send(res, 500, "error");
    }
  });
  await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
  const { port: bound } = server.address();
  origin = `http://127.0.0.1:${bound}`;
  host = `127.0.0.1:${bound}`;
  return {
    url: `${origin}/${encodeURIComponent(name)}`,
    sidecar,
    support: found.support,
    addon,
    close: () => new Promise((ok) => server.close(ok)),
  };
}

/** What `pipeup comments` prints: the shared comments, as Markdown or as data. */
export async function comments({ page, all = false, json = false }) {
  const sidecar = resolve(page).replace(/\.[^./\\]*$/, "") + ".comments.json";
  let shared;
  try {
    shared = JSON.parse(await readFile(sidecar, "utf8"));
  } catch {
    throw new Error(
      `nothing is shared for ${page} yet. Start the link (pipeup watch ${page}), open the page it prints, and switch on Share with my agent`,
    );
  }
  const view = all ? shared.all : shared.open;
  return json ? JSON.stringify({ at: shared.at, ...view }, null, 2) : view.markdown;
}
