import type { SignedOp } from "pipeup";

/** What share remembers about one document: only op ids and choices, never a secret. */
export interface Saved {
  init: boolean;
  held: Iterable<string>;
  kept: Iterable<string>;
  recv: Iterable<string>;
  send: boolean;
  noted: boolean;
  gen: string | null;
}

/** What an agent may write: its replies, addressed notes and reactions. */
const AGENT_KINDS = new Set(["reply", "addressed", "react", "unreact"]);

/** The agents the page lists: `<html data-pipeup-agents="<key> <key>">`. */
export const listedAgents = (): string[] =>
  (globalThis.document?.documentElement.getAttribute("data-pipeup-agents") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);

/**
 * Whose comments are sent (add-ons design §7.3): this reviewer's own, plus ops received from the shared copy, plus
 * the replies of an agent the page lists, which the agent signed (spec §11).
 * Comments written before sharing began are held until the reviewer chooses; comments written while "Send my
 * comments" is off are kept; an edit, reply or delete follows the comment it changes.
 */
export class Policy {
  readonly held: Set<string>;
  readonly kept: Set<string>;
  readonly recv: Set<string>;
  send: boolean;
  noted: boolean;
  gen: string | null;
  init: boolean;

  constructor(
    private readonly me: string,
    s?: Partial<Saved>,
    private readonly agents: () => readonly string[] = () => [],
  ) {
    this.held = new Set(s?.held);
    this.kept = new Set(s?.kept);
    this.recv = new Set(s?.recv);
    this.send = s?.send ?? true;
    this.noted = s?.noted ?? false;
    this.gen = s?.gen ?? null;
    this.init = s?.init ?? false;
  }

  /** First setup for a document: this reviewer's earlier ops are held. */
  hold(ops: readonly SignedOp[]): void {
    if (this.init) return;
    this.init = true;
    for (const { body } of ops) if (body.author === this.me) this.held.add(body.id);
  }

  /** May this op be in the shared copy? Records which side a new op of mine falls on. */
  sendable(op: SignedOp): boolean {
    const b = op.body;
    if (this.recv.has(b.id)) return true;
    // A listed agent's answer goes while this reviewer is sending, and waits with a comment they haven't shared.
    if (AGENT_KINDS.has(b.kind) && this.agents().includes(b.author))
      return this.send && ![b.target, b.thread].some((x) => x && (this.held.has(x) || this.kept.has(x)));
    if (b.author !== this.me || this.held.has(b.id) || this.kept.has(b.id)) return false;
    const parent = [b.target, b.thread].find((x) => x && (this.held.has(x) || this.kept.has(x)));
    if (parent) (this.held.has(parent) ? this.held : this.kept).add(b.id);
    else if (!this.send) this.kept.add(b.id);
    else {
      if (b.kind === "create" || b.kind === "reply") this.noted = true;
      return true;
    }
    return false;
  }

  /** The reviewer's choice about earlier comments. */
  decide(share: boolean): void {
    if (!share) for (const id of this.held) this.kept.add(id);
    this.held.clear();
  }
}
