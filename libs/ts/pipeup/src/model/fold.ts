import { nameOf } from "./animals";
import { compareOps } from "./ops";
import type { Comment, Mention, SignedOp, Thread } from "./types";

/** At most this many different emoji on one comment, so a comment can't be flooded; later ones are ignored. */
export const MAX_REACTIONS = 12;

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
      const root = newComment(o.id, o.author, o.name, o.text, o.at, o.mentions);
      threads.set(o.id, { id: o.id, anchor: o.anchor, root, resolved: false });
      entries.set(o.id, { comment: root, thread: o.id });
      continue;
    }

    const thread = threads.get(o.thread);
    if (!thread) continue;
    if (o.kind === "resolve" || o.kind === "reopen") {
      thread.resolved = o.kind === "resolve";
      if (o.kind === "reopen") delete thread.addressed;
      continue;
    }
    if (o.kind === "addressed") {
      if (o.text !== undefined) thread.addressed = { text: o.text, author: o.author, name: o.name, at: o.at };
      continue;
    }

    const target = o.target ? entries.get(o.target) : undefined;
    if (!target || target.thread !== o.thread) continue;

    if (o.kind === "reply") {
      if (entries.has(o.id) || o.text === undefined) continue;
      const comment = newComment(o.id, o.author, o.name, o.text, o.at, o.mentions);
      // One level: every reply joins the comment's list, in order, whichever comment it answered.
      thread.root.replies.push(comment);
      entries.set(o.id, { comment, thread: o.thread });
      continue;
    }

    if (o.kind === "seen") {
      const seen = (target.comment.seenBy ??= []);
      if (!seen.includes(o.author)) seen.push(o.author);
      continue;
    }

    if (o.kind === "react" || o.kind === "unreact") {
      if (o.text === undefined || target.comment.deleted) continue;
      const list = target.comment.reactions;
      const mine = list.find((r) => r.emoji === o.text);
      if (o.kind === "react") {
        const by = { author: o.author, name: o.name };
        if (!mine) {
          if (list.length < MAX_REACTIONS) list.push({ emoji: o.text, by: [by] });
        } else if (!mine.by.some((x) => x.author === o.author)) mine.by.push(by);
      } else if (mine) {
        mine.by = mine.by.filter((x) => x.author !== o.author);
        if (!mine.by.length) list.splice(list.indexOf(mine), 1);
      }
      continue;
    }

    if (o.author !== target.comment.author || target.comment.deleted) continue;
    if (o.kind === "edit" && o.text !== undefined) {
      target.comment.text = o.text;
      target.comment.edited = true;
      if (o.mentions) target.comment.mentions = o.mentions;
      else delete target.comment.mentions;
    }
    if (o.kind === "delete") {
      target.comment.text = "";
      target.comment.deleted = true;
      target.comment.reactions = [];
      delete target.comment.mentions;
    }
  }

  for (const { comment: c } of entries.values()) {
    if (!c.name) {
      c.unnamed = true;
      c.name = names.get(c.author) ?? "";
    }
    for (const r of c.reactions) for (const b of r.by) b.name ||= names.get(b.author) ?? "";
  }
  // Two people with one name: each shows with a short tag, so they can be told apart.
  const writers = new Map<string, Set<string>>();
  const note = (author: string, name: string) => {
    const shown = nameOf({ author, name }).toLowerCase();
    (writers.get(shown) ?? writers.set(shown, new Set()).get(shown)!).add(author);
  };
  for (const { comment: c } of entries.values()) {
    note(c.author, c.name);
    for (const r of c.reactions) for (const b of r.by) note(b.author, b.name);
  }
  const alike = (author: string, name: string) =>
    (writers.get(nameOf({ author, name }).toLowerCase())?.size ?? 0) > 1;
  for (const { comment: c } of entries.values()) {
    if (alike(c.author, c.name)) c.alike = true;
    for (const r of c.reactions) for (const b of r.by) if (alike(b.author, b.name)) b.alike = true;
  }
  return [...threads.values()];
}

function newComment(
  id: string,
  author: string,
  name: string,
  text: string,
  at: number,
  mentions?: Mention[],
): Comment {
  const c: Comment = {
    id,
    author,
    name,
    text,
    at,
    edited: false,
    deleted: false,
    replies: [],
    reactions: [],
  };
  if (mentions?.length) c.mentions = mentions;
  return c;
}
