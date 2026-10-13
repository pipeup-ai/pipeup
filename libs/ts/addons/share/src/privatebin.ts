import {
  asBatch,
  fromB64,
  openJson,
  randomBytes,
  RetryAfter,
  seal,
  sealJson,
  toB64,
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
  retryAfter,
  sleep,
  type Backend,
  type Fetch,
} from "./backend";

const ROLL_BYTES = 256_000;
const MAX_HOPS = 16;
const NEXT = /^[A-Za-z0-9_-]{8,64}$/;

/** The cipher spec PrivateBin's `FormatV2::isValid` checks the shape of; Pipeup's own iv is inside `ct`. */
const spec = () => [toB64(randomBytes(16)), toB64(randomBytes(8)), 100000, 256, 128, "aes", "gcm", "none"];

/** A comment, exactly the five fields PrivateBin keeps: never a `meta`, which would make it a new paste. */
export const commentBody = (paste: string, sealed: Uint8Array) => ({
  v: 2,
  adata: spec(),
  ct: toB64(sealed),
  pasteid: paste,
  parentid: paste,
});

/**
 * PrivateBin answers HTTP 200 with `status: 1` for "please wait" (never a 429), in the instance's language ("Please
 * wait 60 seconds between each post."). Instances set their own limit (the default is 10 s, privatebin.net asks for
 * 60 s), so the sentence's number is the wait; with no usable number, 30 s. It is also the instance's standing rule,
 * so later posts keep at least that gap.
 */
async function answer(res: Response): Promise<Record<string, unknown>> {
  if (res.status === 429) throw new RetryAfter(retryAfter(res));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [j] = await json(res);
  if (j.status === 0) return j;
  const n = Number(/\d+/.exec(String(j.message ?? ""))?.[0]);
  throw new RetryAfter(n >= 1 && n <= 3600 ? n : 30, true);
}

/** Creates a paste with discussion on, burn-after-reading off, holding an empty sealed batch. */
export async function createPaste(
  f: Fetch,
  base: string,
  l: Ladder,
  expire = "never",
  signal?: AbortSignal,
): Promise<{ id: string; deleteToken: string }> {
  const ct = toB64(await seal(l, "share", []));
  const j = await answer(
    await f(base, { ...POST({ v: 2, adata: [spec(), "plaintext", 1, 0], ct, meta: { expire } }), signal }),
  );
  if (typeof j.id !== "string" || typeof j.deletetoken !== "string")
    throw new Error("the answer had no paste id");
  return { id: j.id, deleteToken: j.deletetoken };
}

/** Deletes a paste with its delete token. */
export async function deletePaste(f: Fetch, base: string, id: string, token: string): Promise<Response> {
  return f(base, POST({ pasteid: id, deletetoken: token }));
}

/** One paste as read: its JSON, its size, and how long the instance keeps it (ms from now; null: no end). */
export async function readPaste(
  f: Fetch,
  base: string,
  id: string,
  signal?: AbortSignal,
): Promise<{ j: Record<string, unknown>; size: number; ttl: number | null } | null> {
  const r = await GET(f, `${base}?${id}`, signal);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const [j, size] = await json(r);
  if (j.status !== 0) return null;
  const ttl = (j.meta as { time_to_live?: unknown } | undefined)?.time_to_live;
  return { j, size, ttl: typeof ttl === "number" && ttl > 0 ? ttl * 1000 : null };
}

export class PrivateBin implements Backend {
  readonly ids = new Set<string>();
  expires: number | null = null;
  moved = false;
  big = false;
  /** The newest generation seen. */
  head: string;
  /** Every generation moved through, oldest first (the command line lists them). */
  readonly trail: string[] = [];
  /** Comment id -> the `next` it carries (null: none): a comment is opened once. */
  private readonly seen = new Map<string, string | null>();

  constructor(
    private readonly a: { base: string; paste: string },
    private readonly l: Ladder,
    private readonly f: Fetch,
    private readonly signal?: AbortSignal,
    gen?: string | null,
    private readonly onGen: (id: string) => void = () => {},
  ) {
    this.head = gen || a.paste;
    this.trail.push(a.paste);
  }

  private async scan(comments: unknown, out: Opened[]): Promise<string | undefined> {
    let next: string | undefined;
    for (const c of (Array.isArray(comments) ? comments : []) as { id?: unknown; ct?: unknown }[]) {
      if (typeof c?.id !== "string" || typeof c.ct !== "string") continue;
      let n = this.seen.get(c.id);
      if (n === undefined) {
        n = null;
        let bytes: Uint8Array<ArrayBuffer> | null = null;
        try {
          if (c.ct.length < 1_400_000) bytes = fromB64(c.ct);
        } catch {
          /* not base64 */
        }
        const v = bytes && (await openJson(this.l, "share", bytes));
        const nx = (v as { next?: unknown } | null)?.next;
        const b = typeof nx === "string" ? null : asBatch(this.l, v);
        if (typeof nx === "string" && NEXT.test(nx)) n = nx;
        else if (b) {
          out.push(b);
          for (const id of idsOf(b.ops)) this.ids.add(id);
        }
        this.seen.set(c.id, n);
      }
      next ??= n ?? undefined;
    }
    return next;
  }

  /** Reads the newest generation, following `next` records up to 16 hops; falls back to the file's own address. */
  async read(): Promise<Opened[]> {
    const out: Opened[] = [];
    let id = this.head;
    let fell = false;
    let got = false;
    for (let hops = 0; ;) {
      const r = await readPaste(this.f, this.a.base, id, this.signal);
      if (!r) {
        if (got) break; // a later copy is gone: stay on the last good one
        if (!fell && id !== this.a.paste) {
          fell = true;
          id = this.a.paste;
          continue;
        }
        throw new Problem("gone");
      }
      got = true;
      if (id !== this.head) {
        this.head = id;
        this.trail.push(id);
        this.ids.clear();
        this.moved = true;
        this.onGen(id);
      }
      const comments = r.j.comments;
      const next = await this.scan(comments, out);
      this.expires = r.ttl && Date.now() + r.ttl;
      const first =
        (Array.isArray(comments) ? (comments[0] as { ct?: string } | undefined)?.ct?.length : 0) ?? 0;
      this.big = !next && r.size > ROLL_BYTES && r.size > 2 * first;
      if (!next || ++hops >= MAX_HOPS) break;
      id = next;
    }
    return out;
  }

  private ask(paste: string, sealed: Uint8Array): [string, RequestInit] {
    return [this.a.base, POST(commentBody(paste, sealed))];
  }

  async req(ops: readonly SignedOp[]): Promise<[string, RequestInit]> {
    return this.ask(this.head, await seal(this.l, "share", ops));
  }

  private go(url: string, init: RequestInit) {
    return this.f(url, { ...init, signal: this.signal });
  }

  async post(ops: readonly SignedOp[]): Promise<void> {
    for (const part of chunks(ops)) await answer(await this.go(...(await this.req(part))));
  }

  /**
   * Starts a new generation: a new paste holding `ops`, then a sealed `next` in the old one. The earliest `next`
   * wins; a loser deletes its own paste. Returns what the final read found.
   */
  async roll(ops: readonly SignedOp[]): Promise<Opened[]> {
    const patiently = async <T>(run: () => Promise<T>): Promise<T> => {
      for (let tries = 0; ; tries++) {
        try {
          return await run();
        } catch (e) {
          if (!(e instanceof RetryAfter) || tries > 5 || this.signal?.aborted) throw e;
          await sleep(e.seconds * 1000 * (1 + Math.random() * 0.2), this.signal);
        }
      }
    };
    const old = this.head;
    const made = await patiently(() => createPaste(this.f, this.a.base, this.l, "never", this.signal));
    for (const part of chunks(ops))
      await patiently(async () =>
        answer(await this.go(...this.ask(made.id, await seal(this.l, "share", part)))),
      );
    await patiently(async () =>
      answer(await this.go(...this.ask(old, await sealJson(this.l, "share", { next: made.id })))),
    );
    const got = await this.read();
    if (this.head !== made.id)
      await deletePaste(this.f, this.a.base, made.id, made.deleteToken).catch(() => {});
    return got;
  }
}
