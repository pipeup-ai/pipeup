// @pipeup/mailbox: the reference HTTP mailbox server (contract pm1, docs/design/addons.md section 7.7).
// Stores opaque, content-addressed batches. No dependencies.
import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BODY = 524288;
const PAGE_BYTES = 4 * 1024 * 1024;
const PAGE_BATCHES = 1000;
const CT = /^pu1\.[A-Za-z0-9_-]+$/;
const sha = (s) => createHash("sha256").update(s).digest();
const b64u = (b) => Buffer.from(b).toString("base64url");
const same = (a, b) => timingSafeEqual(sha(a), sha(b));

/**
 * @typedef {object} MailboxOptions
 * @property {string} [dataDir] where mailboxes are stored (one JSON-lines file each)
 * @property {boolean} [memory] keep everything in memory (tests)
 * @property {string} [createToken] when set, `POST <base>/m` needs `Authorization: Bearer <it>`
 * @property {boolean} [writeTokens] issue a write token per mailbox, required in POST bodies
 * @property {number} [maxMailboxBytes] default 64 MiB
 * @property {number} [maxBatches] default 100,000
 * @property {number} [keepDays] default 365, counted from the last write; 0 keeps for ever
 * @property {{post?: number, get?: number}} [rate] per network address per minute (60 / 600)
 * @property {boolean} [trustProxy] take the address from X-Forwarded-For (behind a TLS proxy)
 * @property {() => number} [now] clock in ms (tests)
 * @property {number} [pageBytes] page size limits (tests)
 * @property {number} [pageBatches]
 */

/**
 * @param {MailboxOptions} [options]
 * @returns {{listen(port: number, host?: string): Promise<{port: number}>, close(): Promise<void>, server: import("node:http").Server}}
 */
export function createMailboxServer(options = {}) {
  const o = options;
  const now = o.now ?? Date.now;
  const maxBytes = o.maxMailboxBytes ?? 64 * 1024 * 1024;
  const maxBatches = o.maxBatches ?? 100000;
  const keepDays = o.keepDays ?? 365;
  const limits = { POST: o.rate?.post ?? 60, GET: o.rate?.get ?? 600 };
  const pageBytes = o.pageBytes ?? PAGE_BYTES;
  const pageBatches = o.pageBatches ?? PAGE_BATCHES;
  const dir = o.memory ? null : (o.dataDir ?? "./data");
  if (dir) mkdirSync(dir, { recursive: true });
  /** @type {Map<string, any>} */
  const boxes = new Map();
  /** @type {Map<string, {start: number, n: number}>} */
  const hits = new Map();

  const expiry = (b) => (keepDays > 0 ? new Date(b.last + keepDays * 864e5).toISOString() : null);
  const drop = (id) => {
    boxes.delete(id);
    if (dir) for (const e of ["json", "jsonl"]) rmSync(join(dir, `${id}.${e}`), { force: true });
  };
  /** The mailbox, loaded from disk on first use; undefined when gone or expired. */
  function box(id) {
    let b = boxes.get(id);
    if (!b && dir && existsSync(join(dir, `${id}.json`))) {
      b = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
      b.items = [];
      b.ids = new Set();
      b.bytes = 0;
      if (existsSync(join(dir, `${id}.jsonl`))) {
        for (const line of readFileSync(join(dir, `${id}.jsonl`), "utf8").split("\n")) {
          if (line) add(b, JSON.parse(line));
        }
      }
      boxes.set(id, b);
    }
    if (b && keepDays > 0 && now() > b.last + keepDays * 864e5) {
      drop(id);
      return undefined;
    }
    return b;
  }
  function add(b, item) {
    b.items.push(item);
    b.ids.add(item.id);
    b.bytes += item.ct.length;
  }

  function send(res, status, body, extra = {}) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Retry-After",
      ...extra,
    });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  }
  const fail = (res, status, error, message, extra, headers) =>
    send(res, status, { v: 1, error, message, ...extra }, headers);

  function limited(req, kind) {
    let addr = req.socket.remoteAddress ?? "?";
    if (o.trustProxy)
      addr = String(req.headers["x-forwarded-for"] ?? addr)
        .split(",")[0]
        .trim();
    const key = `${kind}|${addr}`;
    const t = now();
    let h = hits.get(key);
    if (!h || t - h.start >= 60000) hits.set(key, (h = { start: t, n: 0 }));
    if (++h.n <= limits[kind]) return 0;
    return Math.max(1, Math.ceil((h.start + 60000 - t) / 1000));
  }

  /** Reads the body as text; null when it is over the limit (the rest is drained). */
  function readBody(req) {
    return new Promise((resolve) => {
      const parts = [];
      let size = 0;
      let over = Number(req.headers["content-length"] ?? 0) > MAX_BODY;
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) over = true;
        if (!over) parts.push(c);
      });
      req.on("end", () => resolve(over ? null : Buffer.concat(parts).toString("utf8")));
      req.on("error", () => resolve(null));
    });
  }
  const json = (text) => {
    try {
      const v = JSON.parse(text);
      return v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
    } catch {
      return undefined;
    }
  };

  async function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname.replace(/\/+$/, "");
    const method = req.method ?? "GET";
    if (method === "OPTIONS") {
      return send(res, 204, null, {
        "Access-Control-Allow-Methods": "GET, POST, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Private-Network": "true",
      });
    }
    const mm = /^(.*)\/m\/([A-Za-z0-9_-]{22,64})(\/ops)?$/.exec(path);
    const isCreate = /\/m$/.test(path) && !mm;
    if (!mm && !isCreate) return fail(res, 404, "not-found", "No such endpoint.");
    const ops = Boolean(mm?.[3]);
    if (isCreate ? method !== "POST" : ops ? method !== "GET" && method !== "POST" : method !== "DELETE") {
      return fail(res, 405, "method", "Method not allowed here.", {}, { Allow: "GET, POST, DELETE" });
    }
    if (method !== "DELETE") {
      const wait = limited(req, method === "POST" ? "POST" : "GET");
      if (wait) {
        return fail(
          res,
          429,
          "rate",
          "Too many requests.",
          { retryAfter: wait },
          { "Retry-After": String(wait) },
        );
      }
    }
    const bearer = (/^Bearer (.+)$/.exec(req.headers.authorization ?? "") ?? [])[1] ?? "";

    if (isCreate) {
      const body = await readBody(req);
      if (body === null) return fail(res, 413, "too-large", "Body too large.");
      if (o.createToken && !same(bearer, o.createToken))
        return fail(res, 403, "token", "Create token wrong or missing.");
      const id = b64u(randomBytes(16));
      const stop = b64u(randomBytes(32));
      const token = o.writeTokens ? b64u(randomBytes(18)) : null;
      const b = {
        id,
        created: now(),
        last: now(),
        stop: sha(stop).toString("hex"),
        token: token ? sha(token).toString("hex") : null,
        items: [],
        ids: new Set(),
        bytes: 0,
      };
      boxes.set(id, b);
      if (dir) {
        // What is written is the mailbox's own record, not the batches (they go to the .jsonl file).
        const meta = Object.fromEntries(
          Object.entries(b).filter(([k]) => !["items", "ids", "bytes"].includes(k)),
        );
        writeFileSync(join(dir, `${id}.json`), JSON.stringify(meta));
      }
      return send(res, 201, {
        v: 1,
        mailbox: id,
        stop,
        token,
        expires: expiry(b),
        keep: keepDays > 0 ? "last-write" : null,
        limits: { body: MAX_BODY, mailbox: maxBytes },
      });
    }

    const b = box(mm[2]);
    if (method === "DELETE") {
      if (!b) return fail(res, 404, "gone", "No such mailbox.");
      if (!bearer || sha(bearer).toString("hex") !== b.stop)
        return fail(res, 403, "token", "Stop key wrong or missing.");
      drop(b.id);
      return send(res, 204, null);
    }
    if (method === "GET") {
      if (!b) return fail(res, 404, "gone", "No such mailbox.");
      const since = url.searchParams.get("since") ?? "";
      if (since !== "" && !/^\d{1,15}$/.test(since)) return fail(res, 409, "cursor", "Unknown cursor.");
      const from = since === "" ? 0 : Number(since);
      if (from > b.items.length) return fail(res, 409, "cursor", "Unknown cursor.");
      let to = from;
      let size = 0;
      while (to < b.items.length && to - from < pageBatches) {
        size += b.items[to].ct.length;
        if (size > pageBytes && to > from) break;
        to++;
      }
      return send(res, 200, {
        v: 1,
        batches: b.items.slice(from, to),
        next: String(to),
        more: to < b.items.length,
        expires: expiry(b),
      });
    }
    // POST <mailbox>/ops
    if (!b) {
      await readBody(req);
      return fail(res, 404, "gone", "No such mailbox.");
    }
    const text = await readBody(req);
    if (text === null) return fail(res, 413, "too-large", "Body over 512 KiB.", {}, { Connection: "close" });
    const m = json(text);
    if (!m) return fail(res, 400, "bad-request", "Body is not a JSON object.");
    if (b.token && !(typeof m.token === "string" && sha(m.token).toString("hex") === b.token)) {
      return fail(res, 403, "token", "Write token wrong or missing.");
    }
    if (typeof m.ct !== "string" || !CT.test(m.ct)) return fail(res, 400, "bad-request", "Bad ct.");
    if (m.id !== b64u(sha(m.ct)).slice(0, 22)) return fail(res, 400, "bad-request", "id does not match ct.");
    if (b.ids.has(m.id)) return send(res, 200, { v: 1 });
    if (b.bytes + m.ct.length > maxBytes || b.items.length >= maxBatches) {
      return fail(res, 507, "full", "Mailbox is full.");
    }
    const item = { id: m.id, ct: m.ct };
    if (dir) appendFileSync(join(dir, `${b.id}.jsonl`), JSON.stringify(item) + "\n");
    add(b, item);
    b.last = now();
    return send(res, 201, { v: 1 });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) fail(res, 500, "internal", "Server error.");
      else res.end();
    });
  });
  return {
    server,
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve({ port: /** @type {any} */ (server.address()).port }));
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
