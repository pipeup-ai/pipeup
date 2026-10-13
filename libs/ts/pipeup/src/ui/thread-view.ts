import { formatAgo } from "../export/format";
import { AI_NAME, isAiName, nameOf } from "../model/animals";
import type { Comment, Thread } from "../model/types";
import { avatar, easeIn, faceOf, retire } from "./animals";
import { composer } from "./composer";
import { clip, h, linkify, referenced } from "./dom";
import { icon, type IconName } from "./icons";
import { markAgain, threadMarks, threadNotes } from "./notes";
import { reactionRow, type ReactionPicker } from "./reactions";

export interface ThreadActions {
  /** This reviewer's key, to mark their own reactions. */
  readonly me: string;
  reply(parentId: string, text: string): Promise<void>;
  /** Gives (`on`) or takes back this reviewer's reaction to a comment. */
  react(commentId: string, emoji: string, on: boolean): Promise<void>;
  /** The full emoji picker, when an add-on provides one. */
  picker(): ReactionPicker | null;
  resolve(threadId: string): Promise<void>;
  reopen(threadId: string): Promise<void>;
  /** "Still not right" on an addressed thread: reopens it and puts the cursor in its reply line. */
  notRight(threadId: string): Promise<void>;
  copy(threadId: string): void;
  /** Esc in the reply line: closes the thread. */
  close(): void;
}

export interface ThreadViewOptions {
  variant: "column" | "popover";
  quote?: string | null;
  /** Snapshot of content that can't be shown: gone from the page, or somewhere it couldn't be reached. */
  lost?: string | null;
  /** Where that content is, when it isn't gone ("On slide 3"); default "No longer on the page". */
  place?: string | null;
  now?: () => number;
}

export const plural = (n: number) => `${n} ${n === 1 ? "reply" : "replies"}`;

export interface ThreadView {
  readonly element: HTMLElement;
  /** Shows a newer copy of the thread. The reply line is kept, so what's being typed in it (and focus) survives. */
  update(t: Thread, o?: { quote?: string | null; lost?: string | null; place?: string | null }): void;
}

/**
 * One thread: the words first; who, when and actions ease open beneath them on hover (always shown in a popover,
 * so its height never changes under the pointer). Replies sit one level
 * in beneath the comment, oldest first, and the thread ends with its reply line at the same indent.
 */
export function threadView(first: Thread, actions: ThreadActions, options: ThreadViewOptions): ThreadView {
  const o = { ...options };
  let id = first.id;
  const line = h(
    "div",
    { class: "rbox always" },
    h(
      "div",
      {},
      composer({
        label: "Reply",
        kind: "reply",
        thread: () => id,
        onSend: (text) => actions.reply(id, text),
        onCancel: actions.close,
      }).element,
    ),
  );
  const inner = h("div", {});
  const note = h(
    "span",
    { class: "note" },
    "This thread was resolved. Your words are kept until you send or clear them.",
  );
  note.hidden = true;
  line.prepend(note);
  let root: HTMLElement = h("div", {});
  let list: HTMLElement | null = null;
  let seen: HTMLElement | null = null;
  let addressed: HTMLElement | null = null;
  let addressedKey = "";
  const element = h("div", {}, root, h("div", { class: "more" }, inner));
  /**
   * Avatars by comment, with the face they show. Updates rebuild the comment's box, so the same avatar is
   * moved into the new one instead: it eases in once, when it first appears, and never again. When the face
   * changes (its writer added a name), the old one stays beneath until the new one has eased in over it.
   */
  /** Comments whose quick row of reactions is open, and the chips already shown (so only new ones ease in). */
  const quickOpen = new Set<string>();
  const reactionsSeen = new Set<string>();
  let current = first;
  let faces = new Map<string, { key: string; el: HTMLElement }>();
  let nextFaces = new Map<string, { key: string; el: HTMLElement }>();
  const leaving = new Map<string, HTMLElement>();
  const face = (c: Comment): HTMLElement[] => {
    const key = faceOf(c.author, c.name);
    const had = faces.get(c.id);
    let el = had?.el;
    if (!el || had!.key !== key) {
      el = easeIn(avatar(c.author, c.name));
      if (had) {
        const old = had.el;
        leaving.set(c.id, old);
        retire(old, () => leaving.get(c.id) === old && leaving.delete(c.id));
      }
    }
    el.title = nameOf(c);
    nextFaces.set(c.id, { key, el });
    const old = leaving.get(c.id);
    return old ? [old, el] : [el];
  };

  const button = (name: IconName, label: string, run: () => void) => {
    const b = h("button", { class: "ib", type: "button", "aria-label": label, title: label }, icon(name));
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });
    return b;
  };

  function update(
    t: Thread,
    next: { quote?: string | null; lost?: string | null; place?: string | null } = {},
  ): void {
    Object.assign(o, next);
    id = t.id;
    current = t;
    const now = (o.now ?? Date.now)();
    const n = t.root.replies.length;
    const who = (c: Comment) => h("span", { class: "who" }, `${nameOf(c)} · ${formatAgo(c.at, now)}`);
    const words = (c: Comment) =>
      h(
        "div",
        { class: c.deleted ? "tx del" : "tx" },
        ...(c.deleted
          ? ["Deleted"]
          : [...(isAiName(c.name) ? referenced(c.text) : linkify(c.text)), c.edited ? " (edited)" : ""]),
      );
    const reactions = (c: Comment) =>
      reactionRow(c, {
        me: actions.me,
        picker: actions.picker(),
        resolved: t.resolved,
        quick: quickOpen.has(c.id),
        seen: reactionsSeen,
        react: (emoji, on) => {
          quickOpen.delete(c.id);
          void actions.react(c.id, emoji, on);
          update(current);
        },
      });
    /** The button that opens the quick row; none on a resolved thread or a deleted comment. */
    const reactButton = (c: Comment) =>
      t.resolved || c.deleted
        ? null
        : button("smile", "React", () => {
            if (!quickOpen.delete(c.id)) quickOpen.add(c.id);
            update(current);
          });
    const restText = t.resolved
      ? "Resolved" + (n ? ` · ${plural(n)}` : "")
      : t.addressed
        ? "Addressed" + (n ? ` · ${plural(n)}` : "")
        : n
          ? plural(n)
          : "";
    const footer = h(
      "div",
      { class: o.variant === "column" ? (restText ? "ft has-rest" : "ft") : "ft open" },
      o.variant === "column" && restText ? h("span", { class: "rest" }, restText) : null,
      h(
        "span",
        { class: "hover" },
        who(t.root),
        h(
          "span",
          { class: "acts" },
          reactButton(t.root),
          button("copy", "Copy thread", () => actions.copy(t.id)),
          t.resolved
            ? button("reopen", "Reopen", () => void actions.reopen(t.id))
            : button("resolve", "Resolve", () => void actions.resolve(t.id)),
        ),
      ),
    );
    const context = o.lost
      ? h("div", { class: "ctx" }, `${o.place || "No longer on the page"} — it read “${clip(o.lost, 120)}”`)
      : o.quote
        ? h("div", { class: "ctx" }, `“${clip(o.quote, 80)}”`)
        : null;
    nextFaces = new Map();
    // Each comment keeps room for its avatar at the top right, so the words never move or narrow for it.
    const nextRoot = h(
      "div",
      { class: "root" },
      ...face(t.root),
      context,
      words(t.root),
      reactions(t.root),
      footer,
    );
    root.replaceWith(nextRoot);
    root = nextRoot;

    // Swap the comment and replies around the reply line; never rebuild the line itself.
    list?.remove();
    const writing = threadNotes.get(t.id);
    list =
      n || writing !== undefined
        ? h(
            "div",
            { class: "rps" },
            ...t.root.replies.map((c) =>
              h(
                "div",
                { class: "it" },
                ...face(c),
                words(c),
                reactions(c),
                h(
                  "div",
                  { class: o.variant === "column" ? "rft" : "rft open" },
                  h("span", { class: "rrow" }, who(c), h("span", { class: "acts" }, reactButton(c))),
                ),
              ),
            ),
            // A reply being written by an add-on (an AI's, streaming in): not a comment yet, so only shown.
            writing === undefined
              ? null
              : h(
                  "div",
                  { class: "it ghost", "data-pipeup-writing": "row" },
                  avatar("", AI_NAME),
                  h("div", { class: "tx", "data-pipeup-writing": "words" }, writing),
                  h("div", { class: "rft open" }, h("span", { class: "who" }, `${AI_NAME} · writing now`)),
                ),
          )
        : null;
    if (list) inner.prepend(list);
    // An agent says it dealt with this thread: its note, and two plain choices. A person still closes it.
    const open = t.addressed && !t.resolved ? t.addressed : null;
    const key = open ? `${open.text}|${open.author}|${open.at}` : "";
    if (key !== addressedKey) {
      addressed?.remove();
      addressed = null;
      addressedKey = key;
      if (open) {
        const choose = (label: string, run: () => void) => {
          const b = h("button", { type: "button" }, label);
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            run();
          });
          return b;
        };
        addressed = h(
          "div",
          { class: "adr" },
          h("small", {}, `Addressed · ${nameOf(open)} · ${formatAgo(open.at, now)}`),
          open.text,
          h(
            "div",
            { class: "go" },
            choose("Resolve", () => void actions.resolve(t.id)),
            choose("Still not right", () => void actions.notRight(t.id)),
          ),
        );
      }
    }
    if (addressed) inner.insertBefore(addressed, seen ?? (line.parentNode === inner ? line : null));
    // A quiet line from an add-on: it has looked at this thread (and had nothing to add, or is reading it now).
    seen?.remove();
    const mark = threadMarks.get(t.id);
    const again = markAgain.get(t.id);
    seen = mark === undefined ? null : h("div", { class: "seen" }, h("i"), mark);
    if (seen && again) {
      const b = h("button", { type: "button" }, "Check again");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        again();
      });
      seen.append(b);
    }
    if (seen) inner.insertBefore(seen, line.parentNode === inner ? line : null);
    faces = nextFaces;
    // Words half-written in the reply line are never lost: a thread resolved meanwhile (by anyone) keeps its line
    // until they are sent or cleared, with a plain sentence saying so.
    const held = line.querySelector("textarea")!.value.trim() !== "";
    note.hidden = !(t.resolved && held);
    if (t.resolved && !held) line.remove();
    else if (line.parentNode !== inner) inner.append(line);

    element.className = t.resolved ? "thread resolved" : "thread";
    element.setAttribute("data-thread", t.id);
  }

  update(first);
  return { element, update };
}
