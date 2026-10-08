import { RetryAfter, type Transport } from "@pipeup/kit";
import type { SignedOp } from "pipeup";
import { Problem, sleep, type Backend } from "./backend";

export interface TransportOptions {
  signal?: AbortSignal;
  /** The least time (ms) the one sender holds the lock after a post: one post per browser per gap. */
  gap: number;
  /** Ops this reviewer may put in the shared copy (own shared comments and those received from it). */
  allowed(): SignedOp[];
  /** The connection, the problem or the newer-version count changed. */
  changed(): void;
  /** Use the Web Lock `name`; false for a program that is the only sender (the command line). */
  lock?: string | false;
  fetch?: typeof fetch;
}

/** How long to wait before the next read (add-ons design §7.2), in ms; `errors` slows it down to 5 minutes. */
export function interval(idle: number, hidden: boolean, errors: number, jitter = Math.random()): number {
  const base = hidden
    ? 300_000
    : idle < 600_000
      ? 25_000 + jitter * 10_000
      : idle < 1_800_000
        ? 120_000
        : 300_000;
  return Math.min(300_000, base * 2 ** errors);
}

/** A backend plus the rules about when to read, who sends, and what to do when the service objects. */
export class ShareTransport implements Transport {
  readonly id = "share";
  problem: Problem["kind"] | null = null;
  /** The last request failed (no connection, or the service erred). */
  offline = false;
  /** Ops seen from a newer Pipeup that this page can't show. */
  newer = 0;
  private deliver: (ops: unknown[]) => void = () => {};
  private active = Date.now();
  private errors = 0;
  private ok = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private busy: Promise<void> | null = null;
  private rolling = false;
  private ready: [string, RequestInit] | null = null;
  private stopped = false;
  private off: (() => void)[] = [];

  constructor(
    readonly b: Backend,
    private readonly o: TransportOptions,
  ) {}

  async start(deliver: (ops: unknown[]) => void): Promise<void> {
    this.deliver = deliver;
    const on = (t: EventTarget | undefined, type: string, fn: () => void) => {
      if (!t) return;
      t.addEventListener(type, fn);
      this.off.push(() => t.removeEventListener(type, fn));
    };
    const g = globalThis as { addEventListener?: unknown; document?: Document };
    if (g.addEventListener) {
      on(globalThis, "focus", () => void this.poll());
      on(globalThis, "online", () => void this.poll());
      on(globalThis, "pagehide", () => this.flush());
      on(g.document, "visibilitychange", () => g.document?.visibilityState === "visible" && void this.poll());
    }
    await this.poll();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    for (const off of this.off.splice(0)) off();
  }

  async remoteIds(): Promise<ReadonlySet<string> | null> {
    return this.ok ? this.b.ids : null;
  }

  /** Reads now (once at a time), then schedules the next read. */
  poll(): Promise<void> {
    return (this.busy ??= this.read().finally(() => (this.busy = null)));
  }

  /** The reviewer changed something: reads become frequent again. */
  bump(): void {
    this.active = Date.now();
  }

  private async read(): Promise<void> {
    clearTimeout(this.timer);
    try {
      const got = await this.b.read();
      this.offline = false;
      this.errors = 0;
      this.ok = true;
      this.newer += got.reduce((n, g) => n + g.newer, 0);
      const ops = got.flatMap((g) => g.ops);
      if (ops.length) {
        this.active = Date.now();
        this.deliver(ops);
      }
      if (this.b.moved) {
        // Another browser started a newer copy: bring over what it lacks.
        this.b.moved = false;
        const missing = this.o.allowed().filter((op) => !this.b.ids.has(op.body.id));
        if (missing.length) await this.b.post(missing).catch(() => {});
      }
      if (this.b.big && !this.rolling) void this.roll();
    } catch (e) {
      if (e instanceof Problem) this.problem = e.kind;
      else {
        this.offline = true;
        this.errors++;
      }
    }
    this.o.changed();
    if (!this.stopped && this.problem !== "gone") {
      const hidden = (globalThis as { document?: Document }).document?.visibilityState === "hidden";
      this.timer = setTimeout(
        () => void this.poll(),
        interval(Date.now() - this.active, hidden, this.errors),
      );
    }
  }

  /** Runs `fn` as the one sender in this browser: the Web Lock, or a random wait and a fresh read without it. */
  private lock<T>(fn: () => Promise<T>, hold = 0): Promise<T> {
    const name = this.o.lock;
    const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
    if (!name) return fn();
    if (!locks) return sleep(Math.random() * 5000, this.o.signal).then(fn);
    return new Promise<T>((resolve, reject) => {
      void locks
        .request(name, { signal: this.o.signal }, async () => {
          try {
            resolve(await fn());
          } catch (e) {
            reject(e);
          }
          await sleep(hold, this.o.signal);
        })
        .catch(reject);
    });
  }

  /** Posts as the one sender, turning a refusal into a problem and a delay. */
  private async guarded(post: () => Promise<void>): Promise<void> {
    try {
      await this.lock(post, this.o.gap);
      this.offline = false;
    } catch (e) {
      if (e instanceof RetryAfter) throw e;
      if (e instanceof Problem) {
        this.problem = e.kind;
        this.o.changed();
        throw new RetryAfter(3600);
      }
      this.offline = true;
      this.o.changed();
      throw e;
    }
  }

  async send(ops: readonly SignedOp[]): Promise<void> {
    if (this.problem) throw new RetryAfter(3600);
    this.bump();
    await this.guarded(async () => {
      await this.poll(); // what another tab or reviewer has already put there is not sent again
      const fresh = ops.filter((op) => !this.b.ids.has(op.body.id));
      if (!fresh.length) return;
      await this.b.post(fresh);
      for (const op of fresh) this.b.ids.add(op.body.id);
    });
  }

  /** Seals what is waiting ahead of time, so a closing page can send it at once (`flush`). */
  async prepare(ops: readonly SignedOp[]): Promise<void> {
    try {
      this.ready = ops.length && JSON.stringify(ops).length < 40_000 ? await this.b.req(ops) : null;
    } catch {
      this.ready = null;
    }
  }

  /** At `pagehide`: one keepalive request with what is pending, if it is under 64 KB. */
  flush(): void {
    const r = this.ready;
    this.ready = null;
    if (!r || this.problem || typeof r[1].body !== "string" || r[1].body.length > 64_000) return;
    (this.o.fetch ?? fetch)(r[0], { ...r[1], keepalive: true }).catch(() => {});
  }

  /** PrivateBin: a new generation when the paste has grown, after a random wait and a fresh read. */
  private async roll(): Promise<void> {
    this.rolling = true;
    try {
      await sleep(Math.random() * 30_000, this.o.signal);
      await this.guarded(async () => {
        await this.poll();
        if (!this.b.big || !this.b.roll) return;
        const got = await this.b.roll(this.o.allowed());
        const ops = got.flatMap((g) => g.ops);
        if (ops.length) this.deliver(ops);
      });
    } catch {
      /* tried again at a later read */
    } finally {
      this.rolling = false;
    }
  }
}
