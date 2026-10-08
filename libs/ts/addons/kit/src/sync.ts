import type { Listener, SignedOp } from "pipeup";
import { RetryAfter, type Transport } from "./transport";
import { sha256, toB64u, utf8 } from "./encoding";

export interface SyncOptions {
  /** The add-on's id: the merge source, and what this engine never sends back. */
  id: string;
  document: { ops(): readonly SignedOp[]; onChange(fn: Listener): () => void };
  merge(ops: readonly unknown[]): Promise<number>;
  transport: Transport;
  /** Only ops this accepts are ever sent. There is no general "forward everything" rule. */
  sendable(op: SignedOp): boolean;
  signal: AbortSignal;
  /** Wait this long (ms) after a change before sending. Default 0. */
  delay?: number;
  /** The least time (ms) between sends, or a function giving it now (a service may teach us its own). Default 0. */
  gap?: number | (() => number);
  /** Most ops in one send. Default 500. */
  batch?: number;
}

export type SyncState = "idle" | "sending" | "offline" | "limited";

const INBOUND_MS = 100;
const MERGE_CHUNK = 5000;
const BACKOFF_FIRST = 5000;
const BACKOFF_MAX = 300_000;
const LIMIT_MAX_S = 3600;

/**
 * Keeps one transport and one document in step: other people's ops come in through the core's checks
 * (`host.merge`), and this reviewer's sendable ops go out. The outbox is worked out from `ops()`, so nothing extra
 * is stored and offline work is sent when the connection returns.
 */
export class SyncEngine {
  state: SyncState = "idle";
  /** Set after the first successful send or read: the last time the remote answered. */
  lastOk = 0;
  private readonly known = new Set<string>();
  private readonly outbox = new Map<string, SignedOp>();
  /** Ids asked for or offered that the core refused: never requested or offered again this session. */
  readonly rejected = new Set<string>();
  private inbound: unknown[] = [];
  private inboundTimer = 0;
  private sendTimer = 0;
  private lastSend = 0;
  private backoff = 0;
  private off: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private stopped = false;

  constructor(private readonly o: SyncOptions) {}

  /** Ops waiting to be sent. */
  get waiting(): number {
    return this.outbox.size;
  }

  pending(): SignedOp[] {
    return [...this.outbox.values()];
  }

  /** Hears every change of `state` and `waiting`. */
  onState(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(state?: SyncState): void {
    if (state) this.state = state;
    for (const fn of [...this.listeners]) fn();
  }

  async start(): Promise<void> {
    const { document: doc, transport, signal } = this.o;
    // Subscribe before reading anything, so a change made meanwhile is not missed.
    this.off = doc.onChange((_threads, added, source) => {
      if (source === this.o.id) return;
      let any = false;
      for (const op of added) if (this.want(op)) any = this.outbox.set(op.body.id, op).size > 0 || any;
      if (any) this.schedule();
      this.emit();
    });
    signal.addEventListener("abort", () => this.stop(), { once: true });
    await transport.start((ops) => this.deliver(ops));
    const remote = await transport.remoteIds?.();
    if (remote) for (const id of remote) this.known.add(id);
    this.rescan();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.off?.();
    clearTimeout(this.inboundTimer);
    clearTimeout(this.sendTimer);
    this.o.transport.stop();
  }

  private want(op: SignedOp): boolean {
    return !this.known.has(op.body.id) && !this.rejected.has(op.body.id) && this.o.sendable(op);
  }

  /** Works the outbox out again from `ops()`: after a send policy changes (a choice made, a switch turned on). */
  rescan(): void {
    this.outbox.clear();
    for (const op of this.o.document.ops()) if (this.want(op)) this.outbox.set(op.body.id, op);
    this.schedule();
    this.emit();
  }

  private deliver(ops: unknown[]): void {
    this.inbound.push(...ops);
    if (!this.inboundTimer)
      this.inboundTimer = setTimeout(() => void this.drain(), INBOUND_MS) as unknown as number;
  }

  private async drain(): Promise<void> {
    this.inboundTimer = 0;
    const ops = this.inbound.splice(0);
    const ids = ops
      .map((o) => (o as { body?: { id?: unknown } } | null)?.body?.id)
      .filter((i): i is string => typeof i === "string");
    for (let i = 0; i < ops.length; i += MERGE_CHUNK) {
      try {
        await this.o.merge(ops.slice(i, i + MERGE_CHUNK));
      } catch (e) {
        // The core merged them but its store refused: shown, saved with the next change. Anything else is reported.
        if ((e as Error)?.name !== "UnsavedChangeError") globalThis.reportError?.(e);
      }
    }
    // Whatever was offered and isn't held now was refused: junk, another document, a bad signature, a newer version.
    const held = new Set(this.o.document.ops().map((op) => op.body.id));
    for (const id of ids) {
      if (held.has(id)) {
        this.known.add(id);
        this.outbox.delete(id);
      } else this.rejected.add(id);
    }
    this.lastOk = Date.now();
    this.emit();
  }

  private schedule(delay = this.o.delay ?? 0): void {
    if (this.stopped || this.sendTimer || this.outbox.size === 0) return;
    const gap = typeof this.o.gap === "function" ? this.o.gap() : (this.o.gap ?? 0);
    const wait = Math.max(delay, this.lastSend + gap - Date.now(), this.backoff);
    this.sendTimer = setTimeout(() => void this.send(), wait) as unknown as number;
  }

  private async send(): Promise<void> {
    this.sendTimer = 0;
    if (this.stopped || this.o.signal.aborted || this.outbox.size === 0) return;
    const batch = [...this.outbox.values()].slice(0, this.o.batch ?? 500);
    this.emit("sending");
    try {
      await this.o.transport.send(batch);
      for (const op of batch) {
        this.known.add(op.body.id);
        this.outbox.delete(op.body.id);
      }
      this.lastSend = Date.now();
      this.lastOk = this.lastSend;
      this.backoff = 0;
      this.emit("idle");
    } catch (e) {
      if (e instanceof RetryAfter) {
        this.backoff = Math.min(e.seconds, LIMIT_MAX_S) * 1000 * (1 + Math.random() * 0.2);
        this.emit("limited");
      } else {
        this.backoff = Math.min(BACKOFF_MAX, this.backoff ? this.backoff * 2 : BACKOFF_FIRST);
        this.emit("offline");
      }
    }
    this.schedule();
  }
}

/** A digest of a set of op ids: the count and the SHA-256 of the sorted ids, to compare two sets cheaply. */
export async function idDigest(ids: Iterable<string>): Promise<string> {
  const sorted = [...ids].sort();
  return `${sorted.length}.${toB64u(await sha256(utf8(sorted.join("\n"))))}`;
}
