import type { SignedOp } from "pipeup";
import type { Ladder, Purpose } from "./derive";
import { fromB64u, randomBytes, text, toB64u, utf8 } from "./encoding";

const MAX_INFLATED = 1_000_000;
const MAX_OPS = 1000;

async function pipe(
  data: Uint8Array<ArrayBuffer>,
  t: CompressionStream | DecompressionStream,
  cap = Infinity,
) {
  const reader = new Blob([data]).stream().pipeThrough(t).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      void reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/**
 * A sealed batch: 0x01 ‖ iv[12] ‖ AES-GCM(key(p), iv, aad, deflate-raw(plaintext)). Once opened, a batch is a
 * valid unsealed feedback file, so the command line can read it.
 */
export const seal = (l: Ladder, p: Purpose, ops: readonly SignedOp[]): Promise<Uint8Array<ArrayBuffer>> =>
  sealJson(l, p, { pipeup: 1, doc: l.docId, sealed: false, ops });

/** Seals any JSON value the same way (a transport's own small records, such as share's `next`). */
export async function sealJson(l: Ladder, p: Purpose, value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const plain = utf8(JSON.stringify(value));
  const iv = randomBytes(12);
  const body = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8(l.aad(p)) },
    await l.key(p),
    await pipe(plain, new CompressionStream("deflate-raw")),
  );
  const out = new Uint8Array(13 + body.byteLength);
  out[0] = 1;
  out.set(iv, 1);
  out.set(new Uint8Array(body), 13);
  return out;
}

export interface Opened {
  /** Untrusted: hand them to `host.merge`, which verifies each one. */
  ops: unknown[];
  /** Ops shaped like ops but from a newer Pipeup (`body.v` isn't 1): they can't be shown yet. */
  newer: number;
}

/** Opens a sealed value (see `sealJson`): null when it isn't ours, is garbage, or inflates past 1 MB. */
export async function openJson(l: Ladder, p: Purpose, bytes: Uint8Array<ArrayBuffer>): Promise<unknown> {
  try {
    if (bytes.length < 13 + 16 || bytes[0] !== 1) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(1, 13), additionalData: utf8(l.aad(p)) },
      await l.key(p),
      bytes.slice(13),
    );
    return JSON.parse(text(await pipe(new Uint8Array(plain), new DecompressionStream("deflate-raw"), MAX_INFLATED)));
  } catch {
    return null;
  }
}

/** A batch from an opened value: for this document, with at most 1,000 ops; else null. */
export function asBatch(l: Ladder, value: unknown): Opened | null {
  const file = value as { pipeup?: number; doc?: string; ops?: unknown } | null;
  if (file?.pipeup !== 1 || file.doc !== l.docId || !Array.isArray(file.ops) || file.ops.length > MAX_OPS)
    return null;
  let newer = 0;
  for (const op of file.ops) {
    const v = (op as { body?: { v?: unknown } } | null)?.body?.v;
    if (typeof v === "number" && v !== 1) newer++;
  }
  return { ops: file.ops, newer };
}

/**
 * Opens a sealed batch. Garbage, another document's or another purpose's batch, too big or too many ops: null, as if
 * nothing had come (it behaves like withholding, not an error the reviewer sees).
 */
export async function open(l: Ladder, p: Purpose, bytes: Uint8Array<ArrayBuffer>): Promise<Opened | null> {
  return asBatch(l, await openJson(l, p, bytes));
}

/** The text form of a sealed batch, for live and relay frames: "pu1." + base64url. */
export const toText = (bytes: Uint8Array): string => `pu1.${toB64u(bytes)}`;
export const fromText = (s: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^pu1\.[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    return fromB64u(s.slice(4));
  } catch {
    return null;
  }
};
