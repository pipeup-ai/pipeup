import { sign as signBytes, type Identity } from "./crypto/identity";
import { OpLog, type NewOp } from "./model/log";
import { agentName, isAiName } from "./model/animals";
import { compareOps, CONTACT, isEmoji, LIMITS, MAX_TEXT } from "./model/ops";
import type { Anchor, Comment, Mention, SignedOp, Thread } from "./model/types";
import { readFeedbackFile, writeFeedbackFile } from "./storage/feedback-file";
import type { OpStore } from "./storage/store";
import { fromB64u, utf8 } from "./util/encoding";

export interface OpenOptions {
  doc: string;
  key: CryptoKey | null;
  store: OpStore;
  identity: Identity;
  /** The reviewer's name; "" until they add one (they show as their animal). */
  name: string;
}

/** `added`: the ops behind the change ([] for a rename). `source`: "local", "file", an add-on's id, or "" (a rename). */
export type Listener = (threads: Thread[], added: readonly SignedOp[], source: string) => void;

const MAX_MERGE = 5000;
const PURPOSE = /^[a-z][a-z0-9-]{1,23}\/[a-z][a-z0-9-]{0,31}$/;

const MAX_NAME = 80;

/** The change is recorded and shown, but the store refused it; it is saved with the next change. */
export class UnsavedChangeError extends Error {
  constructor(
    readonly id: string,
    readonly cause: unknown,
    /** How many changes were recorded but not saved (an import can carry several). */
    readonly count = 1,
  ) {
    super("pipeup: shown here, but not saved yet");
    this.name = "UnsavedChangeError";
  }
}

/** One document's comments for one reviewer: what the UI and CLI build on. */
export class PipeupDocument {
  private readonly listeners = new Set<Listener>();
  private cache: Thread[] = [];
  private readonly comments = new Map<string, { comment: Comment; thread: string }>();
  private displayName: string;
  private queue: Promise<unknown> = Promise.resolve();
  private unsaved: SignedOp[] = [];

  private constructor(
    private readonly log: OpLog,
    private readonly options: OpenOptions,
  ) {
    this.displayName = options.name.trim() ? checkName(options.name) : "";
  }

  static async open(options: OpenOptions): Promise<PipeupDocument> {
    if (typeof options.doc !== "string" || options.doc === "" || options.doc.length > LIMITS.doc)
      throw new Error(`pipeup: the document id must be 1 to ${LIMITS.doc} characters`);
    const log = new OpLog(options.doc);
    const saved = await options.store.load(options.doc);
    const unread = saved.length - (await log.add(saved)).length;
    if (unread)
      console.warn(
        `pipeup: ${unread} saved change${unread === 1 ? "" : "s"} on this page couldn't be read; kept as saved`,
      );
    const doc = new PipeupDocument(log, options);
    doc.refresh(false);
    return doc;
  }

  get id(): string {
    return this.options.doc;
  }

  get me(): string {
    return this.options.identity.publicKey;
  }

  get name(): string {
    return this.displayName;
  }

  /** Names new comments, and this reviewer's earlier unnamed ones, which listeners hear about. */
  set name(value: string) {
    this.displayName = checkName(value);
    this.refresh(true, [], "");
  }

  threads(): readonly Thread[] {
    return this.cache;
  }

  /** Every verified op this browser holds, as {body, sig}. A new array each call; don't change the ops. */
  ops(): readonly SignedOp[] {
    return this.log.all();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  comment(anchor: Anchor, text: string, mentions?: Mention[]): Promise<string> {
    return this.enqueue(() =>
      this.write({
        kind: "create",
        anchor,
        text: checkText(text),
        ...(mentions?.length ? { mentions } : {}),
      }),
    );
  }

  reply(parentId: string, text: string, mentions?: Mention[]): Promise<string> {
    return this.enqueue(() =>
      this.write({
        kind: "reply",
        thread: this.find(parentId).thread,
        target: parentId,
        text: checkText(text),
        ...(mentions?.length ? { mentions } : {}),
      }),
    );
  }

  edit(commentId: string, text: string, mentions?: Mention[]): Promise<void> {
    return this.enqueue(async () => {
      const { thread } = this.mine(commentId);
      await this.write({
        kind: "edit",
        thread,
        target: commentId,
        text: checkText(text),
        ...(mentions?.length ? { mentions } : {}),
      });
    });
  }

  remove(commentId: string): Promise<void> {
    return this.enqueue(async () => {
      const { thread } = this.mine(commentId);
      await this.write({ kind: "delete", thread, target: commentId });
    });
  }

  /** Shares a way to reach this reviewer (an email address, or `gh:<GitHub name>`) with everyone who has the comments. */
  contact(value: string): Promise<void> {
    const text = value.trim();
    if (!CONTACT.test(text))
      return Promise.reject(new Error("pipeup: that isn't an email address or a GitHub name"));
    return this.enqueue(async () => void (await this.write({ kind: "contact", thread: this.me, text })));
  }

  /** Stops sharing it: people who learn of this later won't see it. */
  uncontact(): Promise<void> {
    return this.enqueue(async () => void (await this.write({ kind: "uncontact", thread: this.me })));
  }

  /** The ways people have chosen to be reached, by writer: the latest each shared, unless they stopped sharing. */
  contacts(): Map<string, string> {
    const out = new Map<string, string>();
    for (const { body } of [...this.log.all()].sort(compareOps)) {
      if (body.kind === "contact" && body.text) out.set(body.author, body.text);
      else if (body.kind === "uncontact") out.delete(body.author);
    }
    return out;
  }

  /** This reviewer's identity was made portable, so it has a recovery code (an ordinary one can't leave the browser). */
  get portable(): boolean {
    return this.options.identity.privateKey.extractable;
  }

  /** The 32-byte seed of a portable identity, for backing it up; null for an ordinary one. */
  async seed(): Promise<Uint8Array | null> {
    const key = this.options.identity.privateKey;
    if (!key.extractable) return null;
    const { d } = await crypto.subtle.exportKey("jwk", key);
    return d ? fromB64u(d) : null;
  }

  /** Marks comments read by this reviewer (one `seen` op each, for those not already marked), so every device knows. */
  seen(commentIds: readonly string[]): Promise<void> {
    return this.enqueue(async () => {
      for (const id of commentIds) {
        const found = this.comments.get(id);
        if (found && !found.comment.seenBy?.includes(this.me))
          await this.write({ kind: "seen", thread: found.thread, target: id });
      }
    });
  }

  /** Reacts to a comment with one emoji; reacting twice with the same emoji changes nothing. */
  react(commentId: string, emoji: string): Promise<void> {
    return this.enqueue(async () => {
      await this.write({
        kind: "react",
        thread: this.find(commentId).thread,
        target: commentId,
        text: checkEmoji(emoji),
      });
    });
  }

  /** Takes back this reviewer's own reaction. */
  unreact(commentId: string, emoji: string): Promise<void> {
    return this.enqueue(async () => {
      await this.write({
        kind: "unreact",
        thread: this.find(commentId).thread,
        target: commentId,
        text: checkEmoji(emoji),
      });
    });
  }

  resolve(threadId: string): Promise<void> {
    return this.enqueue(async () => {
      await this.write({ kind: "resolve", thread: this.thread(threadId) });
    });
  }

  reopen(threadId: string): Promise<void> {
    return this.enqueue(async () => {
      await this.write({ kind: "reopen", thread: this.thread(threadId) });
    });
  }

  /**
   * Adds an agent's reply the reviewer pasted, to the thread's first comment: signed by this reviewer, under the agent's
   * name ("AI assistant · Muse"), so it is drawn as an AI's and says who put it here. With `note`, also marks the thread
   * addressed. It never resolves, reopens, edits or deletes.
   */
  paste(threadId: string, agent: string, text: string, note?: string): Promise<void> {
    return this.enqueue(async () => {
      const thread = this.thread(threadId);
      const name = agentName(agent);
      const target = this.cache.find((t) => t.id === thread)!.root.id;
      await this.write({ kind: "reply", thread, target, text: checkText(text) }, name);
      if (note?.trim()) await this.write({ kind: "addressed", thread, text: checkText(note) }, name);
    });
  }

  /**
   * Signs `data` for `purpose` ("<add-on id>/<name>") with this reviewer's identity, as base64url. The signed
   * text starts "pipeup:", never "{", so it can never verify as an op.
   */
  sign(purpose: string, data: string): Promise<string> {
    if (!PURPOSE.test(purpose)) throw new Error('pipeup: a signing purpose looks like "<add-on id>/<name>"');
    return signBytes(this.options.identity, utf8(`pipeup:${purpose}\n${data}`));
  }

  /** Saves any changes the store has not yet accepted. Rejects while the store still fails. */
  flush(): Promise<void> {
    return this.enqueue(() => this.persist());
  }

  /** Everything this browser knows about the document, sealed when the page has a key. */
  exportFile(): Promise<string> {
    return writeFeedbackFile(this.options.doc, this.log.all(), this.options.key);
  }

  /**
   * Merges a feedback file. Returns how many new, authentic changes it contained.
   * Throws UnsavedChangeError (id of the first added change) if they were applied but the store refused them.
   */
  async importFile(json: string): Promise<number> {
    return this.merge(await readFeedbackFile(json, this.options.doc, this.options.key), "file");
  }

  /**
   * Verifies and merges ops from elsewhere, exactly as a feedback file's are; resolves to how many were new.
   * Listeners hear once per call, only if something was added. More than 5,000 ops rejects with a RangeError.
   */
  merge(ops: readonly unknown[], source: string): Promise<number> {
    if (ops.length > MAX_MERGE)
      return Promise.reject(new RangeError("pipeup: too many changes to merge at once"));
    return this.enqueue(async () => {
      const added = await this.log.add([...ops]);
      this.unsaved.push(...added);
      if (added.length > 0) this.refresh(true, added, source);
      try {
        await this.persist();
      } catch (error) {
        if (added.length > 0) throw new UnsavedChangeError(added[0]!.body.id, error, added.length);
        throw error;
      }
      return added.length;
    });
  }

  /** Runs one change at a time, in call order; a failed call does not stop later ones. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Records a change and returns its id. */
  private async write(fields: NewOp, name = this.displayName): Promise<string> {
    const op = await this.log.append(this.options.identity, name, fields);
    this.unsaved.push(op);
    this.refresh(true, [op], "local");
    try {
      await this.persist();
    } catch (error) {
      throw new UnsavedChangeError(op.body.id, error);
    }
    return op.body.id;
  }

  /** Hands every unsaved change to the store; they stay unsaved if it fails. */
  private async persist(): Promise<void> {
    if (this.unsaved.length === 0) return;
    const pending = [...this.unsaved];
    await this.options.store.append(this.options.doc, pending);
    this.unsaved = this.unsaved.filter((op) => !pending.includes(op));
  }

  private refresh(notify: boolean, added: readonly SignedOp[] = [], source = ""): void {
    this.cache = this.log.threads();
    this.comments.clear();
    const walk = (c: Comment, thread: string) => {
      // Your own unnamed comments show your current name, newer than any your earlier ones carried.
      if (c.unnamed && c.author === this.me && this.displayName) c.name = this.displayName;
      this.comments.set(c.id, { comment: c, thread });
      for (const r of c.replies) walk(r, thread);
    };
    for (const t of this.cache) walk(t.root, t.id);
    if (!notify) return;
    for (const fn of this.listeners) {
      try {
        fn(this.cache, added, source);
      } catch (error) {
        // A broken listener must not stop the change being saved or the other listeners hearing of it.
        // Browsers show reported errors in the console; nothing is sent anywhere.
        globalThis.reportError?.(error);
      }
    }
  }

  private find(commentId: string): { comment: Comment; thread: string } {
    const found = this.comments.get(commentId);
    if (!found) throw new Error("pipeup: there is no comment with that id");
    return found;
  }

  private mine(commentId: string): { comment: Comment; thread: string } {
    const found = this.find(commentId);
    if (found.comment.author !== this.me) throw new Error("pipeup: only the writer can change a comment");
    return found;
  }

  private thread(threadId: string): string {
    if (!this.cache.some((t) => t.id === threadId))
      throw new Error("pipeup: there is no thread with that id");
    return threadId;
  }
}

function checkText(text: string): string {
  const t = text.trim();
  if (!t) throw new Error("pipeup: a comment needs some words");
  if (t.length > MAX_TEXT) throw new Error(`pipeup: comments are limited to ${MAX_TEXT} characters`);
  return t;
}

function checkEmoji(emoji: string): string {
  if (!isEmoji(emoji)) throw new Error("pipeup: a reaction is one emoji");
  return emoji;
}

function checkName(name: string): string {
  // One line: a pasted newline or tab can't split a name.
  const n = name.replace(/\s+/g, " ").trim();
  if (!n || n.length > MAX_NAME) throw new Error(`pipeup: choose a name of 1 to ${MAX_NAME} characters`);
  if (isAiName(n)) throw new Error("pipeup: that name is kept for AI replies; choose another");
  return n;
}
