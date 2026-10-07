import { locate } from "../anchor/locate";
import { resolveAnchor, type Resolved } from "../anchor/resolve";
import { UnsavedChangeError, type PipeupDocument } from "../document";
import { copyAll, copyThread, type ExportItem } from "../export/format";
import type { Thread } from "../model/types";
import type { Ctx, Draft, MenuActions, UiState, View } from "./context";
import { fit, h } from "./dom";
import type { DraftBox } from "./draft-view";
import { isShortcut, SHORTCUT_LABEL } from "./shortcut";
import { createBubbles } from "./bubbles";
import { createCommentMode, type CommentMode } from "./comment-mode";
import { columnSpot, createColumn, GUTTER } from "./column";
import { narrow, PANEL } from "./layout";
import { createSelection } from "./select";
import { copyText } from "./files";
import { createLauncher } from "./launcher";
import { createHere } from "./here";
import { hit, quoteRects } from "./geometry";
import { installPageSheet, paintHighlights } from "./highlights";
import { createHost } from "./host";
import { readTheme } from "./theme";
import type { ThreadActions } from "./thread-view";

/** Each resolve pass may spend this long on approximate matching before deferring the rest. */
const RESOLVE_BUDGET_MS = 40;
const DEFERRED_RESOLVE_MS = 250;
const MUTATION_DEBOUNCE_MS = 120;
const TOAST_MS = 2400;
const HINT_MS = 4000;

export interface AppOptions {
  doc: PipeupDocument;
  root: Element;
  onName(name: string): Promise<void>;
}

export interface App {
  readonly ctx: Ctx;
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
  const theme = readTheme(o.root);
  const host = createHost(theme);
  const sheet = installPageSheet(document, theme.dark);
  sheet.fade(0);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const reserve = document.documentElement.hasAttribute("data-pipeup-reserve");
  const resolved = new Map<string, Resolved>();
  const pendingFuzzy = new Set<string>();
  const claimed = new WeakSet<Event>();
  const state: UiState = {
    active: null,
    hot: null,
    showResolved: false,
    // Comments show only in comment mode or while All comments is open: hidden on load.
    hidden: true,
    mode: chooseMode(o.root),
    draft: null,
    commenting: false,
    listing: false,
    reading: false,
    menu: false,
  };
  const toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" });
  host.layer.append(toastEl);
  let openBox: DraftBox | null = null;
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

  /** Comment mode's hint is showing: it goes as soon as a block is clicked, or after HINT_MS. */
  let hint = false;

  function toast(text: string, ms = TOAST_MS): void {
    if (destroyed) return;
    hint = ms === HINT_MS;
    toastEl.textContent = text;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  function hideHint(): void {
    if (!hint) return;
    hint = false;
    window.clearTimeout(toastTimer);
    toastEl.classList.remove("show");
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

  const exportItem = (t: Thread): ExportItem => ({
    thread: t,
    location: locate(t.anchor, resolved.get(t.id) ?? resolveAnchor(t.anchor, o.root), o.root),
  });

  const actions: ThreadActions = {
    reply: async (parentId, text) => {
      try {
        await o.doc.reply(parentId, text);
      } catch (e) {
        if (e instanceof UnsavedChangeError) toast(UNSAVED_NOTE);
        else fail(e);
      }
    },
    resolve: async (id) => {
      try {
        await o.doc.resolve(id);
        if (state.active === id && !state.showResolved) state.active = null;
        toast("Resolved · Show resolved brings it back");
      } catch (e) {
        if (e instanceof UnsavedChangeError) {
          if (state.active === id && !state.showResolved) state.active = null;
          toast(`Resolved · ${UNSAVED_NOTE}`);
        } else toast(message(e));
      }
    },
    reopen: async (id) => {
      try {
        await o.doc.reopen(id);
        toast("Reopened");
      } catch (e) {
        toast(e instanceof UnsavedChangeError ? `Reopened · ${UNSAVED_NOTE}` : message(e));
      }
    },
    close: () => {
      open(null);
      if (back) row(back)?.focus({ preventScroll: true });
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

  function inPageOrder(threads: readonly Thread[]): Thread[] {
    const el = (t: Thread) => resolved.get(t.id)?.element ?? null;
    return [...threads].sort((a, b) => {
      const ea = el(a);
      const eb = el(b);
      if (!ea || !eb) return ea ? -1 : eb ? 1 : 0;
      if (ea === eb) return 0;
      return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  const menu: MenuActions = {
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
    all: () => inPageOrder(o.doc.threads()).map(exportItem),
  };

  const ctx: Ctx = {
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
    visible: (t) => !state.hidden && (!t.resolved || state.showResolved) && !elsewhere.has(t.id),
    quoteAt: (x, y) => {
      for (const t of o.doc.threads()) {
        const r = resolved.get(t.id);
        if (t.anchor.quote && ctx.visible(t) && r?.range && hit(x, y, quoteRects(r))) return t;
      }
      return null;
    },
    readsAt: (x, y) => (ctx.draftEmpty() ? ctx.quoteAt(x, y) : null),
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
    postDraft,
    cancelDraft,
    setCommenting,
    dismiss,
    registerDraft: (box) => {
      openBox = box;
    },
    toast,
    report,
    pulse,
    render,
  };

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
      const el = resolved.get(t.id)?.element;
      if (
        !here.holds(t.anchor.view) ||
        (!deck && el?.checkVisibility?.({ visibilityProperty: true }) === false)
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
    paintHighlights({ quote, on, done });
  }

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
  function makeRoom(px: number): void {
    if (px === pushed) return;
    pushed = px;
    sheet.room(px, reduced);
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
    const threads = o.doc.threads();
    classify();
    // A thread open on a slide or view that is no longer here closes; a reply half-typed in it waits for it.
    if (state.active && elsewhere.has(state.active)) {
      const words = host.layer.querySelector<HTMLTextAreaElement>(
        `[data-thread="${state.active}"] .rbox textarea`,
      )?.value;
      if (words) unsent.set(state.active, words);
      state.active = null;
    }
    // Comments show in comment mode, while All comments is open, while a thread chosen there on a narrow screen
    // (where the panel steps aside) is open, and while a comment is being written (its words are never lost);
    // otherwise the open thread closes.
    state.hidden = !state.commenting && !state.listing && !state.reading && !state.draft;
    if (state.hidden) state.active = null;
    fadeHighlights(state.hidden ? 0 : 1);
    host.layer.classList.toggle("hidden", state.hidden);
    host.layer.classList.toggle("listing", state.listing);
    // The open panel makes room beside the page (unless it is the whole width of a narrow screen).
    const push = state.listing && !narrow();
    makeRoom(push ? PANEL : 0);
    // Pages that reserve a gutter lay themselves out around it; it closes with the column, when comments are
    // hidden, and while the panel's own room takes its place.
    sheet.gutter(reserve ? (state.mode === "column" && !state.hidden && !push ? GUTTER : 0) : null);
    paint(threads);
    for (const v of views) v.render(threads);
    modeView?.render(threads);
  }

  /** The panel row (by thread; the panel rebuilds its rows) a thread was chosen from: Esc in its reply line gives focus back there. */
  let back = "";
  const row = (id: string) => host.layer.querySelector<HTMLElement>(`.all .mi[data-thread="${id}"]`);
  const FIELD = "input,textarea,select,[contenteditable]:not([contenteditable=false])";
  /** The reader has words in a Pipeup line, or is in a field of the page. */
  const writing = () => {
    const a = (host.layer.getRootNode() as ShadowRoot).activeElement;
    return (a instanceof HTMLTextAreaElement && a.value !== "") || !!document.activeElement?.matches(FIELD);
  };

  /** Opening a thread puts the cursor in its reply line, synchronously (no timer), unless the reader is writing. */
  function focusReply(id: string, busy = writing()): void {
    const line = [...host.layer.querySelectorAll<HTMLElement>(`[data-thread="${id}"] .rbox textarea`)].find(
      (l) => !l.closest("[inert]"),
    );
    if (busy || !line) return;
    back = (host.layer.getRootNode() as ShadowRoot).activeElement?.getAttribute("data-thread") ?? "";
    line.focus({ preventScroll: true });
  }

  /** A draft with words holds the reviewer: true, after going back to its slide or view if that is gone. */
  function held(): boolean {
    const d = state.draft;
    if (!d || ctx.draftEmpty()) return false;
    if (!here.holds(d.anchor.view)) void here.navigate(d.anchor.view ?? {});
    return true;
  }

  function open(id: string | null): void {
    // Words being written are never dropped: another thread waits (comment mode follows the same rule).
    if (id && held()) return;
    if (state.active === id && !state.draft) return id ? focusReply(id) : undefined;
    const busy = writing();
    // A thread read from All comments on a narrow screen has closed: the comments go with it.
    if (!id) state.reading = false;
    state.active = id;
    if (id) {
      state.draft = null;
      pulse(id);
    }
    render();
    if (id) {
      const words = unsent.get(id);
      const line =
        words && host.layer.querySelector<HTMLTextAreaElement>(`[data-thread="${id}"] .rbox textarea`);
      if (line && !line.value) {
        line.value = words;
        line.dispatchEvent(new Event("input", { bubbles: true }));
      }
      unsent.delete(id);
      focusReply(id, busy);
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
    // A new comment goes where comments are written (the column, say), not under All comments.
    state.listing = false;
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

  function cancelDraft(): void {
    if (!state.draft) return;
    state.draft = null;
    render();
  }

  function setCommenting(on: boolean): void {
    if (state.commenting === on) return;
    state.commenting = on;
    sheet.picking(on);
    if (on) {
      state.active = null;
      state.listing = false;
      toast(
        `Click anything to comment · Option-click (Alt-click) to pin · ${SHORTCUT_LABEL} or Esc to finish`,
        HINT_MS,
      );
      modeView = createCommentMode(ctx);
    } else {
      hideHint();
      modeView?.destroy();
      modeView = null;
    }
    render();
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

  async function postDraft(text: string): Promise<void> {
    const d = state.draft;
    if (!d) return;
    try {
      const id = await o.doc.comment(d.anchor, text);
      state.draft = null;
      resolveAll(new Set([id]));
      open(id);
    } catch (e) {
      if (e instanceof UnsavedChangeError) {
        state.draft = null;
        resolveAll(new Set([e.id]));
        open(e.id);
        toast(UNSAVED_NOTE);
        return;
      }
      fail(e);
    }
  }

  /** One slow, soft swell on the commented content, so you can see what a comment belongs to. */
  function pulse(id: string): void {
    const r = resolved.get(id);
    if (!r || r.state === "orphaned") return;
    const rects = r.range ? quoteRects(r) : r.element ? [r.element.getBoundingClientRect()] : [];
    for (const q of rects.slice(0, 6)) {
      const p = h("div", { class: "pulse" });
      fit(p, q, 4);
      host.layer.prepend(p);
      window.setTimeout(() => p.remove(), 1300);
    }
  }

  function buildViews(): void {
    for (const v of views) v.destroy();
    views = viewsFor(ctx);
    render();
  }

  const frame = () => {
    if (destroyed) return;
    for (const v of views) v.frame();
    modeView?.frame();
    raf = requestAnimationFrame(frame);
  };

  /** Typing in a field (the page's or Pipeup's own) never triggers shortcuts. */
  const typing = (e: Event) => {
    const t = e.composedPath()[0];
    return t instanceof Element && t.closest(FIELD) !== null;
  };
  // Escape steps back one level at a time: the draft, then the open thread, then the chosen block, then
  // comment mode. The menu (capture phase) and Pipeup's own fields stop Escape before it gets here.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // A draft with words on a slide that is gone can't be seen: Escape leaves it and steps back past it.
      if (state.draft && (here.holds(state.draft.anchor.view) || ctx.draftEmpty())) cancelDraft();
      else if (state.active) open(null);
      else if (modeView && !modeView.back()) setCommenting(false);
      return;
    }
    // Shift+Option+C (Shift+Alt+C) toggles comment mode (matched on the key's code: Option changes its
    // character on a Mac), unless the page's own shortcut (defaultPrevented) or an IME already took it.
    if (isShortcut(e) && !e.isComposing && !e.defaultPrevented && !typing(e)) {
      e.preventDefault();
      setCommenting(!state.commenting);
    }
  };
  const onClick = (e: MouseEvent) => {
    if (ctx.owns(e) || claimed.has(e)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    dismiss();
  };
  const onResize = () => {
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
  const observer = new MutationObserver((records) => {
    if (records.every((r) => host.element.contains(r.target))) return;
    scheduleReplace();
  });

  window.addEventListener("keydown", onKey);
  window.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);
  observer.observe(o.root, { subtree: true, childList: true, characterData: true });
  // Size changes with no DOM change (images and fonts loading, accordions, class toggles) re-place the threads.
  const sizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleReplace);
  sizeObserver?.observe(o.root);
  const offChange = o.doc.onChange(() => {
    resolveAll();
    render();
  });

  resolveAll();
  buildViews();
  raf = requestAnimationFrame(frame);

  return {
    ctx,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(fadeRaf);
      here.destroy();
      window.clearTimeout(reflowTimer);
      window.clearTimeout(toastTimer);
      window.clearTimeout(mutationTimer);
      window.clearTimeout(deferredTimer);
      observer.disconnect();
      sizeObserver?.disconnect();
      offChange();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      modeView?.destroy();
      for (const v of views) v.destroy();
      sheet.remove();
      host.destroy();
    },
  };
}
