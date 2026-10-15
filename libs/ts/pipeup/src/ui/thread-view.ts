import { formatAgo } from "../export/format";
import { AI_NAME, isAiName, nameOf } from "../model/animals";
import type { Comment, Mention, Thread } from "../model/types";
import { avatar, easeIn, faceOf, retire } from "./animals";
import { composer } from "./composer";
import { clip, h, linkify, referenced } from "./dom";
import { icon, type IconName } from "./icons";
import { markAgain, threadMarks, threadNotes } from "./notes";
import { names, type Person } from "./mentions";
import { reactionRow, type ReactionPicker } from "./reactions";

export interface ThreadActions {
  /** This reviewer's key, to mark their own reactions. */
  readonly me: string;
  reply(parentId: string, text: string, mentions?: Mention[]): Promise<void>;
  /** Changes the words of one of this reviewer's comments. */
  edit(commentId: string, text: string, mentions?: Mention[]): Promise<void>;
  /** Deletes one of this reviewer's comments. */
  remove(commentId: string): Promise<void>;
  /** Who can be mentioned with `@` in a reply. */
  people(): Person[];
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
 * One thread, as a compact card: who and how long ago, then the words; its actions sit at the top right (on hover,
 * and always when open). Replies sit one level in beneath the comment, oldest first, and the thread ends with its
 * reply box at the same indent.
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
        placeholder: "Reply or add others with @",
        kind: "reply",
        thread: () => id,
        people: () => actions.people(),
        onSend: (text, mentions) => actions.reply(id, text, mentions),
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
  /** The comment whose ⋯ menu is open, one waiting for Delete to be confirmed, and the one being edited. */
  let menuFor = "";
  let confirm = "";
  let editing: { id: string; el: HTMLElement } | null = null;
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
    const b = h(
      "button",
      { class: "ib", type: "button", "aria-label": label, title: label },
      icon(name, 15, name === "more" ? 3 : undefined),
    );
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });
    return b;
  };

  /** Puts a comment's words back in a box (Cancel and Save); saving changes them, and Esc leaves them as they were. */
  function startEdit(c: Comment): void {
    const done = () => {
      editing = null;
      update(current);
    };
    const box = composer({
      label: "Save",
      kind: "comment",
      value: c.text,
      people: () => actions.people(),
      onSend: async (words, mentions) => {
        await actions.edit(c.id, words, mentions);
        done();
      },
      onCancel: done,
    });
    editing = { id: c.id, el: h("div", { class: "edit" }, box.element) };
    queueMicrotask(() => box.focus());
  }

  // Leaving the card (focus going elsewhere) closes its ⋯ menu. Checked once focus has settled, so moving between
  // its choices, or the card rebuilding itself and putting focus back, doesn't count as leaving.
  element.addEventListener("focusout", (e) => {
    if (element.contains(e.relatedTarget as Node | null)) return;
    setTimeout(() => {
      if (menuFor && !element.contains((element.getRootNode() as Document | ShadowRoot).activeElement)) {
        menuFor = confirm = "";
        update(current);
      }
    });
  });

  function update(
    t: Thread,
    next: { quote?: string | null; lost?: string | null; place?: string | null } = {},
  ): void {
    Object.assign(o, next);
    id = t.id;
    current = t;
    const now = (o.now ?? Date.now)();
    const n = t.root.replies.length;
    /** A comment's words with the people it names marked (yours stronger); links and references as usual. */
    const body = (c: Comment): (string | Node)[] => {
      const plain = (t: string) => (isAiName(c.name) ? referenced(t) : linkify(t));
      if (!c.mentions?.length) return plain(c.text);
      const out: (string | Node)[] = [];
      let at = 0;
      for (const m of c.mentions) {
        if (m.start < at) continue;
        out.push(...plain(c.text.slice(at, m.start)));
        out.push(
          h(
            "span",
            { class: names(c, [actions.me]) && m.ref === actions.me ? "mn me" : "mn" },
            c.text.slice(m.start, m.end),
          ),
        );
        at = m.end;
      }
      return [...out, ...plain(c.text.slice(at))];
    };
    const words = (c: Comment) =>
      h(
        "div",
        { class: c.deleted ? "tx del" : "tx" },
        ...(c.deleted ? ["Deleted"] : [...body(c), c.edited ? " (edited)" : ""]),
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
    const mine = (c: Comment) => c.author === actions.me && !c.deleted;
    /** The ⋯ menu's choices for a comment: Copy thread on the comment, Edit and Delete on your own. */
    const menu = (c: Comment, root: boolean): HTMLElement | null => {
      const items: [string, () => void][] = [];
      if (root) items.push(["Copy thread", () => actions.copy(t.id)]);
      if (mine(c))
        items.push(
          ["Edit", () => startEdit(c)],
          [
            confirm === c.id ? "Delete for everyone" : "Delete",
            () => {
              if (confirm !== c.id) return void (confirm = c.id);
              confirm = menuFor = "";
              void actions.remove(c.id);
            },
          ],
        );
      if (!items.length) return null;
      const box = h(
        "div",
        { class: "pm", role: "menu" },
        ...items.map(([label, run], i) => {
          const b = h(
            "button",
            { type: "button", role: "menuitem", class: label === "Delete for everyone" ? "dl" : "" },
            label,
          );
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            if (label !== "Delete") menuFor = "";
            run();
            update(current);
            // Rebuilt: while the menu stays open (Delete, asking again), focus stays on the same choice.
            element.querySelectorAll<HTMLElement>(".pm button")[i]?.focus();
          });
          return b;
        }),
      );
      return box;
    };
    /** Who and how long ago (the exact time on hover), then the comment's actions. */
    const head = (c: Comment, root: boolean) => {
      const options = menu(c, root);
      const more = options
        ? button("more", "More", () => {
            menuFor = menuFor === c.id ? "" : c.id;
            confirm = "";
            update(current);
            // Rebuilt: focus goes into the menu, or back to its ⋯ when it closes.
            element.querySelector<HTMLElement>(menuFor ? ".pm button" : `[data-c="${c.id}"]`)?.focus();
          })
        : null;
      if (more) {
        more.setAttribute("aria-expanded", String(menuFor === c.id));
        more.dataset.c = c.id;
      }
      return h(
        "div",
        { class: "hdr" },
        ...face(c),
        h("span", { class: "who" }, nameOf(c)),
        h("span", { class: "ago", title: new Date(c.at).toLocaleString() }, formatAgo(c.at, now)),
        h(
          "span",
          { class: "acts" },
          reactButton(c),
          root
            ? t.resolved
              ? button("reopen", "Reopen", () => void actions.reopen(t.id))
              : button("resolve", "Resolve", () => void actions.resolve(t.id))
            : null,
          more,
        ),
        menuFor === c.id ? options : null,
      );
    };
    /** The comment's words, or a box to change them while it is being edited. */
    const text = (c: Comment) => (editing?.id === c.id ? editing.el : words(c));
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
      head(t.root, true),
      context,
      text(t.root),
      reactions(t.root),
      o.variant === "column" && restText ? h("div", { class: "rest" }, restText) : null,
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
            ...t.root.replies.map((c) => h("div", { class: "it" }, head(c, false), text(c), reactions(c))),
            // A reply being written by an add-on (an AI's, streaming in): not a comment yet, so only shown.
            writing === undefined
              ? null
              : h(
                  "div",
                  { class: "it ghost", "data-pipeup-writing": "row" },
                  h(
                    "div",
                    { class: "hdr" },
                    avatar("", AI_NAME),
                    h("span", { class: "who" }, AI_NAME),
                    h("span", { class: "ago" }, "writing now"),
                  ),
                  h("div", { class: "tx", "data-pipeup-writing": "words" }, writing),
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
