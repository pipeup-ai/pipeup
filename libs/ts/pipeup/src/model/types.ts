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
}

export type OpKind = "create" | "reply" | "edit" | "delete" | "resolve" | "reopen";

export interface OpBody {
  v: 1;
  id: string;
  kind: OpKind;
  doc: string;
  /** Thread id: the id of the thread's create op. */
  thread: string;
  /** reply: the comment answered. edit/delete: the comment changed. */
  target?: string;
  text?: string;
  /** create only. */
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
}

export interface Thread {
  id: string;
  anchor: Anchor;
  root: Comment;
  resolved: boolean;
}
