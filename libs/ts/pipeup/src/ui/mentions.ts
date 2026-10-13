import { isAiName, nameOf } from "../model/animals";
import type { Comment, Mention, Thread } from "../model/types";

/** Someone who can be mentioned: `ref` says who (a writer's key, or `host:<id>` / `gh:<name>` for a supplied person). */
export interface Person {
  ref: string;
  name: string;
  /** An AI agent. */
  agent?: boolean;
}

const KEY = /^[A-Za-z0-9_-]{43}$/;
const SUPPLIED = /^(?:host|gh):[A-Za-z0-9._@-]{1,64}$/;
let supplied: Person[] = [];
const changes = new Set<() => void>();

/** People the page or an add-on supplies (a company's directory, a repository's members), shown in the `@` list. */
export function setPeople(list: readonly Person[]): void {
  supplied = list
    .filter((p) => p && typeof p.name === "string" && p.name.trim() && SUPPLIED.test(p.ref))
    .slice(0, 500)
    .map((p) => ({ ref: p.ref, name: p.name.trim().slice(0, 80), ...(p.agent ? { agent: true } : {}) }));
  for (const fn of [...changes]) fn();
}
export const heardPeople = (fn: () => void): (() => void) => (changes.add(fn), () => void changes.delete(fn));

/** The agents the author lists on the page: `<html data-pipeup-agents="<key> <key>">`. */
const listedAgents = (): string[] =>
  (document.documentElement.getAttribute("data-pipeup-agents") ?? "")
    .split(/[\s,]+/)
    .filter((k) => KEY.test(k));

/**
 * Everyone who can be mentioned here: the people who have commented or reacted in this document, the agents the page
 * lists, and the people the page or an add-on supplied; not this reviewer. A person comes once.
 */
export function peopleFor(threads: readonly Thread[], me: string): Person[] {
  const found = new Map<string, Person>();
  const add = (p: Person) => {
    if (p.ref !== me && !found.has(p.ref)) found.set(p.ref, p);
  };
  const seeWriter = (c: Pick<Comment, "author" | "name" | "alike">) =>
    add({ ref: c.author, name: nameOf(c), ...(isAiName(c.name) ? { agent: true } : {}) });
  for (const t of threads)
    for (const c of [t.root, ...t.root.replies]) {
      if (c.deleted) continue;
      seeWriter(c);
      for (const r of c.reactions) for (const b of r.by) seeWriter({ ...b });
    }
  for (const key of listedAgents()) add({ ref: key, name: "AI agent", agent: true });
  for (const p of supplied) add(p);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The `@name` being typed at the end of `before`: where it starts and what has been typed after the `@`. */
export function mentionToken(before: string): { start: number; query: string } | null {
  const m = /(^|\s)@([^\s@]*(?:\s[^\s@]*)?)$/.exec(before);
  return m ? { start: m.index + m[1]!.length, query: m[2]! } : null;
}

/** The people matching what was typed: names that start with it first, then names that contain it. */
export function filterPeople(list: readonly Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  const starts = list.filter((p) => p.name.toLowerCase().startsWith(q));
  const rest = q ? list.filter((p) => !starts.includes(p) && p.name.toLowerCase().includes(q)) : [];
  return [...starts, ...rest].slice(0, 8);
}

/**
 * Where each chosen person is still named in the final words. A person whose `@Name` was edited away is no longer
 * mentioned; the same name twice takes its places in the order chosen.
 */
export function locate(text: string, chosen: readonly { label: string; ref: string }[]): Mention[] {
  const used: Mention[] = [];
  for (const c of chosen) {
    const needle = `@${c.label}`;
    let from = 0;
    for (;;) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const clear =
        (at === 0 || /\s/.test(text[at - 1]!)) && (end === text.length || !/[\p{L}\p{N}_]/u.test(text[end]!));
      if (clear && !used.some((u) => at < u.end && end > u.start)) {
        used.push({ start: at, end, ref: c.ref });
        break;
      }
      from = at + 1;
    }
  }
  return used.sort((a, b) => a.start - b.start).slice(0, 20);
}

/** Whether a comment names any of `refs`. */
export const names = (c: Comment, refs: readonly string[]): boolean =>
  !!c.mentions?.some((m) => refs.includes(m.ref));

let signedIn: string[] = [];
/** Who the page says this reviewer is (`host:<id>`), so comments naming them there count as naming this reviewer. */
export function setIdentity(who: { id: string } | null): void {
  signedIn = who && /^[A-Za-z0-9._@-]{1,64}$/.test(who.id) ? [`host:${who.id}`] : [];
}
/** Every way a comment can name this reviewer: their key, and the page's own name for them. */
export const myRefs = (me: string): string[] => [me, ...signedIn];

/** Comments by others that name this reviewer and that they haven't marked seen, with their threads. */
export function unseenMentions(
  threads: readonly Thread[],
  me: string,
): { thread: Thread; comment: Comment }[] {
  const refs = myRefs(me);
  const out: { thread: Thread; comment: Comment }[] = [];
  for (const t of threads)
    for (const c of [t.root, ...t.root.replies])
      if (c.author !== me && !c.deleted && names(c, refs) && !c.seenBy?.includes(me))
        out.push({ thread: t, comment: c });
  return out;
}

/** Whether a thread has a comment by someone else naming this reviewer. */
export const mentionsMe = (t: Thread, me: string): boolean =>
  [t.root, ...t.root.replies].some((c) => c.author !== me && !c.deleted && names(c, myRefs(me)));
