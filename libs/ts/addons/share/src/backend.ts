import type { Opened } from "@pipeup/kit";
import type { SignedOp } from "pipeup";

/** The service said something that stops sharing: it is gone, it refuses this page, or it is full. */
export class Problem extends Error {
  constructor(readonly kind: "gone" | "closed" | "full") {
    super(kind);
    this.name = "Problem";
  }
}

export type Fetch = typeof fetch;

/** One shared copy on one kind of service (PrivateBin or a mailbox). The transport adds timing and policy. */
export interface Backend {
  /** The op ids the shared copy holds: known after the first read. */
  readonly ids: Set<string>;
  /** When the service will delete the shared copy (ms), if it says. */
  expires: number | null;
  /** The newest generation changed since last asked (PrivateBin rollover). */
  moved: boolean;
  /** A rollover is due (PrivateBin). */
  big: boolean;
  /** What is new, opened. Throws `Problem("gone")` on a 404; any other failure is "offline". */
  read(): Promise<Opened[]>;
  /** The request that posts these ops, so a page that is closing can send it without waiting. */
  req(ops: readonly SignedOp[]): Promise<[string, RequestInit]>;
  /** Posts these ops. Throws `RetryAfter` when the service asks for patience, `Problem` when it refuses. */
  post(ops: readonly SignedOp[]): Promise<void>;
  /** Starts a new generation holding `ops` (PrivateBin). */
  roll?(ops: readonly SignedOp[]): Promise<Opened[]>;
}

/** Simple requests only (no preflight): `Accept: application/json`, `text/plain` bodies, no credentials. */
export const ACCEPT = { Accept: "application/json" };

export const GET = (f: Fetch, url: string, signal?: AbortSignal): Promise<Response> =>
  f(url, { headers: ACCEPT, credentials: "omit", signal });

export const POST = (body: unknown): RequestInit => ({
  method: "POST",
  headers: ACCEPT,
  credentials: "omit",
  body: JSON.stringify(body),
});

/** What a refusing status means for the shared copy. */
export const refusal = (status: number): Problem | undefined => {
  const kind = ({ 403: "closed", 404: "gone", 507: "full" } as const)[status as 403];
  return kind && new Problem(kind);
};

/** A response's JSON object and its size, refusing more than 10 MB before parsing it. */
export async function json(res: Response): Promise<[Record<string, unknown>, number]> {
  const t = await res.text();
  const v = t.length < 10_000_000 && (JSON.parse(t) as unknown);
  if (!v || typeof v !== "object") throw new Error("the answer was not usable");
  return [v as Record<string, unknown>, t.length];
}

/** Splits ops so that each group is about 900 KB or less (a reader refuses a batch over 1 MB inflated). */
export function chunks(ops: readonly SignedOp[], max = 900_000): SignedOp[][] {
  const out: SignedOp[][] = [];
  let size = 0;
  for (const op of ops) {
    size += JSON.stringify(op).length;
    if (!out.length || size > max || out.at(-1)!.length >= 500) {
      out.push([]);
      size = JSON.stringify(op).length;
    }
    out.at(-1)!.push(op);
  }
  return out;
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

/** The seconds a service asks us to wait: the `Retry-After` header, else `fallback`. */
export const retryAfter = (res: Response, fallback = 10): number => {
  const n = Number(res.headers.get("Retry-After"));
  return n > 0 ? Math.min(n, 3600) : fallback;
};

/** The op ids in some untrusted ops (those that have one). */
export const idsOf = (ops: readonly unknown[]): string[] =>
  ops
    .map((o) => (o as { body?: { id?: unknown } } | null)?.body?.id)
    .filter((i): i is string => typeof i === "string");
