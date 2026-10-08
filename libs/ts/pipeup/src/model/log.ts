import type { Identity } from "../crypto/identity";
import { foldThreads } from "./fold";
import { computeOpId } from "./opid";
import { isAuthentic, isWellFormed, MAX_AT, MAX_CLOCK, signOp } from "./ops";
import type { OpBody, OpKind, SignedOp, Thread } from "./types";

type Fields = Omit<OpBody, "v" | "id" | "doc" | "author" | "name" | "clock" | "at">;

/**
 * What a caller supplies for a new op. The id is always derived from the op's content, so callers
 * never choose it; a create starts its own thread, so it takes no `thread` either.
 */
export type NewOp =
  (Omit<Fields, "kind" | "thread"> & { kind: "create" }) | (Fields & { kind: Exclude<OpKind, "create"> });

/** The verified set of ops for one document, plus its Lamport clock. */
export class OpLog {
  private readonly ops = new Map<string, SignedOp>();
  private clock = 0;
  /** Latest `at` of each author's creates, and of each thread, so new ops follow what came before. */
  private readonly createAt = new Map<string, number>();
  private readonly threadAt = new Map<string, number>();

  constructor(readonly doc: string) {}

  get size(): number {
    return this.ops.size;
  }

  all(): SignedOp[] {
    return [...this.ops.values()];
  }

  threads(): Thread[] {
    return foldThreads(this.ops.values());
  }

  /**
   * Adds ops that are well formed, for this document, carry the id their content derives, are
   * authentically signed and are new. Returns those added.
   */
  async add(incoming: unknown[]): Promise<SignedOp[]> {
    const added: SignedOp[] = [];
    for (const raw of incoming) {
      if (!isWellFormed(raw) || raw.body.doc !== this.doc || this.ops.has(raw.body.id)) continue;
      if (raw.body.id !== (await computeOpId(raw.body)) || !(await isAuthentic(raw))) continue;
      // What was signed, nothing else: an unsigned extra field is never stored or sent on.
      const op: SignedOp = { body: raw.body, sig: raw.sig };
      this.ops.set(op.body.id, op);
      this.clock = Math.max(this.clock, op.body.clock);
      if (op.body.kind === "create")
        this.createAt.set(op.body.author, Math.max(this.createAt.get(op.body.author) ?? 0, op.body.at));
      this.threadAt.set(op.body.thread, Math.max(this.threadAt.get(op.body.thread) ?? 0, op.body.at));
      added.push(op);
    }
    return added;
  }

  /** Creates, signs and adds a new op written by `identity`. */
  async append(identity: Identity, name: string, fields: NewOp): Promise<SignedOp> {
    const body: OpBody = {
      v: 1,
      ...fields,
      id: "",
      thread: fields.kind === "create" ? "" : fields.thread,
      doc: this.doc,
      author: identity.publicKey,
      name,
      // Saturates at the cap; ties there are still totally ordered by time, author, then id. A peer that
      // reaches the cap can pin ordering there; Phase 2 relays may bound clocks by receive time.
      clock: Math.min(this.clock + 1, MAX_CLOCK),
      // A new thread is timed after its writer's previous thread; anything else after the latest op
      // in its thread, so it follows what it answers even when devices' clocks disagree. Threads fold
      // independently, so a far-future time only affects ordering inside its own thread. Capped like
      // the clock: at the cap ordering falls back to author and id, and writing never fails.
      at: Math.min(
        Math.max(
          Date.now(),
          fields.kind === "create"
            ? (this.createAt.get(identity.publicKey) ?? 0) + 1
            : (this.threadAt.get(fields.thread) ?? 0) + 1,
        ),
        MAX_AT,
      ),
    };
    // Safety net: identical changes would share an id, so nudge the time (below the cap) until the
    // id is new. Unreachable through PipeupDocument below the caps: its writes are serialised and
    // `at` strictly increases within each thread and across each writer's creates.
    for (let tries = 0; ; tries++) {
      if (tries === 1000) throw new Error("pipeup: could not record this change");
      body.id = await computeOpId(body);
      if (!this.ops.has(body.id) || body.at >= MAX_AT) break;
      body.at += 1;
    }
    // Same id means the same change is already recorded (e.g. resolving twice at both caps).
    const existing = this.ops.get(body.id);
    if (existing) return existing;
    if (body.kind === "create") body.thread = body.id;
    const [added] = await this.add([await signOp(body, identity)]);
    if (!added) throw new Error("pipeup: could not record this change");
    return added;
  }
}
