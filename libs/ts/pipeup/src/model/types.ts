export interface TextQuote {
  exact: string;
  prefix: string;
  suffix: string;
}

/** Everything needed to find a comment's content again. See design §3. */
export interface Anchor {
  /** data-pipeup-id of the nearest marked element, or of the element itself. */
  id?: string;
  /** CSS path from the marked element (or the page root) to the target element. '' means the base itself. */
  path: string;
  /** Commented text with surrounding context, for text comments. */
  quote?: TextQuote;
  /** Position inside the element as fractions of its box, for pins. */
  point?: { x: number; y: number };
  /** Where the reviewer was: slide ("1"-based), tab, route, plus anything the page reports. */
  view?: Record<string, string>;
  /** Fingerprint of the commented block's text when the comment was made. */
  fingerprint: string;
  /** A short plain-text excerpt of what the reviewer saw. */
  snapshot: string;
  /** What kind of thing it was on, so a look-alike can be found when the page changes. */
  kind?: AnchorKind;
  /** Its accessible name (a label, a picture's description or file name, a link's address), when it has one. */
  name?: string;
  /** The headings it sat under, outermost first. */
  heads?: string[];
  /** Where it was down the commentable area, 0 (top) to 1 (bottom). */
  y?: number;
  /** Someone said its place is gone: it is Lost on purpose and never re-found. */
  lost?: true;
}

export type AnchorKind = "h" | "p" | "img" | "button" | "link" | "field" | "media" | "box";

/** How a `place` op set a thread's place: kept where it was found, moved somewhere else, or gone. */
export type PlaceHow = "confirmed" | "moved" | "gone";

export type OpKind =
  | "create"
  | "reply"
  | "edit"
  | "delete"
  | "resolve"
  | "reopen"
  | "addressed"
  | "react"
  | "unreact"
  | "seen"
  | "contact"
  | "uncontact"
  | "place";

/** A person named in a comment's words: `text.slice(start, end)` is the "@Name"; `ref` says who (a key, or a supplied person). */
export interface Mention {
  start: number;
  end: number;
  ref: string;
}

export interface OpBody {
  v: 1;
  id: string;
  kind: OpKind;
  doc: string;
  /** Thread id: the id of the thread's create op. */
  thread: string;
  /** reply: the comment answered. edit/delete: the comment changed. react/unreact: the comment reacted to. */
  target?: string;
  /** The words; for react and unreact, the one emoji. */
  text?: string;
  /** create, reply and edit: the people named in the words. Signed with them, so it can't be altered. */
  mentions?: Mention[];
  /** create, and place (the thread's place from now on). */
  anchor?: Anchor;
  /** Author's public key. */
  author: string;
  /** Author's display name when the op was made; "" until they add one. */
  name: string;
  /** Lamport clock. */
  clock: number;
  /** Wall-clock ms, for display only. */
  at: number;
}

export interface SignedOp {
  body: OpBody;
  sig: string;
}

export interface Comment {
  id: string;
  author: string;
  /** The writer's name: the one on the comment, else the latest they used here; "" while they have none. */
  name: string;
  /** The comment's own op carried no name (so `name`, if any, was filled in from the writer's others). */
  unnamed?: true;
  text: string;
  at: number;
  edited: boolean;
  deleted: boolean;
  replies: Comment[];
  /** Emoji people reacted with, in the order they first appeared; none for a comment nobody reacted to. */
  reactions: Reaction[];
  /** Another person in the document has the same name: show this writer's short tag too. */
  alike?: true;
  /** The people named in the words; absent when none. */
  mentions?: Mention[];
  /** The writers who have marked this comment seen (their `seen` ops); absent when none. */
  seenBy?: string[];
}

export interface Reaction {
  emoji: string;
  /** Who gave it, in the order they did; the name is "" for someone who hasn't added one. */
  by: { author: string; name: string; alike?: true }[];
}

export interface Thread {
  id: string;
  anchor: Anchor;
  root: Comment;
  resolved: boolean;
  /** An agent has said it dealt with this thread. Not resolved: a person closes it, and reopening clears it. */
  addressed?: { text: string; author: string; name: string; at: number };
  /** Someone set this thread's place since it was made (the latest `place`); `anchor` is then that place. */
  placed?: { how: PlaceHow; author: string; name: string; at: number };
}
