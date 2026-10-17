import { locate } from "../anchor/locate";
import { resolveAnchor, type Resolved } from "../anchor/resolve";
import { UnsavedChangeError, type PipeupDocument } from "../document";
import { copyAll, copyThread, type ExportItem } from "../export/format";
import { animalName, nameOf } from "../model/animals";
import type { Mention, Thread } from "../model/types";
import type { Ctx, Draft, LookChoice, MenuActions, UiState, View } from "./context";
import { fit, h } from "./dom";
import type { DraftBox } from "./draft-view";
import { HOLD_LABEL, isShortcut, SHORTCUT_LABEL } from "./shortcut";
import { Surface } from "./addons";
import { createBubbles } from "./bubbles";
import { createCommentMode, KEYS_HINT, type CommentMode } from "./comment-mode";
import { columnSpot, createColumn, GUTTER } from "./column";
import { narrow, PANEL, popover, touch } from "./layout";
import { byPage } from "./order";
import { createSelection } from "./select";
import { copyText } from "./files";
import { createLauncher } from "./launcher";
import { createHere } from "./here";
import { IGNORED } from "./pick";
import { hit, quoteRects } from "./geometry";
import { installPageSheet, lightWords, paintHighlights } from "./highlights";
import { createHost } from "./host";
import { reveal } from "./notes";
import { inspect, warning, type Appearance } from "./legible";
import { applyTheme, authorLook, pageIsDark, readTheme, type Look } from "./theme";
import { myRefs, names, peopleFor, unseenMentions } from "./mentions";
import type { ThreadActions } from "./thread-view";

/** Each resolve pass may spend this long on approximate matching before deferring the rest. */
const RESOLVE_BUDGET_MS = 40;
const DEFERRED_RESOLVE_MS = 250;
const MUTATION_DEBOUNCE_MS = 120;
const TOAST_MS = 2400;
const HINT_MS = 4000;
/** How long words thrown away by Cancel or Esc can be brought back. */
const UNDO_MS = 6000;
/** Keys that move through Pipeup's menus and lists. */
const MOVES = ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
/** The keyboard's hint is read, then used: it stays longer (until the cursor first moves or a draft opens). */
const KEYS_HINT_MS = 10000;

export interface AppOptions {
  doc: PipeupDocument;
  root: Element;
  onName(name: string): Promise<void>;
  /** Pipeup's stylesheet (passed in so the bundles can carry it last, where it compresses best). */
  styles: string;
}

export interface App {
  readonly ctx: Ctx;
  /** How Pipeup looks and why: its look, who chose it, and what the page's styles do to it. */
  appearance(): Appearance;
  destroy(): void;
}

/** Documents with free space beside them get a column; everything else gets bubbles and popovers. */
export function chooseMode(root: Element, showing = false): UiState["mode"] {
  return columnSpot(root, showing) ? "column" : "bubbles";
}

export function viewsFor(ctx: Ctx): View[] {
  const comments =
    ctx.state.mode === "column"
      ? [createColumn(ctx), createBubbles(ctx, { popovers: false })]
      : [createBubbles(ctx, { popovers: true })];
  return [...comments, createSelection(ctx), createLauncher(ctx)];
}

const MUTATION_MAX_WAIT_MS = 1000;
const UNSAVED_NOTE = "Shown here, but not saved yet — it will be saved with your next change";

const message = (e: unknown) =>
  e instanceof Error ? e.message.replace(/^pipeup: /, "") : "Something went wrong";

export function startApp(o: AppOptions): App {
  // One place decides light or dark: the author's data-pipeup-theme, else what the page shows behind Pipeup.
  // The reviewer's own choice beats the author's, which beats what the page shows.
  const LOOK_KEY = "pipeup:look";
  let choice: LookChoice = "auto";
  try {
    const kept = localStorage.getItem(LOOK_KEY);
    if (kept === "light" || kept === "dark") choice = kept;
  } catch {
    /* no storage: Automatic */
  }
  let dark = false;
  /** The page's own look, whatever Pipeup shows. */
  let pageDark = false;
  let appearance: Appearance;
  let warned = "";
  /** The look to show; what the page's own styles do to it is noted, once, in the console. */
  const lookNow = (): Look => {
    const chosen = choice !== "auto" ? choice : authorLook(document);
    pageDark = pageIsDark(document, pageDark);
    const look = chosen ?? (pageDark ? "dark" : "light");
    appearance = inspect(document, look, choice !== "auto" ? "reviewer" : chosen ? "author" : "page");
    const line = warning(appearance);
    if (line && line !== warned) console.warn((warned = line));
    return look;
  };
  dark = lookNow() === "dark";
  const theme = readTheme(o.root, dark ? "dark" : "light");
  const host = createHost(theme, o.styles);
  // A look that differs from the page's keeps its see-through parts solid, so each look reads as itself.
  host.layer.classList.toggle("flip", dark !== pageDark);
  const sheet = installPageSheet(document);
  sheet.fade(0);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const reserve = document.documentElement.hasAttribute("data-pipeup-reserve");
  const resolved = new Map<string, Resolved>();
  const pendingFuzzy = new Set<string>();
  const claimed = new WeakSet<Event>();
  // Hide comments is the reviewer's choice for this page, kept in their browser under the document's identity.
  const HIDE_KEY = `pipeup:hide:${o.doc.id}`;
  let hide = false;
  try {
    hide = localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    /* no storage: comments show */
  }
  const state: UiState = {
    active: null,
    hot: null,
    showResolved: false,
    mine: false,
    // Comments show unless the reviewer chose Hide comments for this page.
    hide,
    hidden: hide,
    mode: chooseMode(o.root),
    draft: null,
    commenting: false,
    paused: false,
    listing: false,
    reading: false,
    menu: false,
    pinning: false,
  };
  const toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" });
  // What screen readers are told, separate from the toast: visually hidden, never inert.
  const sr = h("div", { class: "sr", "aria-live": "polite" });
  host.layer.append(toastEl, sr);
  let openBox: DraftBox | null = null;
  /** Opens a thread in the All comments panel; set by the panel. */
  let list: ((id: string) => void) | null = null;
  let views: View[] = [];
  let modeView: CommentMode | null = null;
  let destroyed = false;
  let toastTimer = 0;
  let mutationTimer = 0;
  let mutationSince = 0;
  let deferredTimer = 0;
  let raf = 0;
  /** Threads that live elsewhere (another slide or view, or content the page hides), and what that was judged on. */
  let elsewhere = new Set<string>();
  let sorted = "";
  /** Replies half-typed in threads that went elsewhere, put back when the thread reopens. */
  const unsent = new Map<string, string>();
  const here = createHere(o.root, () => {
    if (!destroyed && classify()) render();
  });

  /** Comment mode's hint is showing: it goes as soon as a block is clicked, or after HINT_MS (by touch it stays). */
  let hint = false;
  /** Comment mode's hint, waiting for the menu to close: nothing of Pipeup's covers a message. */
  let hintLater: (() => void) | null = null;
  let sayRaf = 0;
  /**
   * On a touch screen comment mode's hint stays beside the control while comment mode is on (and All comments isn't
   * covering the page): how to use it by touch, and Done, which leaves comment mode in one tap.
   */
  const tapping = () => state.commenting && !state.listing && touch();
  function tapHint(): void {
    if (tapping() && !state.menu)
      toast("Tap what you want to comment on", 0, true, false, {
        label: "Done",
        run: () => setCommenting(false),
      });
  }

  /**
   * `ms`: how long it shows (0: until something else takes its place); `isHint`: comment mode's hint, which goes early;
   * `quiet`: screen readers hear it some other way.
   */
  function toast(
    text: string,
    ms = TOAST_MS,
    isHint = false,
    quiet = false,
    action?: { label: string; href?: string; run?: () => void },
  ): void {
    if (destroyed) return;
    if (isHint && state.menu) return void (hintLater = () => toast(text, ms, true, quiet));
    hint = isHint;
    toastEl.textContent = text;
    toastEl.classList.toggle("act", Boolean(action));
    if (action) {
      const { run } = action;
      const a = run
        ? h("button", { class: "ta", type: "button" }, action.label)
        : h(
            "a",
            { class: "ta", href: action.href, target: "_blank", rel: "noopener noreferrer" },
            action.label,
          );
      if (run)
        a.addEventListener("click", (e) => {
          e.stopPropagation();
          toastEl.classList.remove("show");
          run();
        });
      toastEl.append(" ", a);
    }
    if (quiet) toastEl.setAttribute("aria-hidden", "true");
    else toastEl.removeAttribute("aria-hidden");
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    if (ms)
      toastTimer = window.setTimeout(() => {
        toastEl.classList.remove("show");
        // By touch, comment mode's hint comes back once another message has faded.
        toastTimer = window.setTimeout(tapHint, 320);
      }, ms);
  }

  /** Words were thrown away (Cancel or Esc): `undo` brings them back, for a few seconds. */
  const offer = (text: string, undo: () => void) =>
    toast(text, UNDO_MS, false, false, { label: "Undo", run: undo });

  function hideHint(): void {
    if (tapping()) return;
    hintLater = null;
    if (!hint) return;
    hint = false;
    window.clearTimeout(toastTimer);
    toastEl.classList.remove("show");
  }

  /** Tells screen readers, once: emptied now and written on the next frame, so the same words can be said again. */
  function say(text: string): void {
    sr.textContent = "";
    cancelAnimationFrame(sayRaf);
    sayRaf = requestAnimationFrame(() => (sr.textContent = text));
  }

  /** Tells the reviewer. */
  function report(e: unknown): void {
    toast(message(e));
  }

  /** Tell the reviewer, then let the caller keep its state (e.g. the composer keeps their words). */
  function fail(e: unknown): never {
    report(e);
    throw e;
  }

  // A thread whose first comment was deleted goes away with it, as a deleted reply does.
  const threadsNow = () => o.doc.threads().filter((t) => !t.root.deleted);

  const exportItem = (t: Thread): ExportItem => ({
    thread: t,
    location: locate(t.anchor, resolved.get(t.id) ?? resolveAnchor(t.anchor, o.root), o.root),
  });

  /** A thread's reply line, wherever it shows (on the page or in All comments): the one that can be used. */
  const lineOf = (id: string) =>
    [...host.layer.querySelectorAll<HTMLTextAreaElement>(`[data-thread="${id}"] .rbox textarea`)].find(
      (l) => !l.closest("[inert]"),
    );
  /** What is written in reply lines waits for their threads: a thread that closes or is rebuilt keeps it. */
  function keepReplies(): void {
    for (const l of host.layer.querySelectorAll<HTMLTextAreaElement>("[data-thread] .rbox textarea"))
      if (l.value.trim()) unsent.set(l.closest("[data-thread]")!.getAttribute("data-thread")!, l.value);
  }
  /** Puts back what was being written in thread `id`'s reply line, if it is empty; `focus`: the caret goes there. */
  function putReply(id: string, focus = false): void {
    const words = unsent.get(id);
    const line = lineOf(id);
    if (!line) return;
    unsent.delete(id);
    if (words && !line.value) {
      line.value = words;
      line.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (focus) line.focus({ preventScroll: true });
  }

  const writingIn = (id: string): boolean =>
    (host.layer.querySelector<HTMLTextAreaElement>(`[data-thread="${id}"] .rbox textarea`)?.value.trim() ??
      "") !== "";

  /**
   * Where focus goes when thread `id` leaves (resolved, or deleted): read before it leaves, run once it has. With focus
   * in it, focus goes to the block cursor when it is out, else to the next thread where it was (the next card in the
   * column or in All comments, or the one before the last), else the Comment control.
   */
  function after(id: string): () => void {
    const at = focusedIn();
    if (!at?.closest(`[data-thread="${id}"]`)) return () => {};
    // The threads' own buttons where it was: All comments' rows, the column's, or the bubbles.
    const kind = at.closest(".cd") ? ".mi" : at.closest(".th") ? ".opn" : ".bub";
    const all = [...host.layer.querySelectorAll<HTMLElement>(`${kind}[data-thread]`)];
    const i = all.findIndex((e) => e.getAttribute("data-thread") === id);
    const next = i < 0 ? null : (all[i + 1] ?? all[i - 1])?.getAttribute("data-thread");
    return () => {
      if (modeView?.cursor()) return modeView.refocus();
      const to = next && host.layer.querySelector<HTMLElement>(`${kind}[data-thread="${next}"]`);
      (to || host.layer.querySelector<HTMLElement>(".launch .mode"))?.focus({ preventScroll: true });
    };
  }
  /** After Resolve the next card slides up under a still pointer: its actions wait until the pointer moves. */
  const still = () => {
    host.layer.classList.add("still");
    window.addEventListener("pointermove", () => host.layer.classList.remove("still"), { once: true });
  };

  const actions: ThreadActions = {
    // Read each time: the identity can change after Pipeup starts (a portable one restored, say).
    get me() {
      return o.doc.me;
    },
    picker: () => addons.picker,
    people: () => peopleFor(o.doc.threads(), o.doc.me),
    react: async (commentId, emoji, on) => {
      try {
        await (on ? o.doc.react(commentId, emoji) : o.doc.unreact(commentId, emoji));
      } catch (e) {
        if (e instanceof UnsavedChangeError) toast(UNSAVED_NOTE);
        else fail(e);
      }
    },
    reply: async (parentId, text, mentions) => {
      try {
        await o.doc.reply(parentId, text, mentions);
        say("Reply sent");
        tell(mentions, text);
      } catch (e) {
        if (e instanceof UnsavedChangeError) toast(UNSAVED_NOTE);
        else fail(e);
      }
    },
    edit: async (id, text, mentions) => {
      try {
        await o.doc.edit(id, text, mentions);
      } catch (e) {
        if (e instanceof UnsavedChangeError) toast(UNSAVED_NOTE);
        else fail(e);
      }
    },
    remove: async (id) => {
      // A deleted thread's focus goes on to the next thread; a deleted reply's stays in its thread.
      const t = o.doc.threads().find((x) => x.id === id || x.root.replies.some((c) => c.id === id));
      const then =
        t && t.root.id === id ? after(t.id) : () => t && lineOf(t.id)?.focus({ preventScroll: true });
      try {
        await o.doc.remove(id);
        then();
        toast("Deleted");
      } catch (e) {
        toast(e instanceof UnsavedChangeError ? `Deleted · ${UNSAVED_NOTE}` : message(e));
      }
    },
    resolve: async (id) => {
      const then = after(id);
      still();
      try {
        await o.doc.resolve(id);
        toast("Resolved · ✓ Resolved in All comments shows it again");
      } catch (e) {
        toast(e instanceof UnsavedChangeError ? `Resolved · ${UNSAVED_NOTE}` : message(e));
      }
      if (state.showResolved) return;
      if (state.active === id) state.active = null;
      then();
    },
    reopen: async (id) => {
      try {
        await o.doc.reopen(id);
        toast("Reopened");
      } catch (e) {
        toast(e instanceof UnsavedChangeError ? `Reopened · ${UNSAVED_NOTE}` : message(e));
      }
    },
    notRight: async (id) => {
      try {
        await o.doc.reopen(id);
      } catch (e) {
        toast(e instanceof UnsavedChangeError ? `Reopened · ${UNSAVED_NOTE}` : message(e));
      }
      focusReply(id);
    },
    drop: (id, words) =>
      offer("Reply discarded", () => {
        unsent.set(id, words);
        if (lineOf(id)) putReply(id, true);
        else open(id);
      }),
    close: () => {
      open(null);
      const opener = back && host.layer.querySelector<HTMLElement>(back);
      if (opener) opener.focus({ preventScroll: true });
      else modeView?.refocus();
      back = "";
    },
    copy: (id) => {
      try {
        const t = o.doc.threads().find((x) => x.id === id);
        if (!t) return;
        const text = copyThread(exportItem(t), "ai", location.href, Date.now());
        copyText(text, host.layer).then(
          () => toast("Thread copied as Markdown for AI"),
          (e: unknown) => toast(message(e)),
        );
      } catch (e) {
        toast(message(e));
      }
    },
  };

  const menu: MenuActions = {
    look: () => choice,
    setLook(next) {
      choice = next;
      try {
        if (next === "auto") localStorage.removeItem(LOOK_KEY);
        else localStorage.setItem(LOOK_KEY, next);
      } catch {
        /* kept for this page only */
      }
      setLook(lookNow());
    },
    copyAll: async (as) => {
      const items = menu.all();
      const text = copyAll(items, as, {
        title: document.title,
        url: location.href,
        exportedAt: new Date(),
      });
      try {
        await copyText(text, host.layer);
        const n = items.filter((i) => !i.thread.resolved).length;
        toast(`Copied ${n} thread${n === 1 ? "" : "s"}${as === "ai" ? " as Markdown for AI" : ""}`);
      } catch (e) {
        toast(message(e));
      }
    },
    toggleResolved: () => {
      state.showResolved = !state.showResolved;
      render();
    },
    toggleMine: () => {
      state.mine = !state.mine;
      render();
    },
    setHide: (on) => {
      state.hide = on;
      try {
        if (on) localStorage.setItem(HIDE_KEY, "1");
        else localStorage.removeItem(HIDE_KEY);
      } catch {
        /* for this visit only */
      }
      render();
    },
    rename: async (typed) => {
      // As the document keeps it: one line, single spaces.
      const name = typed.replace(/\s+/g, " ").trim();
      try {
        if (await applyName(name))
          toast(`New comments will say ${name}, but this browser couldn't remember it`);
        else toast(`New comments will say ${name}`);
      } catch (e) {
        toast(message(e));
      }
    },
    name: () => o.doc.name,
    all: () => [...threadsNow()].sort(byPage(ctx)).map(exportItem),
  };

  // The surface needs the context, and the context hands it out: a holder breaks the loop.
  const slot: { surface?: Surface } = {};
  const ctx: Ctx = {
    get addons() {
      return slot.surface!;
    },
    doc: o.doc,
    root: o.root,
    layer: host.layer,
    host: host.element,
    state,
    resolved,
    pending: pendingFuzzy,
    actions,
    menu,
    here,
    elsewhere: (t) => elsewhere.has(t.id),
    recheck: () => {
      if (classify()) render();
    },
    // A resolved thread stays while words are half-written in its reply line: they are never lost.
    visible: (t) =>
      !state.hidden && (!t.resolved || state.showResolved || writingIn(t.id)) && !elsewhere.has(t.id),
    quoteAt: (x, y) => {
      for (const t of threadsNow()) {
        const r = resolved.get(t.id);
        if (t.anchor.quote && ctx.visible(t) && r?.range && hit(x, y, quoteRects(r))) return t;
      }
      return null;
    },
    readsAt: (x, y) => (ctx.draftEmpty() && !state.pinning ? ctx.quoteAt(x, y) : null),
    owns: (e) => e.composedPath().includes(host.element),
    claim: (e) => void claimed.add(e),
    claimed: (e) => claimed.has(e),
    open,
    focusReply: (id) => focusReply(id),
    hot,
    startDraft,
    moveDraft,
    draftEmpty: () => !openBox || openBox.isEmpty(),
    keepCaret: (fn) => {
      const restore = openBox?.caret();
      fn();
      restore?.();
    },
    focusDraft,
    backToDraft: () => {
      modeView?.toDraft();
      toast("Finish or cancel this comment first");
      focusDraft();
    },
    postDraft,
    seen,
    people: () => peopleFor(o.doc.threads(), o.doc.me),
    cancelDraft,
    setCommenting,
    dismiss,
    registerDraft: (box) => {
      openBox = box;
    },
    registerList: (fn) => {
      list = fn;
    },
    toast,
    say,
    hideHint,
    report,
    pulse,
    render,
    back: stepBack,
  };

  const addons = (slot.surface = new Surface(ctx, host.shadow, sr));

  function resolveAll(only?: Set<string>): void {
    const start = performance.now();
    const threads = o.doc.threads();
    for (const t of threads) {
      if (only && !only.has(t.id)) continue;
      const fuzzy = performance.now() - start < RESOLVE_BUDGET_MS;
      const r = resolveAnchor(t.anchor, o.root, { fuzzy });
      resolved.set(t.id, r);
      if (!fuzzy && r.state === "orphaned") pendingFuzzy.add(t.id);
      else pendingFuzzy.delete(t.id);
    }
    for (const id of [...resolved.keys()]) if (!threads.some((t) => t.id === id)) resolved.delete(id);
    if (pendingFuzzy.size === 0) {
      window.clearTimeout(deferredTimer);
      deferredTimer = 0;
    } else if (deferredTimer === 0) {
      deferredTimer = window.setTimeout(() => {
        deferredTimer = 0;
        if (destroyed) return;
        resolveAll(new Set(pendingFuzzy));
        render();
      }, DEFERRED_RESOLVE_MS);
    }
  }

  /**
   * Sorts threads into here and elsewhere: on a deck by slide; on other pages by the page's reported view, and
   * content the page hides (gone content stays here, under "No longer on the page"). True when that changed.
   */
  function classify(): boolean {
    const next = new Set<string>();
    const deck = here.slide() !== null;
    const ids = new Set<string>();
    for (const t of o.doc.threads()) {
      ids.add(t.id);
      const r = resolved.get(t.id);
      const el = r?.element;
      // On a page, a comment belongs to the view it was made in only when what it is about is inside that view:
      // content found as it was, showing, and outside every tab panel shows its comments whatever is open.
      if (
        deck
          ? !here.holds(t.anchor.view)
          : el?.checkVisibility?.({ visibilityProperty: true }) === false ||
            (!here.holds(t.anchor.view) && !(r?.state === "attached" && !el?.closest("[role=tabpanel]")))
      )
        next.add(t.id);
    }
    elsewhere = next;
    for (const id of unsent.keys()) if (!ids.has(id)) unsent.delete(id);
    const key = `${here.slide()}|${[...next].join()}`;
    if (key === sorted) return false;
    sorted = key;
    return true;
  }

  function paint(threads: readonly Thread[]): void {
    const quote: Range[] = [];
    const on: Range[] = [];
    const done: Range[] = [];
    // Hidden comments keep their highlights, faded to nothing, so hiding and showing can ease.
    for (const t of threads) {
      const r = resolved.get(t.id);
      if ((t.resolved && !state.showResolved) || !r?.range || elsewhere.has(t.id)) continue;
      if (t.id === state.active || t.id === state.hot) on.push(r.range);
      else if (t.resolved) done.push(r.range);
      else quote.push(r.range);
    }
    if (state.draft && here.holds(state.draft.anchor.view)) on.push(...state.draft.ranges);
    paintHighlights({ quote, on, done }, (r) => {
      let light = ink.get(r);
      if (light === undefined) ink.set(r, (light = lightWords(r)));
      return light;
    });
  }
  /** Whether each range's words are light on a dark ground; read again when the page's colours may have changed. */
  let ink = new WeakMap<Range, boolean>();

  /** Eases the highlights to strength `to` (enter or exit timing); reduced motion still fades (opacity only). */
  let strength = 0;
  let fadeTo = 0;
  let fadeRaf = 0;
  function fadeHighlights(to: number): void {
    if (to === fadeTo) return;
    fadeTo = to;
    cancelAnimationFrame(fadeRaf);
    const from = strength;
    const t0 = performance.now();
    const ms = to ? 260 : 200;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      strength = from + (to - from) * (to ? 1 - (1 - p) ** 3 : p * p);
      // Highlights can't transition (they are ::highlight rules, not elements), so the fade rewrites the page
      // sheet each frame: one small replaceSync for ~0.2 s, only while comments show or hide.
      sheet.fade(strength);
      if (p < 1) fadeRaf = requestAnimationFrame(step);
    };
    fadeRaf = requestAnimationFrame(step);
  }

  /** The panel's room on the page; once the page has reflowed, threads are placed on their content again. */
  let pushed = 0;
  let reflowTimer = 0;
  /** Until when a deck refits each frame (0: not now); `fitting`: the resize that asks it is Pipeup's own. */
  let refit = 0;
  let fitting = false;
  function makeRoom(px: number): void {
    if (px === pushed) return;
    pushed = px;
    sheet.room(px, reduced);
    if (here.slide() !== null) refit = performance.now() + 450;
    window.clearTimeout(reflowTimer);
    reflowTimer = window.setTimeout(
      () => {
        resolveAll();
        render();
      },
      reduced ? 0 : 400,
    );
  }

  function render(): void {
    if (destroyed) return;
    const threads = threadsNow();
    classify();
    // A thread open on a slide or view that is no longer here closes; a reply half-typed in it waits for it.
    if (state.active && elsewhere.has(state.active)) {
      const words = host.layer.querySelector<HTMLTextAreaElement>(
        `[data-thread="${state.active}"] .rbox textarea`,
      )?.value;
      if (words) unsent.set(state.active, words);
      state.active = null;
    }
    // Comments show unless the reviewer hid them. Hidden, they still show in comment mode, while All comments is
    // open, while a thread chosen there on a narrow screen (where the panel steps aside) is open, and while a
    // comment is being written (its words are never lost); otherwise the open thread closes.
    state.hidden = state.hide && !state.commenting && !state.listing && !state.reading && !state.draft;
    // Holding Space pauses comment mode: the page gets its own cursor back.
    sheet.picking(state.commenting && !state.paused);
    if (state.hidden) state.active = null;
    if (!state.hidden) announceMentions(threads);
    fadeHighlights(state.hidden ? 0 : 1);
    host.layer.classList.toggle("hidden", state.hidden);
    host.layer.classList.toggle("listing", state.listing);
    // By touch, comment mode's hint goes while All comments covers the page, and comes back after.
    if (state.commenting && touch()) {
      if (state.listing) hideHint();
      else if (!toastEl.classList.contains("show")) hintLater ??= tapHint;
    }
    // The open panel makes room beside the page (unless it is the whole width of a narrow screen).
    const push = state.listing && !narrow();
    makeRoom(push ? PANEL : 0);
    // Pages that reserve a gutter lay themselves out around it; it closes with the column, when comments are
    // hidden, and while the panel's own room takes its place.
    sheet.gutter(reserve ? (state.mode === "column" && !state.hidden && !push ? GUTTER : 0) : null);
    // A deck's own controls in the bottom-right corner of its room (a slide number, arrows): the comment control and
    // its messages sit just above them.
    let lift = 0;
    if (here.slide() !== null)
      for (const el of o.root.querySelectorAll(IGNORED)) {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth - pushed - 48 && r.bottom > innerHeight - 48)
          lift = Math.max(lift, innerHeight - r.top + 4);
      }
    host.layer.style.setProperty("--pu-lift", `${lift}px`);
    paint(threads);
    for (const v of views) v.render(threads);
    modeView?.render(threads);
    if (!state.hidden) addons.flush();
  }

  /**
   * What opened the thread, found again by kind and thread (the panel rebuilds its rows): an All comments row, a
   * bubble or a column thread's button. Esc in the reply line gives focus back there.
   */
  let back = "";
  const focusedIn = () => (host.layer.getRootNode() as ShadowRoot).activeElement;
  const FIELD = "input,textarea,select,[contenteditable]:not([contenteditable=false])";
  /** The reader has words in a Pipeup line, or is in a field of the page. */
  const writing = () => {
    const a = focusedIn();
    return (a instanceof HTMLTextAreaElement && a.value !== "") || !!document.activeElement?.matches(FIELD);
  };

  /**
   * Opening a thread puts the cursor in its reply line, synchronously (no timer), unless the reader is writing.
   * `from`: what had focus when it was opened.
   */
  function focusReply(id: string, busy = writing(), from = focusedIn()): void {
    const line = [...host.layer.querySelectorAll<HTMLElement>(`[data-thread="${id}"] .rbox textarea`)].find(
      (l) => !l.closest("[inert]"),
    );
    const t = from?.getAttribute("data-thread");
    back = t ? `.${from!.classList[0]}[data-thread="${t}"]` : "";
    if (busy || !line) return;
    line.focus({ preventScroll: true });
  }

  /** A draft with words holds the reviewer: true, after going back to its slide or view if that is gone. */
  function held(): boolean {
    const d = state.draft;
    if (!d || ctx.draftEmpty()) return false;
    if (!here.holds(d.anchor.view)) void here.navigate(d.anchor.view ?? {});
    return true;
  }

  /** Opens thread `id` (null: closes the open one); `sent`: it is the comment just sent from the open draft. */
  /** After words that name people who chose to be reached by email, offers to open the reviewer's own mail to tell them. */
  function tell(mentions: Mention[] | undefined, text: string): void {
    const reach = o.doc.contacts();
    const people = new Map<string, string>();
    for (const m of mentions ?? []) {
      const mail = reach.get(m.ref);
      if (mail?.includes("@")) people.set(mail, text.slice(m.start + 1, m.end));
    }
    if (!people.size) return;
    const who = o.doc.name || animalName(o.doc.me);
    const subject = `${who} mentioned you on ${document.title}`;
    const body = `${who} mentioned you in a comment on "${document.title}":\n\n${text}\n\n${location.href}`;
    const names = [...people.values()];
    toast(`Let ${names.length === 1 ? names[0] : `${names.length} people`} know?`, 9000, false, false, {
      label: "Open my email",
      href: `mailto:${[...people.keys()].join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    });
  }

  /** The comments in `t` that name this reviewer are read: mark them seen (once each). */
  function seen(t: Thread): void {
    const ids = [t.root, ...t.root.replies]
      .filter((c) => c.author !== o.doc.me && !c.deleted && names(c, myRefs(o.doc.me)))
      .map((c) => c.id);
    if (ids.length) o.doc.seen(ids).catch(() => {});
  }
  /** Tells the reviewer, once, who has mentioned them in comments they haven't seen. */
  const told = new Set<string>();
  function announceMentions(threads: readonly Thread[]): void {
    const fresh = unseenMentions(threads, o.doc.me).filter((m) => !told.has(m.comment.id));
    if (!fresh.length) return;
    for (const m of fresh) told.add(m.comment.id);
    const who = [...new Set(fresh.map((m) => nameOf(m.comment)))];
    toast(
      `${who.length === 1 ? who[0] : `${who.length} people`} mentioned you in ${fresh.length} comment${fresh.length === 1 ? "" : "s"}`,
    );
  }

  /** Into the open draft: to its slide or view first if that has gone (the box is inert while away), then the caret. */
  function focusDraft(): void {
    const v = state.draft?.anchor.view;
    const restore = openBox?.caret();
    void Promise.resolve(here.holds(v) || here.navigate(v ?? {}).then(() => ctx.recheck())).then(restore);
  }

  function open(id: string | null, sent = false): void {
    // Words being written are never dropped: another thread waits, and the reviewer goes back to them.
    if (id && state.draft && !ctx.draftEmpty()) return ctx.backToDraft();
    // While All comments is open, a thread opens there (a click on its highlight, bubble or column thread).
    if (id && state.listing && list) return list(id);
    if (state.active === id && !state.draft) return id ? focusReply(id) : undefined;
    const busy = !sent && writing();
    // Read before the views change: a column thread's button goes inert as its thread opens.
    const from = focusedIn();
    // A thread read from All comments on a narrow screen has closed: the comments go with it.
    if (!id) state.reading = false;
    // What is being written in the closing thread's reply line waits for it.
    keepReplies();
    state.active = id;
    if (id) {
      state.draft = null;
      pulse(id);
      const t = o.doc.threads().find((x) => x.id === id);
      if (t) seen(t);
    }
    render();
    if (id) {
      putReply(id);
      // With the block cursor in use, focus goes back to it, on the same block, instead of the reply line.
      if (sent && modeView?.cursor()) modeView.refocus();
      // On a touch screen the reply line waits to be tapped: the keyboard doesn't cover a thread opened to read it.
      else focusReply(id, busy || touch(), from);
    }
  }

  function hot(id: string | null): void {
    if (state.hot === id) return;
    state.hot = id;
    if (id && id !== state.active) pulse(id);
    render();
  }

  function startDraft(d: Draft): void {
    hideHint();
    // While All comments is open the new comment is written there; otherwise where comments are written.
    state.draft = d;
    state.active = null;
    render();
  }

  /** The open draft is about something else now; it stays the same draft, so its words and focus stay. */
  function moveDraft(d: Draft): void {
    if (!state.draft) return startDraft(d);
    Object.assign(state.draft, d);
    render();
  }

  function cancelDraft(words = ""): void {
    const d = state.draft;
    if (!d) return;
    state.draft = null;
    render();
    if (words)
      offer("Comment discarded", () => {
        // Another comment with words was started meanwhile: it isn't replaced.
        if (state.draft && !ctx.draftEmpty()) return;
        startDraft(d);
        modeView?.adopt(d);
        openBox?.fill(words);
      });
  }

  function setCommenting(on: boolean, keys = false): void {
    if (state.commenting === on) return;
    state.commenting = on;
    state.paused = false;
    hintLater = null;
    if (on) {
      // All comments stays open: new comments are written in it.
      state.active = null;
      modeView = createCommentMode(ctx);
    } else {
      hideHint();
      modeView?.destroy();
      modeView = null;
      say("Comment mode off");
    }
    render();
    if (!modeView) return;
    // From the keyboard the block cursor starts once the comments show (its name counts them).
    if (keys) modeView.resume();
    // The hint waits for the menu to close (frame); by touch it says how to use comment mode by touch.
    if (!keys)
      hintLater = touch()
        ? tapHint
        : () =>
            toast(
              `Click anything to comment, or Tab between blocks · Option-click (Alt-click) to pin · Hold ${HOLD_LABEL} to use the page · ${SHORTCUT_LABEL} or Esc to finish`,
              HINT_MS,
              true,
            );
    else if (modeView.cursor()) hintLater = () => toast(KEYS_HINT, KEYS_HINT_MS, true, true);
    else toast("Nothing here to comment on");
  }

  /**
   * Escape's step: words selected in comment mode, an empty draft, then the open thread, then comment mode's own (a
   * chosen block, the cursor), then comment mode. A draft with words is only thrown away by Esc in its own box: from
   * anywhere else Escape steps past it.
   */
  function stepBack(): void {
    const sel = window.getSelection();
    if (state.commenting && sel && !sel.isCollapsed && o.root.contains(sel.anchorNode)) sel.removeAllRanges();
    else if (state.draft && ctx.draftEmpty()) cancelDraft();
    else if (state.active) open(null);
    else if (modeView && !modeView.back()) setCommenting(false);
  }

  function dismiss(): void {
    if (state.draft) {
      if (!held()) cancelDraft();
      return;
    }
    if (state.active) open(null);
  }

  /**
   * Sets the reviewer's name. The name applies to this session's comments before it is stored, so a failed
   * save is not fatal: returns true when the name is used but won't be remembered; throws otherwise.
   */
  async function applyName(name: string): Promise<boolean> {
    try {
      await o.onName(name);
      return false;
    } catch (e) {
      if (o.doc.name !== name) throw e;
      return true;
    }
  }

  async function postDraft(text: string, mentions?: Mention[]): Promise<void> {
    const d = state.draft;
    if (!d) return;
    try {
      d.sending = true;
      const id = await o.doc.comment(d.anchor, text, mentions);
      say("Comment added");
      tell(mentions, text);
      state.draft = null;
      resolveAll(new Set([id]));
      open(id, true);
    } catch (e) {
      if (e instanceof UnsavedChangeError) {
        state.draft = null;
        resolveAll(new Set([e.id]));
        open(e.id, true);
        toast(UNSAVED_NOTE);
        return;
      }
      d.sending = false;
      fail(e);
    }
  }

  /** One slow, soft swell on the commented content, so you can see what a comment belongs to. */
  function pulse(id: string): void {
    const r = resolved.get(id);
    if (!r || r.state === "orphaned") return;
    // Content the page hides has no box to swell around: inside a closed details, its summary swells instead.
    const hid = r.element?.checkVisibility?.() === false;
    const el = hid ? r.element!.closest("details:not([open])")?.querySelector("summary") : r.element;
    swell(() => (r.range && !hid ? quoteRects(r) : el ? [el.getBoundingClientRect()] : []));
  }

  /** Swells that are showing, and where their content is now: they follow it while the page scrolls under them. */
  const swells = new Set<{ els: HTMLElement[]; at: () => readonly DOMRect[] }>();
  function swell(at: () => readonly DOMRect[]): void {
    const els = at()
      .slice(0, 6)
      .map(() => host.layer.insertBefore(h("div", { class: "pulse" }), host.layer.firstChild));
    const one = { els, at };
    swells.add(one);
    follow(one);
    window.setTimeout(() => {
      swells.delete(one);
      for (const p of els) p.remove();
    }, 1300);
  }
  function follow(s: { els: HTMLElement[]; at: () => readonly DOMRect[] }): void {
    const rects = s.at();
    s.els.forEach((p, i) => rects[i] && fit(p, rects[i], 4));
  }

  /** A reference pill pressed: go to the slide, or scroll to the passage and give it one soft swell. */
  reveal.go = (to) => {
    if (to.startsWith("slide:")) return void here.navigate({ slide: to.slice(6) });
    const want = decodeURIComponent(to.slice(6)).replace(/\s+/g, " ").toLowerCase();
    const found = [
      ...o.root.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,figcaption,dt,dd"),
    ].find((e) => (e.textContent ?? "").replace(/\s+/g, " ").toLowerCase().includes(want));
    if (!found) return;
    found.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    window.setTimeout(() => swell(() => [found.getBoundingClientRect()]), reduced ? 0 : 450);
  };

  function buildViews(): void {
    // A thread rebuilt for another layout keeps what is being written in its reply line, and the caret if it was there.
    keepReplies();
    const typing = !!focusedIn()?.closest(".rbox");
    for (const v of views) v.destroy();
    views = viewsFor(ctx);
    render();
    if (state.active) putReply(state.active, typing);
  }

  const frame = () => {
    if (destroyed) return;
    // A waiting hint never covers a message that came first (someone mentioned you): it waits for it to fade too.
    if (hintLater && !state.menu && !(toastEl.classList.contains("show") && !hint)) {
      const show = hintLater;
      hintLater = null;
      show();
    }
    // A deck that fits the window (reveal.js, say) refits on a resize: one each frame while the panel's room opens
    // or closes, so it follows the room as it eases.
    if (refit) {
      if (performance.now() > refit) refit = 0;
      fitting = true;
      dispatchEvent(new Event("resize"));
      fitting = false;
    }
    for (const v of views) v.frame();
    for (const s of swells) follow(s);
    modeView?.frame();
    addons.frame();
    raf = requestAnimationFrame(frame);
  };

  /** Typing in a field (the page's or Pipeup's own) never triggers shortcuts. */
  const typing = (e: Event) => {
    const t = e.composedPath()[0];
    return t instanceof Element && t.closest(FIELD) !== null;
  };
  // Escape steps back one level at a time (stepBack). The menu (capture phase), Pipeup's own fields and the
  // block cursor stop Escape before it gets here.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return stepBack();
    // Shift+Option+C (Shift+Alt+C) (matched on the key's code: Option changes its character on a Mac), unless
    // the page's own shortcut (defaultPrevented) or an IME already took it: comment mode off → on with the
    // block cursor; the cursor put away by the mouse → back; otherwise off.
    if (isShortcut(e) && !e.isComposing && !e.defaultPrevented && !typing(e)) {
      e.preventDefault();
      // Put away with nothing left to land on: the shortcut still turns comment mode off.
      if (modeView?.away() && modeView.resume()) return;
      setCommenting(!state.commenting, true);
    }
  };
  const onClick = (e: MouseEvent) => {
    if (ctx.owns(e) || claimed.has(e)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    dismiss();
  };
  /**
   * After the window changes shape (a phone turned), what the open thread or comment is on comes back into view, near
   * the top, so the thread fits below it. Only a change of width counts: a phone's keyboard changes the height.
   */
  let wide = window.innerWidth;
  let shapeTimer = 0;
  function inView(): void {
    const r = state.active ? resolved.get(state.active) : state.draft?.resolved;
    const box = (r?.range ?? r?.element)?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight))
      window.scrollBy({ top: box.top - 16, behavior: reduced ? "auto" : "smooth" });
  }
  const onResize = () => {
    if (fitting) return;
    if (window.innerWidth !== wide) {
      wide = window.innerWidth;
      window.clearTimeout(shapeTimer);
      shapeTimer = window.setTimeout(inView, 200);
    }
    host.layer.style.setProperty("--pu-pop", `${popover()}px`);
    const mode = chooseMode(o.root, state.mode === "column");
    if (mode !== state.mode) {
      state.mode = mode;
      buildViews();
    } else render();
  };
  function scheduleReplace(): void {
    const now = performance.now();
    if (mutationTimer === 0) mutationSince = now;
    window.clearTimeout(mutationTimer);
    const wait = Math.min(MUTATION_DEBOUNCE_MS, Math.max(0, mutationSince + MUTATION_MAX_WAIT_MS - now));
    mutationTimer = window.setTimeout(() => {
      mutationTimer = 0;
      resolveAll();
      render();
    }, wait);
  }
  /**
   * A page's modal <dialog> makes everything outside it inert, Pipeup too: while one is open, Pipeup's element lives
   * in the one opened last (in the page's top layer, above its backdrop), and goes back under <html> once none is
   * open (closed, or removed with Pipeup in it). The page's own elements are never touched; the dialog only holds
   * Pipeup's element while it is open.
   */
  let modals: Element[] = [];
  function rehome(): void {
    let open: Element[] = [];
    try {
      open = [...document.querySelectorAll("dialog")].filter((d) => d.matches(":modal"));
    } catch {
      /* no :modal (an old browser): Pipeup stays under <html> */
    }
    modals = [...modals.filter((d) => open.includes(d)), ...open.filter((d) => !modals.includes(d))];
    const into = modals.at(-1) ?? document.documentElement;
    if (host.element.parentNode !== into) into.append(host.element);
  }
  /** A record that only moved Pipeup's own element (into a dialog or back) says nothing about the page. */
  const moved = (r: MutationRecord) =>
    r.type === "childList" &&
    r.addedNodes.length + r.removedNodes.length > 0 &&
    [...r.addedNodes, ...r.removedNodes].every((n) => n === host.element);
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.removedNodes.length)) rehome();
    if (records.every((r) => host.element.contains(r.target) || moved(r))) return;
    scheduleReplace();
  });

  // Keys Pipeup acts on in its own UI never also reach the page, going down or coming up (a deck turns on either):
  // Enter and Space on its buttons, the moving keys in its menus and lists, and ← → in the menu (Copy comments).
  // Others, such as ← and → anywhere else, still reach the page.
  const keep = (e: KeyboardEvent) => {
    const k = e.key;
    const at = (sel: string) => e.composedPath().some((n) => n instanceof Element && n.matches(sel));
    if (
      k === "Enter" ||
      k === " " ||
      (MOVES.includes(k) && at(".menu,.all,.pm")) ||
      (k.startsWith("Arrow") && at(".menu"))
    )
      e.stopPropagation();
  };
  for (const t of ["keydown", "keyup", "keypress"]) host.layer.addEventListener(t, keep as EventListener);
  // A page's own dialog never takes Pipeup's focus or closes for what happens in Pipeup: a focus trap that pulls focus
  // back when it leaves the dialog doesn't hear focus moving into Pipeup (nor the page losing it to Pipeup), and a
  // dialog that closes on a press outside it doesn't hear presses in Pipeup. Pipeup's own listeners are on window in
  // the capture phase, or inside its shadow root, so they still hear everything.
  const ours = (n: EventTarget | null) => n === host.element;
  const guardFocus = (e: FocusEvent) => {
    if (
      e.type === "focusin"
        ? ours(e.target) && !ours(e.relatedTarget)
        : ours(e.relatedTarget) && !ours(e.target)
    )
      e.stopImmediatePropagation();
  };
  const quiet = (e: Event) => e.stopPropagation();
  const QUIET = ["pointerdown", "mousedown", "touchstart", "click", "focusin", "focusout"];
  for (const t of ["focusin", "focusout"]) window.addEventListener(t, guardFocus as EventListener, true);
  for (const t of QUIET) host.element.addEventListener(t, quiet);
  window.addEventListener("keydown", onKey);
  window.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);
  observer.observe(o.root, { subtree: true, childList: true, characterData: true });
  // Size changes with no DOM change (images and fonts loading, accordions, class toggles) re-place the threads.
  // The page turns dark or light after Pipeup started (a theme switch): Pipeup follows.
  // Anywhere in the page may carry the switch (a class on a wrapper, say), so any attribute change is a reason to
  // look again, at most once a moment, and again after a transition has settled.
  let lookFade = 0;
  const setLook = (look: Look) => {
    const next = look === "dark";
    host.layer.classList.toggle("flip", next !== pageDark);
    if (next === dark) return;
    dark = next;
    window.clearTimeout(lookFade);
    // Every part switches together: the whole layer fades out, switches, and fades back in.
    host.layer.classList.add("sw");
    lookFade = window.setTimeout(() => {
      applyTheme(host.layer, readTheme(o.root, look));
      host.layer.classList.remove("sw");
    }, 170);
  };
  // The page's colours may have changed: highlights look again at the words under them.
  const lookAgain = () => {
    setLook(lookNow());
    ink = new WeakMap();
    paint(threadsNow());
  };
  let lookTimer = 0;
  const scheduleLook = () => {
    if (lookTimer) return;
    lookTimer = window.setTimeout(() => {
      lookAgain();
      lookTimer = window.setTimeout(() => {
        lookTimer = 0;
        lookAgain();
      }, 450);
    }, 150);
  };
  const themeObserver = new MutationObserver((records) => {
    // A dialog opening or closing (its `open`): Pipeup goes into the open modal one, or back out.
    if (records.some((r) => r.attributeName === "open" && (r.target as Element).localName === "dialog"))
      rehome();
    if (records.every((r) => r.target === host.element)) return;
    scheduleLook();
  });
  themeObserver.observe(document.documentElement, { attributes: true, subtree: true });
  const schemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  schemeQuery?.addEventListener?.("change", scheduleLook);
  const sizeObserver = new ResizeObserver(scheduleReplace);
  sizeObserver.observe(o.root);
  const offChange = o.doc.onChange((_threads, added, source) => {
    addons.heard(added, source);
    resolveAll();
    render();
  });

  resolveAll();
  buildViews();
  rehome();
  raf = requestAnimationFrame(frame);

  return {
    ctx,
    appearance: () => appearance,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(fadeRaf);
      cancelAnimationFrame(sayRaf);
      here.destroy();
      window.clearTimeout(reflowTimer);
      window.clearTimeout(toastTimer);
      window.clearTimeout(shapeTimer);
      window.clearTimeout(mutationTimer);
      window.clearTimeout(deferredTimer);
      observer.disconnect();
      reveal.go = undefined;
      sizeObserver.disconnect();
      themeObserver.disconnect();
      schemeQuery?.removeEventListener?.("change", scheduleLook);
      window.clearTimeout(lookTimer);
      window.clearTimeout(lookFade);
      offChange();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      for (const t of ["focusin", "focusout"])
        window.removeEventListener(t, guardFocus as EventListener, true);
      window.removeEventListener("resize", onResize);
      modeView?.destroy();
      for (const v of views) v.destroy();
      addons.destroy();
      sheet.remove();
      host.destroy();
    },
  };
}
