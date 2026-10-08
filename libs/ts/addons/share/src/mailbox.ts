import {
  fromText,
  open,
  RetryAfter,
  seal,
  sha256,
  toB64u,
  toText,
  utf8,
  type Ladder,
  type Opened,
} from "@pipeup/kit";
import type { SignedOp } from "pipeup";
import {
  chunks,
  GET,
  idsOf,
  json,
  POST,
  Problem,
  refusal,
  retryAfter,
  type Backend,
  type Fetch,
} from "./backend";

const MAX_BODY = 524_288;
const MAX_PAGES = 1000;

/** The batch id of a sealed text: the first 22 characters of base64url(SHA-256(ct)). */
export const batchId = async (ct: string): Promise<string> => toB64u(await sha256(utf8(ct))).slice(0, 22);

/** An HTTP mailbox (add-ons design §7.7, contract version 1). */
export class Mailbox implements Backend {
  readonly ids = new Set<string>();
  expires: number | null = null;
  moved = false;
  big = false;
  private cursor = "";
  private readonly seen = new Set<string>();
  private memo: { key: string; ct: string; id: string } | null = null;

  constructor(
    private readonly a: { mailbox: string; token?: string },
    private readonly l: Ladder,
    private readonly f: Fetch,
    private readonly signal?: AbortSignal,
  ) {}

  async read(): Promise<Opened[]> {
    const out: Opened[] = [];
    let reset = 0;
    for (let pages = 0; pages < MAX_PAGES;) {
      const url = `${this.a.mailbox}/ops${this.cursor ? `?since=${encodeURIComponent(this.cursor)}` : ""}`;
      const r = await GET(this.f, url, this.signal);
      if (r.status === 404) throw new Problem("gone");
      if (r.status === 409 && reset++ < 2) {
        this.cursor = ""; // the server forgot the cursor: read again from the start
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      pages++;
      const [j] = await json(r);
      for (const b of Array.isArray(j.batches) ? (j.batches as { id?: unknown; ct?: unknown }[]) : []) {
        if (typeof b?.id !== "string" || typeof b.ct !== "string" || this.seen.has(b.id)) continue;
        this.seen.add(b.id);
        const bytes = fromText(b.ct);
        const o = bytes && (await open(this.l, "share", bytes));
        if (!o) continue;
        out.push(o);
        for (const id of idsOf(o.ops)) this.ids.add(id);
      }
      if (typeof j.next === "string") this.cursor = j.next;
      this.expires = typeof j.expires === "string" ? Date.parse(j.expires) || null : null;
      if (j.more !== true) break;
    }
    return out;
  }

  /** The POST for these ops. A retry of the same ops reuses its sealed text and id, so the server collapses it. */
  async req(ops: readonly SignedOp[]): Promise<[string, RequestInit]> {
    const key = ops.map((o) => o.body.id).join();
    if (this.memo?.key !== key) {
      const ct = toText(await seal(this.l, "share", ops));
      this.memo = { key, ct, id: await batchId(ct) };
    }
    const { ct, id } = this.memo;
    return [`${this.a.mailbox}/ops`, POST({ id, ct, token: this.a.token })];
  }

  async post(ops: readonly SignedOp[]): Promise<void> {
    for (const part of chunks(ops)) await this.one(part);
  }

  private async one(part: SignedOp[]): Promise<void> {
    const [url, init] = await this.req(part);
    const split = async () => {
      const mid = part.length >> 1;
      await this.one(part.slice(0, mid));
      await this.one(part.slice(mid));
    };
    if ((init.body as string).length > MAX_BODY && part.length > 1) return split();
    const r = await this.f(url, { ...init, signal: this.signal });
    const s = r.status;
    if (s === 200 || s === 201 || s === 400) return; // 400: refused for good, never retried
    if (s === 413 && part.length > 1) return split();
    const refused = refusal(s);
    if (refused) throw refused;
    if (s === 429) {
      const [body] = await json(r).catch(() => [{} as Record<string, unknown>] as const);
      const n = Number(body.retryAfter);
      throw new RetryAfter(r.headers.get("Retry-After") ? retryAfter(r) : n > 0 ? Math.min(n, 3600) : 10);
    }
    throw new Error(`HTTP ${s}`);
  }
}
