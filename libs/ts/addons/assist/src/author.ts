/** The assistant's own signing key, and its replies as ordinary signed ops (so they are shared and exported like any). */
import type { Identity, OpBody, SignedOp, Thread } from "pipeup";

/** What this add-on borrows from the core's global, which is loaded before any add-on. */
export interface Core {
  createIdentity(): Promise<Identity>;
  computeOpId(body: OpBody): Promise<string>;
  signOp(body: OpBody, identity: Identity): Promise<SignedOp>;
  resolveAnchor(
    a: Thread["anchor"],
    root: Element,
    o?: { fuzzy?: boolean },
  ): { element: Element | null; range: Range | null };
}
export const core = (): Partial<Core> => (globalThis as { Pipeup?: Partial<Core> }).Pipeup ?? {};

/** The name its replies carry: the core keeps it for AI replies and draws them with the glowing ring. */
export const NAME = "AI assistant (on this device)";

/** A reply to a thread, signed by the assistant's key; it follows the latest op in the thread. */
export async function replyOp(
  c: Core,
  who: Identity,
  doc: string,
  t: Thread,
  text: string,
  ops: readonly SignedOp[],
): Promise<SignedOp> {
  let clock = 0;
  let latest = 0;
  for (const o of ops) {
    clock = Math.max(clock, o.body.clock);
    if (o.body.thread === t.id) latest = Math.max(latest, o.body.at);
  }
  const body: OpBody = {
    v: 1,
    id: "",
    kind: "reply",
    doc,
    thread: t.id,
    target: t.root.id,
    text,
    author: who.publicKey,
    name: NAME,
    clock: clock + 1,
    at: Math.max(Date.now(), latest + 1),
  };
  body.id = await c.computeOpId(body);
  return c.signOp(body, who);
}
