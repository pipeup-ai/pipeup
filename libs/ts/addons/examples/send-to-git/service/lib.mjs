// What every Send to Git service does, whatever it saves to: answer the browser's check, know who is sending, check the
// request, choose the file's path itself, limit size and rate, and answer in the contract's words.
import { randomBytes } from "node:crypto";

export const MAX_BYTES = 200_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

// `http` (not `status`): other errors, such as a failed git command, carry a `status` of their own.
const fail = (http, error) => Object.assign(new Error(error), { http });

/** The request body, checked: only the fields the contract names, each within bounds. */
export function parseReview(text) {
  if (Buffer.byteLength(text) > MAX_BYTES) throw fail(413, "the review is too large");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw fail(400, "the request isn't JSON");
  }
  const str = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;
  if (!body || typeof body !== "object") throw fail(400, "the request isn't a review");
  if (!str(body.title, 300) || !str(body.url, 2000) || !str(body.markdown, MAX_BYTES))
    throw fail(400, "the review needs a title, a page address and Markdown");
  const at = new Date(body.exportedAt);
  if (Number.isNaN(at.getTime())) throw fail(400, "the review needs an exportedAt time");
  return {
    title: body.title,
    url: body.url,
    markdown: body.markdown,
    exportedAt: at,
    openThreads: Number(body.openThreads) || 0,
  };
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** The file's path, chosen here, never by the request: reviews/<page>/<time>-<who>-<4 letters>.md (so two in a second differ) */
export function choosePath(review, user, now = new Date(), tag = randomBytes(2).toString("hex")) {
  let page = "";
  try {
    page = slug(
      new URL(review.url).pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/\.[a-z]+$/i, "") ?? "",
    );
  } catch {
    /* an address that doesn't parse: the title stands in */
  }
  page = page || slug(review.title) || "page";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  return `reviews/${page}/${stamp}-${slug(user) || "someone"}-${tag}.md`;
}

const hits = new Map();
/** At most ten reviews a minute from one person. */
export function allow(user, now = Date.now()) {
  const recent = (hits.get(user) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  hits.set(user, [...recent, now]);
  return true;
}

/**
 * The HTTP handler. `save({ review, path, user })` writes the file and resolves to { path, commit } or { path, pr }.
 * `who(req)` returns the sender's name, or null when they aren't signed in. `origin` is the one page address allowed.
 */
export function handler({ save, who, origin }) {
  return async (req, res) => {
    const reply = (status, body, extra = {}) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        vary: "origin",
        ...extra,
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === "OPTIONS")
      return reply(
        204,
        {},
        {
          "access-control-allow-methods": "POST",
          "access-control-allow-headers": "content-type, x-company-user",
          "access-control-max-age": "600",
        },
      );
    if (req.method !== "POST" || new URL(req.url, "http://x").pathname !== "/reviews")
      return reply(404, { error: "not found" });
    try {
      const user = who(req);
      if (!user) throw fail(401, "you are not signed in");
      if (!allow(user)) throw fail(429, "please wait a moment");
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (text.length > MAX_BYTES * 2) throw fail(413, "the review is too large");
      }
      const review = parseReview(text);
      const path = choosePath(review, user);
      const saved = await save({ review, path, user });
      reply(201, saved);
    } catch (e) {
      const status = e.http ?? 500;
      if (status === 500) console.error(e);
      reply(status, { error: status === 500 ? "the service couldn't save the review" : e.message });
    }
  };
}
