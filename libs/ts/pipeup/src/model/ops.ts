import { sign, verify, type Identity } from "../crypto/identity";
import { canonicalJson, utf8 } from "../util/encoding";
import type { OpBody, SignedOp } from "./types";

/** Lengths are UTF-16 code units (JavaScript string length). */
export const MAX_TEXT = 10_000;
/** Far beyond any real log, far below where clock arithmetic could overflow. */
export const MAX_CLOCK = 2 ** 40;
/** Latest valid `at` in ms (about the year 6400); new ops stay at it rather than fail. */
export const MAX_AT = 2 ** 47;
export const LIMITS = {
  doc: 64,
  path: 2000,
  snapshot: 500,
  anchorId: 200,
  quote: 10_000,
  context: 64,
  viewEntries: 16,
  viewKey: 64,
  viewValue: 200,
} as const;
const FINGERPRINT = /^[0-9a-f]{8}$/;
const ID = /^[A-Za-z0-9_-]{43}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;
const KINDS = new Set(["create", "reply", "edit", "delete", "resolve", "reopen"]);

export async function signOp(body: OpBody, identity: Identity): Promise<SignedOp> {
  if (body.author !== identity.publicKey) throw new Error("pipeup: an op must be signed by its author");
  return { body, sig: await sign(identity, utf8(canonicalJson(body))) };
}

const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isUnit = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function isAnchor(a: unknown): boolean {
  if (!a || typeof a !== "object") return false;
  const { id, path, fingerprint, snapshot, quote, point, view } = a as Record<string, unknown>;
  if (!isStr(path, LIMITS.path) || !isStr(snapshot, LIMITS.snapshot)) return false;
  if (typeof fingerprint !== "string" || !FINGERPRINT.test(fingerprint)) return false;
  if (id !== undefined && (!isStr(id, LIMITS.anchorId) || id === "")) return false;
  if (quote !== undefined) {
    if (!quote || typeof quote !== "object") return false;
    const q = quote as Record<string, unknown>;
    if (!isStr(q.exact, LIMITS.quote) || q.exact === "") return false;
    if (!isStr(q.prefix, LIMITS.context) || !isStr(q.suffix, LIMITS.context)) return false;
  }
  if (point !== undefined) {
    if (!point || typeof point !== "object") return false;
    const p = point as Record<string, unknown>;
    if (!isUnit(p.x) || !isUnit(p.y)) return false;
  }
  if (view !== undefined) {
    if (!view || typeof view !== "object" || Array.isArray(view)) return false;
    const entries = Object.entries(view);
    if (entries.length > LIMITS.viewEntries) return false;
    if (!entries.every(([k, v]) => k.length <= LIMITS.viewKey && isStr(v, LIMITS.viewValue))) return false;
  }
  return true;
}

/** Shape checks that need nothing but the op itself. */
export function isWellFormed(op: unknown): op is SignedOp {
  if (!op || typeof op !== "object") return false;
  const { body, sig } = op as Partial<SignedOp>;
  if (typeof sig !== "string" || !body || typeof body !== "object") return false;
  const b = body as Partial<OpBody>;
  if (b.v !== 1 || typeof b.id !== "string" || !ID.test(b.id)) return false;
  if (typeof b.kind !== "string" || !KINDS.has(b.kind)) return false;
  if (!isStr(b.doc, LIMITS.doc) || b.doc === "" || typeof b.thread !== "string" || !ID.test(b.thread))
    return false;
  if (typeof b.author !== "string" || !KEY.test(b.author)) return false;
  // "" is someone who hasn't added a name: they show as their animal.
  if (typeof b.name !== "string" || b.name.length > 80 || b.name !== b.name.trim()) return false;
  if (typeof b.clock !== "number" || !Number.isSafeInteger(b.clock) || b.clock < 1 || b.clock > MAX_CLOCK)
    return false;
  if (typeof b.at !== "number" || !Number.isSafeInteger(b.at) || b.at < 0 || b.at > MAX_AT) return false;
  if (b.text !== undefined && (!isStr(b.text, MAX_TEXT) || b.text !== b.text.trim())) return false;
  if (b.target !== undefined && (typeof b.target !== "string" || !ID.test(b.target))) return false;
  const needsText = b.kind === "create" || b.kind === "reply" || b.kind === "edit";
  if (needsText && (typeof b.text !== "string" || b.text.trim() === "")) return false;
  if ((b.kind === "reply" || b.kind === "edit" || b.kind === "delete") && !b.target) return false;
  if (b.kind === "create") {
    if (b.id !== b.thread || !isAnchor(b.anchor)) return false;
  }
  return true;
}

export function isAuthentic(op: SignedOp): Promise<boolean> {
  return verify(op.body.author, utf8(canonicalJson(op.body)), op.sig);
}

/**
 * Total order every peer agrees on: by clock, then time written, then author, then id. Time comes
 * before author so one writer's actions keep their order when many ops share a clock (for example
 * once a peer has pushed it to the cap).
 */
export function compareOps(a: SignedOp, b: SignedOp): number {
  if (a.body.clock !== b.body.clock) return a.body.clock - b.body.clock;
  if (a.body.at !== b.body.at) return a.body.at - b.body.at;
  if (a.body.author !== b.body.author) return a.body.author < b.body.author ? -1 : 1;
  if (a.body.id !== b.body.id) return a.body.id < b.body.id ? -1 : 1;
  return 0;
}
