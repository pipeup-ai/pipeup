// pipeup watch / pipeup comments: the live link between a page shown from this computer and an agent on it.
// Everything stays on this computer: the server listens on 127.0.0.1 only, and answers only the page it serves.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";

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

/** The page for the browser: its own html tag, plus the link's address and the agent it lists, nothing else changed. */
export function served(html, { base, agent, key, file }) {
  return html.replace(/<html\b([^>]*)>/i, (_, rest) => {
    let tag = rest;
    const listed = /\sdata-pipeup-agents\s*=\s*"([^"]*)"/i.exec(tag);
    if (listed) tag = tag.replace(listed[0], ` data-pipeup-agents="${attr(`${listed[1]} ${key}`.trim())}"`);
    else tag += ` data-pipeup-agents="${key}"`;
    tag += ` data-pipeup-link="${base}" data-pipeup-link-agent="${attr(agent)}" data-pipeup-link-file="${attr(file)}"`;
    return `<html${tag}>`;
  });
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
      if (target === file) bytes = Buffer.from(served(bytes.toString("utf8"), { base, agent, key, file }));
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
