// Contract pm2: a person's inbox, for notes that say "someone mentioned you" (docs/design/mentions.md, "Inbox").
// Notes are sealed to the person, so this server stores ciphertext it can't read, from senders it can't name, for
// people it knows only as a hash. Part of the mailbox server; the same limits and the same "no accounts" rule.
import { createHash, createPublicKey, verify } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CT = /^pi1\.[A-Za-z0-9_-]+$/;
const ED = /^[A-Za-z0-9_-]{43}$/;
const MAX_CT = 8192;
const MAX_BODY = 16384;
/** What a person signs: the same framing the page's `sign(purpose, data)` uses, so no signature here can be an op's. */
const frame = (purpose, data) => `pipeup:${purpose}\n${data}`;
const sha = (s) => createHash("sha256").update(s).digest();
const b64u = (b) => Buffer.from(b).toString("base64url");

/** The inbox address of a person: the hash of their public key, so a sender can compute it and the server can't reverse it. */
export function inboxId(edPublicKey) {
  const digest = createHash("sha256")
    .update(Buffer.concat([Buffer.from("pipeup-inbox/1"), Buffer.from(edPublicKey, "base64url")]))
    .digest();
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const byte of digest) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 26) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** Whether a hash has at least `bits` leading zero bits (the small proof of work that makes flooding someone cost something). */
export function work(inbox, ct, nonce, bits) {
  const d = sha(`${inbox}|${ct}|${nonce}`);
  let n = 0;
  for (const byte of d) {
    if (byte === 0) n += 8;
    else {
      n += Math.clz32(byte) - 24;
      break;
    }
    if (n >= bits) break;
  }
  return n >= bits;
}

const spki = (ed) =>
  createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(ed, "base64url")]),
    format: "der",
    type: "spki",
  });
const signedBy = (ed, text, sig) => {
  try {
    return ED.test(ed) && verify(null, Buffer.from(text), spki(ed), Buffer.from(sig, "base64url"));
  } catch {
    return false;
  }
};

/**
 * @param {object} o
 * @param {string | null} o.dir where inboxes are kept (null: memory only)
 * @param {() => number} o.now
 * @param {number} o.work required proof-of-work bits for a note
 * @param {string} [o.token] when set, a note needs `Authorization: Bearer <it>`
 * @param {number} o.maxNotes per inbox
 * @param {number} o.keepDays 0 keeps for ever
 * @param {object} h shared helpers from the server
 */
export function createInbox(o, h) {
  const boxes = new Map();
  if (o.dir) mkdirSync(o.dir, { recursive: true });
  const file = (id, ext) => join(o.dir, `i-${id}.${ext}`);
  const expired = (b) => o.keepDays > 0 && o.now() > b.last + o.keepDays * 864e5;
  function box(id, create = false) {
    let b = boxes.get(id);
    if (!b && o.dir && existsSync(file(id, "json"))) {
      b = JSON.parse(readFileSync(file(id, "json"), "utf8"));
      b.notes = existsSync(file(id, "jsonl"))
        ? readFileSync(file(id, "jsonl"), "utf8")
            .split("\n")
            .filter(Boolean)
            .map((l) => JSON.parse(l))
        : [];
      b.ids = new Set(b.notes.map((n) => n.id));
      boxes.set(id, b);
    }
    if (b && expired(b)) {
      boxes.delete(id);
      if (o.dir) for (const e of ["json", "jsonl"]) rmSync(file(id, e), { force: true });
      b = undefined;
    }
    if (!b && create) {
      b = { id, key: null, seq: 0, last: o.now(), notes: [], ids: new Set() };
      boxes.set(id, b);
    }
    return b;
  }
  const meta = (b) => ({ id: b.id, key: b.key, seq: b.seq, last: b.last });
  const save = (b) => o.dir && writeFileSync(file(b.id, "json"), JSON.stringify(meta(b)));
  const rewrite = (b) =>
    o.dir && writeFileSync(file(b.id, "jsonl"), b.notes.map((n) => JSON.stringify(n) + "\n").join(""));

  /** Handles a request to /i/<inbox>[/key|/<note>]; returns false when the path is not an inbox's. */
  async function handle(req, res, path, method, url) {
    const m = /^(.*)\/i\/([0-9A-Z]{26})(?:\/(key|[A-Za-z0-9_-]{22}))?$/.exec(path);
    if (!m) return false;
    const [, , id, tail] = m;
    const allowed = tail === "key" ? ["GET", "PUT"] : tail ? ["DELETE"] : ["GET", "POST"];
    if (!allowed.includes(method)) {
      h.fail(res, 405, "method", "Method not allowed here.", {}, { Allow: allowed.join(", ") });
      return true;
    }
    if (method !== "DELETE") {
      const wait = h.limited(req, method === "GET" ? "GET" : "POST");
      if (wait) {
        h.fail(res, 429, "rate", "Too many requests.", { retryAfter: wait }, { "Retry-After": String(wait) });
        return true;
      }
    }
    // The person's public encryption key, which senders seal to; set by them, proved by their own signature.
    if (tail === "key") {
      if (method === "GET") {
        const b = box(id);
        if (!b?.key) h.fail(res, 404, "gone", "No key for this inbox yet.");
        else h.send(res, 200, { v: 2, ...b.key });
        return true;
      }
      const text = await h.readBody(req);
      const body = text === null ? undefined : h.json(text);
      if (!body) return (h.fail(res, 400, "bad-request", "Body is not a JSON object."), true);
      const { ed, pub, sig } = body;
      if (typeof ed !== "string" || inboxId(ed) !== id || !ED.test(String(pub)) || typeof sig !== "string")
        return (h.fail(res, 400, "bad-request", "That key does not belong to this inbox."), true);
      if (!signedBy(ed, frame("inbox/key", `${id}:${pub}`), sig))
        return (h.fail(res, 403, "signature", "Signature wrong."), true);
      const b = box(id, true);
      b.key = { ed, pub, sig };
      b.last = o.now();
      save(b);
      h.send(res, 200, { v: 2 });
      return true;
    }
    if (method === "DELETE") {
      const b = box(id);
      const note = b?.notes.find((n) => n.id === tail);
      if (!b || !note) return (h.fail(res, 404, "gone", "No such note."), true);
      const ed = String(req.headers["x-pipeup-key"] ?? "");
      const sig = String(req.headers["x-pipeup-sig"] ?? "");
      if (inboxId(ed) !== id || !signedBy(ed, frame("inbox/delete", `${id}:${tail}`), sig))
        return (h.fail(res, 403, "signature", "Only the inbox's owner can take a note away."), true);
      b.notes = b.notes.filter((n) => n.id !== tail);
      b.ids.delete(tail);
      rewrite(b);
      h.send(res, 204, null);
      return true;
    }
    if (method === "GET") {
      const b = box(id);
      if (!b) return (h.fail(res, 404, "gone", "No such inbox."), true);
      const since = url.searchParams.get("since") ?? "";
      if (since !== "" && !/^\d{1,15}$/.test(since))
        return (h.fail(res, 409, "cursor", "Unknown cursor."), true);
      const fresh = b.notes.filter((n) => n.n > Number(since || 0));
      const page = fresh.slice(0, 200);
      h.send(res, 200, {
        v: 2,
        notes: page.map(({ id: noteId, ct }) => ({ id: noteId, ct })),
        next: String(page.length ? page[page.length - 1].n : Number(since || 0)),
        more: fresh.length > page.length,
      });
      return true;
    }
    // POST: leave a note.
    const text = await h.readBody(req, MAX_BODY);
    if (text === null) return (h.fail(res, 413, "too-large", "Note too large."), true);
    const body = h.json(text);
    if (!body) return (h.fail(res, 400, "bad-request", "Body is not a JSON object."), true);
    if (o.token) {
      const bearer = (/^Bearer (.+)$/.exec(req.headers.authorization ?? "") ?? [])[1] ?? "";
      if (!h.same(bearer, o.token)) return (h.fail(res, 403, "token", "Note token wrong or missing."), true);
    }
    const { ct, work: nonce } = body;
    if (typeof ct !== "string" || !CT.test(ct) || ct.length > MAX_CT)
      return (h.fail(res, 400, "bad-request", "Bad ct."), true);
    if (typeof nonce !== "string" || nonce.length > 64 || !work(id, ct, nonce, o.work))
      return (
        h.fail(res, 403, "work", `A note needs a proof of work of ${o.work} bits.`, { bits: o.work }),
        true
      );
    const b = box(id, true);
    const noteId = b64u(sha(ct)).slice(0, 22);
    if (b.ids.has(noteId)) return (h.send(res, 200, { v: 2 }), true);
    if (b.notes.length >= o.maxNotes) return (h.fail(res, 507, "full", "This inbox is full."), true);
    const note = { id: noteId, ct, n: ++b.seq };
    b.notes.push(note);
    b.ids.add(noteId);
    b.last = o.now();
    if (o.dir) {
      save(b);
      appendFileSync(file(id, "jsonl"), JSON.stringify(note) + "\n");
    }
    h.send(res, 201, { v: 2 });
    return true;
  }
  return { handle };
}
