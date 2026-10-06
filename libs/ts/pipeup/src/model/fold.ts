import { compareOps } from "./ops";
import type { Comment, SignedOp, Thread } from "./types";

interface Entry {
  comment: Comment;
  thread: string;
}

/**
 * Turns ops into threads. Deterministic: peers holding the same ops see the same threads,
 * whatever order the ops arrived in. Assumes ops are already well formed and authentic.
 */
export function foldThreads(ops: Iterable<SignedOp>): Thread[] {
  const threads = new Map<string, Thread>();
  const entries = new Map<string, Entry>();
  /** Each writer's latest name, for their comments written before they added one. */
  const names = new Map<string, string>();

  for (const { body: o } of [...ops].sort(compareOps)) {
    if (o.name) names.set(o.author, o.name);
    if (o.kind === "create") {
      if (threads.has(o.id) || !o.anchor || o.text === undefined) continue;
      const root = newComment(o.id, o.author, o.name, o.text, o.at);
      threads.set(o.id, { id: o.id, anchor: o.anchor, root, resolved: false });
      entries.set(o.id, { comment: root, thread: o.id });
      continue;
    }

    const thread = threads.get(o.thread);
    if (!thread) continue;
    if (o.kind === "resolve" || o.kind === "reopen") {
      thread.resolved = o.kind === "resolve";
      continue;
    }

    const target = o.target ? entries.get(o.target) : undefined;
    if (!target || target.thread !== o.thread) continue;

    if (o.kind === "reply") {
      if (entries.has(o.id) || o.text === undefined) continue;
      const comment = newComment(o.id, o.author, o.name, o.text, o.at);
      // One level: every reply joins the comment's list, in order, whichever comment it answered.
      thread.root.replies.push(comment);
      entries.set(o.id, { comment, thread: o.thread });
      continue;
    }

    if (o.author !== target.comment.author || target.comment.deleted) continue;
    if (o.kind === "edit" && o.text !== undefined) {
      target.comment.text = o.text;
      target.comment.edited = true;
    }
    if (o.kind === "delete") {
      target.comment.text = "";
      target.comment.deleted = true;
    }
  }

  for (const { comment: c } of entries.values())
    if (!c.name) {
      c.unnamed = true;
      c.name = names.get(c.author) ?? "";
    }
  return [...threads.values()];
}

function newComment(id: string, author: string, name: string, text: string, at: number): Comment {
  return { id, author, name, text, at, edited: false, deleted: false, replies: [] };
}
