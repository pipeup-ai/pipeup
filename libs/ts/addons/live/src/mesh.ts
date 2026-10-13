import type { Listener, SignedOp } from "pipeup";
import { fromText, idDigest, open, seal, toText, type Ladder } from "@pipeup/kit";

/** What the mesh needs of a document: Pipeup's own `PipeupDocument` has all of it. */
export interface MeshDoc {
  ops(): readonly SignedOp[];
  onChange(fn: Listener): () => void;
  /** Verifies and merges untrusted ops; resolves to how many were new. */
  merge(ops: readonly unknown[]): Promise<number>;
}

export interface MeshPeer {
  readonly id: string;
  /** Op ids this peer is known to hold: told, sent or received. */
  readonly has: Set<string>;
  send(data: string): void;
}

const MAX_FRAME = 2_000_000;
const MAX_IDS = 20_000;
const OUT_MS = 30;
const IN_MS = 100;
const BATCH = 50;
const CHUNK = 5000;

/**
 * Keeps one document in step with every peer it is given a channel to (add-ons design §9.3): ids are reconciled on
 * connect, new ops go to each peer lacking them (own, and ones received from another peer), nothing a peer sent is
 * trusted until the core's checks keep it, and an id the core refused is never offered or requested again.
 * It knows nothing of WebRTC: a channel is a function that sends a string.
 */
export class Mesh {
  readonly peers = new Map<string, MeshPeer>();
  /** Ids the core refused: never offered, forwarded or counted in a digest again this session. */
  readonly rejected = new Set<string>();
  private readonly out = new Map<string, SignedOp[]>();
  private inbound: unknown[] = [];
  private outTimer: ReturnType<typeof setTimeout> | undefined;
  private inTimer: ReturnType<typeof setTimeout> | undefined;
  private off: (() => void) | null = null;
  /** Ops that came from a newer Pipeup than this one: heard once, in words. */
  onNewer: (n: number) => void = () => {};

  constructor(
    private readonly doc: MeshDoc,
    private readonly ladder: Ladder,
  ) {}

  start(): void {
    this.off = this.doc.onChange((_t, added) => {
      for (const op of added) for (const p of this.peers.values()) this.queue(p, op);
    });
  }

  stop(): void {
    this.off?.();
    clearTimeout(this.outTimer);
    clearTimeout(this.inTimer);
    this.peers.clear();
  }

  /** Ids this browser holds and may offer. */
  private ids(): string[] {
    return this.doc
      .ops()
      .map((o) => o.body.id)
      .filter((i) => !this.rejected.has(i));
  }

  /** Begins reconciling with a peer whose channel is open and who has proved who they are. */
  async add(id: string, send: (data: string) => void): Promise<MeshPeer> {
    const peer: MeshPeer = { id, has: new Set(), send };
    this.peers.set(id, peer);
    peer.send(JSON.stringify({ t: "d", d: await idDigest(this.ids()) }));
    return peer;
  }

  drop(id: string): void {
    this.peers.delete(id);
    this.out.delete(id);
  }

  /** Queues an op for a peer that lacks it. */
  private queue(p: MeshPeer, op: SignedOp): void {
    const id = op.body.id;
    if (p.has.has(id) || this.rejected.has(id)) return;
    p.has.add(id);
    this.out.set(p.id, [...(this.out.get(p.id) ?? []), op]);
    this.outTimer ??= setTimeout(() => void this.flush(), OUT_MS);
  }

  private async flush(): Promise<void> {
    this.outTimer = undefined;
    for (const [id, ops] of [...this.out]) {
      this.out.delete(id);
      for (let i = 0; i < ops.length; i += BATCH) {
        const b = toText(await seal(this.ladder, "live", ops.slice(i, i + BATCH)));
        this.peers.get(id)?.send(JSON.stringify({ t: "o", b }));
      }
    }
  }

  /** Sends a peer what it lacks, the way a change is: through the same outgoing queue. */
  private offer(peer: MeshPeer, theirs: ReadonlySet<string>): void {
    for (const id of theirs) peer.has.add(id);
    for (const op of this.doc.ops()) this.queue(peer, op);
  }

  /**
   * Handles a frame from a peer. Returns false when it isn't one of the mesh's (presence, say), so the caller
   * can use it. Anything malformed is dropped as if it hadn't come.
   */
  async receive(id: string, raw: string): Promise<boolean> {
    const peer = this.peers.get(id);
    if (!peer || raw.length > MAX_FRAME) return false;
    let m: { t?: unknown; d?: unknown; i?: unknown; b?: unknown };
    try {
      m = JSON.parse(raw);
    } catch {
      return false;
    }
    if (m.t === "d" && typeof m.d === "string") {
      if (m.d === (await idDigest(this.ids()))) for (const i of this.ids()) peer.has.add(i);
      else peer.send(JSON.stringify({ t: "i", i: this.ids().slice(0, MAX_IDS) }));
    } else if (m.t === "i" && Array.isArray(m.i)) {
      this.offer(peer, new Set(m.i.slice(0, MAX_IDS).filter((i): i is string => typeof i === "string")));
    } else if (m.t === "o" && typeof m.b === "string") {
      const bytes = fromText(m.b);
      const opened = bytes && (await open(this.ladder, "live", bytes));
      if (!opened) return true;
      if (opened.newer) this.onNewer(opened.newer);
      for (const op of opened.ops) {
        const i = (op as { body?: { id?: unknown } } | null)?.body?.id;
        if (typeof i === "string") peer.has.add(i);
      }
      this.inbound.push(...opened.ops);
      this.inTimer ||= setTimeout(() => void this.drain(), IN_MS);
    } else return false;
    return true;
  }

  private async drain(): Promise<void> {
    this.inTimer = undefined;
    const ops = this.inbound.splice(0);
    const held = new Set(this.doc.ops().map((o) => o.body.id));
    const fresh = ops.filter((o) => !held.has((o as SignedOp)?.body?.id));
    for (let i = 0; i < fresh.length; i += CHUNK) {
      try {
        await this.doc.merge(fresh.slice(i, i + CHUNK));
      } catch (e) {
        // The core merged them but its store refused: shown, saved with the next change. Anything else is reported.
        if ((e as Error)?.name !== "UnsavedChangeError") globalThis.reportError?.(e);
      }
    }
    // Whatever was offered and isn't held now was refused: junk, another document, a bad signature, a newer version.
    const now = new Set(this.doc.ops().map((o) => o.body.id));
    for (const o of fresh) {
      const i = (o as SignedOp)?.body?.id;
      if (typeof i === "string" && !now.has(i)) this.rejected.add(i);
    }
  }
}
