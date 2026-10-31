import { formatAgo } from "../export/format";
import { AI_NAME, isAiName, nameOf } from "../model/animals";
import type { Comment, Mention, Thread } from "../model/types";
import { avatar, easeIn, faceOf, retire } from "./animals";
import { composer } from "./composer";
import { clip, h, linkify, referenced } from "./dom";
import { icon, type IconName } from "./icons";
import { commentMarks, markAgain, threadMarks, threadNotes } from "./notes";
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
  /** Cancel or Esc threw away the words in thread `threadId`'s reply line: offers them back. */
  drop(threadId: string, words: string): void;
  /** Esc in an empty reply line: closes the thread. */
  close(): void;
}

export interface ThreadViewOptions {
  /** `card`: a closed card in All comments, only its first comment: words cut to two lines, no replies or reply box. */
  variant: "column" | "popover" | "card";
  quote?: string | null;
  /** Snapshot of content that can't be shown: gone from the page, or somewhere it couldn't be reached. */
  lost?: string | null;
  /** Where that content is, when it isn't gone ("On slide 3"); default "No longer on the page". */
  place?: string | null;
  /** Its content was found changed or nearby: flagged Moved, with what it was about, for someone to confirm. */
  moved?: boolean;
  /** A card's line about what it's on, as written (in place of the quote). */
  note?: string | null;
  /** A card's quiet last line (its replies and reactions), as written. */
  rest?: string | null;
  now?: () => number;
}

/** How long Delete's second question ignores presses: the second click of a double-click lands well within it. */
const CONFIRM_MS = 500;

export const plural = (n: number) => `${n} ${n === 1 ? "reply" : "replies"}`;
/** A thread's replies that haven't been deleted: a deleted comment goes away. */
export const replies = (t: Thread) => t.root.replies.filter((c) => !c.deleted);

export interface ThreadView {
  readonly element: HTMLElement;
  /** Shows a newer copy of the thread. The reply line is kept, so what's being typed in it (and focus) survives. */
  update(t: Thread, o?: Partial<ThreadViewOptions>): void;
}

/**
 * One thread, as a compact card: who and how long ago, then the words; its actions sit at the top right (on hover,
 * and always when open). Replies sit one level in beneath the comment, oldest first, and the thread ends with its
 * reply box at the same indent.
 */
export function threadView(first: Thread, actions: ThreadActions, options: ThreadViewOptions): ThreadView {
  const o = { ...options };
  const card = o.variant === "card";
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
        // Words go first (with Undo), and the thread stays open; an empty line closes it.
        onCancel: (words) => (words ? actions.drop(id, words) : actions.close()),
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
  const element = h("div", {}, root, card ? null : h("div", { class: "more" }, inner));
  /**
   * Avatars by comment, with the face they show. Updates rebuild the comment's box, so the same avatar is
   * moved into the new one instead: it eases in once, when it first appears, and never again. When the face
   * changes (its writer added a name), the old one stays beneath until the new one has eased in over it.
   */
  /** Comments whose quick row of reactions is open, and the chips already shown (so only new ones ease in). */
  const quickOpen = new Set<string>();
  /** The comment whose ⋯ menu is open, one waiting for Delete to be confirmed (and since when), and the one being edited. */
  let menuFor = "";
  let shownMenu = "";
  let confirm = "";
  let asked = 0;
  let editing: { id: string; el: HTMLElement } | null = null;
  const reactionsSeen = new Set<string>();
  let current = first;
  let faces = new Map<string, { key: string; el: HTMLElement }>();
  let nextFaces = new Map<string, { key: string; el: HTMLElement }>();
  /** The comments' marks as last drawn, so a mark taken away eases out rather than vanishing. */
  let shownMarks = new Map<string, { text: string; tip?: string }>();
  let nextMarks = new Map<string, { text: string; tip?: string }>();
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
      icon(name, 18, name === "more" ? 2.6 : undefined),
    );
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });
    return b;
  };

  /** Focuses what matches `sel` in the card, once it has been rebuilt. */
  const refocus = (sel: string) => element.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });

  /**
   * Puts a comment's words back in a box (Cancel and Save); saving changes them, and Esc leaves them as they were.
   * Either way focus comes back to the comment's ⋯, where Edit was chosen.
   */
  function startEdit(c: Comment): void {
    const done = () => {
      editing = null;
      update(current);
      refocus(`[data-c="${c.id}"]`);
    };
    const box = composer({
      label: "Save",
      name: "Edit comment",
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
  // The quick row of reactions closes the same way, and so with the thread.
  element.addEventListener("focusout", (e) => {
    if (element.contains(e.relatedTarget as Node | null)) return;
    setTimeout(() => {
      if (
        (menuFor || quickOpen.size) &&
        !element.contains((element.getRootNode() as Document | ShadowRoot).activeElement)
      ) {
        menuFor = confirm = "";
        quickOpen.clear();
        update(current);
      }
    });
  });

  function update(t: Thread, next: Partial<ThreadViewOptions> = {}): void {
    // A rebuilt button keeps focus: the same action on the same comment is focused again (a newer copy arriving
    // while a reviewer works the card from the keyboard never drops them to the page).
    const had = (element.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
    const key = had && element.contains(had) ? had.dataset.k : undefined;
    rebuild(t, next);
    if (key && !element.contains((element.getRootNode() as Document | ShadowRoot).activeElement))
      element.querySelector<HTMLElement>(`[data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }

  function rebuild(t: Thread, next: Partial<ThreadViewOptions>): void {
    Object.assign(o, next);
    const wasShown = shownMenu;
    shownMenu = menuFor;
    id = t.id;
    current = t;
    const now = (o.now ?? Date.now)();
    const live = replies(t);
    const n = live.length;
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
    // Each comment reads in its own direction (Arabic and Hebrew right to left), whatever Pipeup's.
    const words = (c: Comment) =>
      h(
        "div",
        { class: c.deleted ? "tx del" : "tx", dir: "auto" },
        ...(c.deleted ? ["Deleted"] : [...body(c), c.edited ? " (edited)" : ""]),
      );
    const reactions = (c: Comment) =>
      reactionRow(c, {
        me: actions.me,
        picker: actions.picker(),
        resolved: t.resolved,
        quick: quickOpen.has(c.id),
        bare: card,
        seen: reactionsSeen,
        react: (emoji, on) => {
          quickOpen.delete(c.id);
          void actions.react(c.id, emoji, on);
          update(current);
          // Focus stays on the comment: back on its React.
          refocus(`[data-r="${c.id}"]`);
        },
      });
    /** The button that opens the quick row; none on a resolved thread or a deleted comment. */
    const reactButton = (c: Comment) => {
      if (t.resolved || c.deleted) return null;
      const b = button("smile", "React", () => {
        const on = !quickOpen.delete(c.id);
        if (on) quickOpen.add(c.id);
        update(current);
        // Rebuilt: focus goes into the quick row, or stays on React when it closes.
        refocus(on ? `[data-q="${c.id}"] button` : `[data-r="${c.id}"]`);
      });
      b.dataset.r = c.id;
      b.dataset.k = `r${c.id}`;
      return b;
    };
    const restText = t.resolved
      ? "Resolved" + (n ? ` · ${plural(n)}` : "")
      : t.addressed
        ? "Addressed" + (n ? ` · ${plural(n)}` : "")
        : n
          ? plural(n)
          : "";
    const mine = (c: Comment) => c.author === actions.me && !c.deleted;
    /** The ⋯ menu's choices for a comment: Copy thread on the comment, Edit and Delete on your own. */
    // Each choice runs, and says whether the menu stays open (Delete, asking again).
    const menu = (c: Comment, root: boolean): HTMLElement | null => {
      const items: [string, () => boolean][] = [];
      if (root)
        items.push([
          "Copy thread",
          () => {
            actions.copy(t.id);
            return false;
          },
        ]);
      if (mine(c))
        items.push(
          [
            "Edit",
            () => {
              startEdit(c);
              return false;
            },
          ],
          [
            confirm === c.id ? "Delete for everyone" : "Delete",
            () => {
              if (confirm !== c.id) {
                confirm = c.id;
                asked = performance.now();
                return true;
              }
              // The click or tap that asked can't also answer: a double-click on Delete deletes nothing.
              if (performance.now() - asked < CONFIRM_MS) return true;
              confirm = "";
              void actions.remove(c.id);
              return false;
            },
          ],
        );
      if (!items.length) return null;
      // It eases in when it opens; rebuilt while open (Delete asking again), it changes in place.
      const box = h(
        "div",
        { class: wasShown === c.id ? "pm" : "pm in", role: "menu", "data-m": c.id },
        ...items.map(([label, run], i) => {
          const b = h(
            "button",
            {
              type: "button",
              role: "menuitem",
              class: label === "Delete for everyone" ? "dl" : "",
              "data-k": `p${c.id}${i}`,
            },
            label,
          );
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!run()) menuFor = "";
            update(current);
            // Rebuilt: while the menu stays open (Delete, asking again), focus stays on the same choice; closed (Copy
            // thread), it goes back to its ⋯, unless the choice took it somewhere (Edit's box).
            const same = element.querySelectorAll<HTMLElement>(".pm button")[i];
            if (same) same.focus();
            else if (!element.contains((element.getRootNode() as ShadowRoot).activeElement))
              element.querySelector<HTMLElement>(`[data-c="${c.id}"]`)?.focus();
          });
          return b;
        }),
      );
      // A menu's keys: arrows, Home and End move; Esc closes it (not the thread) and goes back to its ⋯.
      box.addEventListener("keydown", (e) => {
        const l = [...box.querySelectorAll<HTMLElement>("button")];
        const i = l.indexOf(e.target as HTMLElement);
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: l.length - 1 }[e.key];
        if (to !== undefined) l[(to + l.length) % l.length]?.focus();
        else if (e.key === "Escape") {
          menuFor = confirm = "";
          update(current);
          refocus(`[data-c="${c.id}"]`);
        } else return;
        e.preventDefault();
        e.stopPropagation();
      });
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
        more.dataset.k = `m${c.id}`;
      }
      return h(
        "div",
        { class: "hdr" },
        ...face(c),
        h("span", { class: "who" }, nameOf(c)),
        h("span", { class: "ago", title: new Date(c.at).toLocaleString() }, formatAgo(c.at, now)),
        // A closed card has no room for the mark's line: its glyph sits after the time, its words its name.
        card ? markOf(c, true) : null,
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
    /**
     * An add-on's mark on one comment ("Only in this browser"): a quiet line under its words, why in its tooltip. On a
     * closed card, only its glyph after the time. A new mark eases in; one taken away eases out where it was.
     */
    const markOf = (c: Comment, glyph = false) => {
      const now = commentMarks.get(c.id);
      const was = shownMarks.get(c.id);
      const m = now ?? was;
      if (!m) return null;
      if (now) nextMarks.set(c.id, now);
      const cls = `cm${now ? (was ? "" : " new") : " out"}`;
      return glyph
        ? h(
            "span",
            { class: cls, role: "img", "aria-label": m.text, title: m.tip ?? m.text },
            icon("browser", 13),
          )
        : h("div", { class: cls, title: m.tip }, icon("browser", 13), m.text);
    };
    const quote = o.quote ? `“${clip(o.quote, 80)}”` : "";
    const about =
      o.note && !o.moved
        ? o.note
        : o.lost
          ? `${o.place || "No longer on the page"} — it read “${clip(o.lost, 120)}”`
          : o.moved
            ? `Moved · ${quote || `it read “${clip(t.anchor.snapshot, 80)}”`}`
            : quote;
    const last = card ? o.rest : o.variant === "column" && restText;
    nextFaces = new Map();
    nextMarks = new Map();
    // Each comment keeps room for its avatar at the top right, so the words never move or narrow for it.
    const nextRoot = h(
      "div",
      { class: "root" },
      head(t.root, true),
      about ? h("div", { class: "ctx" }, about) : null,
      text(t.root),
      // In the column a long comment shows its first lines at rest, then "more" (the column measures it).
      o.variant === "column" && h("div", { class: "mr", "aria-hidden": "true" }, h("span", {}, "more")),
      card ? null : markOf(t.root),
      reactions(t.root),
      last ? h("div", { class: "rest" }, last) : null,
    );
    root.replaceWith(nextRoot);
    root = nextRoot;
    element.className = t.resolved ? "thread resolved" : "thread";
    element.setAttribute("data-thread", t.id);
    // A closed card is only its first comment.
    if (card) return void ((faces = nextFaces), (shownMarks = nextMarks));

    // Swap the comment and replies around the reply line; never rebuild the line itself.
    list?.remove();
    const writing = threadNotes.get(t.id);
    list =
      n || writing !== undefined
        ? h(
            "div",
            { class: "rps" },
            ...live.map((c) => h("div", { class: "it" }, head(c, false), text(c), markOf(c), reactions(c))),
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
                  h("div", { class: "tx", dir: "auto", "data-pipeup-writing": "words" }, writing),
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
    shownMarks = nextMarks;
    // Words half-written in the reply line are never lost: a thread resolved meanwhile (by anyone) keeps its line
    // until they are sent or cleared, with a plain sentence saying so.
    const held = line.querySelector("textarea")!.value.trim() !== "";
    note.hidden = !(t.resolved && held);
    if (t.resolved && !held) line.remove();
    else if (line.parentNode !== inner) inner.append(line);
  }

  update(first);
  return { element, update };
}
