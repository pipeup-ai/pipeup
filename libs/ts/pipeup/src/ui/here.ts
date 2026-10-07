import { LIMITS } from "../model/ops";

/** Where the reviewer is: the slide ("1"-based) and whatever the page reports about itself. */
export type ViewState = Record<string, string>;

/** A deck's own way to say which slide shows and to go to one (both 1-based). */
export interface SlideHook {
  current(): number;
  go(n: number): void;
}

/** What finding the current slide needs from layout (faked in unit tests). */
export interface SlideLook {
  box(el: Element): { left: number; top: number; width: number; height: number };
  /** Not hidden by display:none, visibility:hidden or opacity:0, on it or an ancestor. */
  shown(el: Element): boolean;
  /** Its own opacity, 0 to 1: in a cross-fade the more opaque of two slides wins. */
  opacity(el: Element): number;
  viewport(): { width: number; height: number };
}

/** Where the reviewer is now, and how to go somewhere else. */
export interface Here {
  /** The current slide ("3"), or null on a page that isn't a deck. */
  slide(): string | null;
  /**
   * What a new comment on `at` saves: { slide?, ...the page's state }, or undefined when there is nothing. The
   * slide is the marked slide holding `at`, else the current one.
   */
  view(at?: Node): ViewState | undefined;
  /** A thread saved with view `saved` belongs here (its content is judged by the app). */
  holds(saved: ViewState | undefined): boolean;
  /** Goes to `view`; resolves true once it is here, false after 1 s (or at once when nothing can go there). */
  navigate(view: ViewState): Promise<boolean>;
  destroy(): void;
}

const SLIDE = "[data-pipeup-slide]";
const NAVIGATE_MS = 1000;
/** Re-check on these (batched to one check per frame); slidechanged is reveal.js's. No polling. */
const EVENTS = ["scroll", "resize", "keyup", "click", "transitionend", "slidechanged"];

// Kept outside any one mount: a page may report its state or register a handler before Pipeup starts.
let page: ViewState | null = null;
let hook: SlideHook | null = null;
const revealers = new Set<(view: ViewState) => void>();
const watchers = new Set<() => void>();

/** A page's handler or hook failing never breaks Pipeup. */
const safely = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    globalThis.reportError?.(e);
  }
};

/**
 * Reports the page's own view, such as `{ tab: "pricing", label: "Pricing tab" }`: string values only, within
 * the anchor's limits (the slide is Pipeup's own). `label` is the readable name and is never compared. `null`
 * forgets it.
 */
export function setViewState(state: Record<string, unknown> | null): void {
  let next: ViewState | null = null;
  if (state) {
    next = {};
    let n = 0;
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== "string" || k === "slide" || k.length > LIMITS.viewKey || v.length > LIMITS.viewValue)
        continue;
      // One entry is kept for the slide.
      if (++n >= LIMITS.viewEntries) break;
      next[k] = v;
    }
  }
  page = next;
  for (const w of watchers) w();
}

/** Registers a handler called with a view when the reviewer chooses a thread elsewhere; returns its removal. */
export function onReveal(fn: (view: ViewState) => void): () => void {
  revealers.add(fn);
  return () => void revealers.delete(fn);
}

/** The deck hook from `mount({ slides })`, or null. */
export function setSlideHook(h: SlideHook | null): void {
  hook = typeof h?.current === "function" && typeof h.go === "function" ? h : null;
}

/** The marked slide showing most: the most of the window covered, then the more opaque; still tied, `was` stays. */
export function pickSlide(slides: readonly Element[], look: SlideLook, was: Element | null): Element | null {
  const vp = look.viewport();
  let best: Element | null = null;
  let area = 0;
  let op = 0;
  for (const el of slides) {
    if (!look.shown(el)) continue;
    const b = look.box(el);
    const w = Math.min(b.left + b.width, vp.width) - Math.max(b.left, 0);
    const h = Math.min(b.top + b.height, vp.height) - Math.max(b.top, 0);
    if (w <= 0 || h <= 0) continue;
    const a = Math.round(w * h);
    const o = look.opacity(el);
    if (a > area || (a === area && (o > op || (o === op && el === was)))) {
      best = el;
      area = a;
      op = o;
    }
  }
  return best;
}

/**
 * On a deck, a thread is here when it is on this slide (or on none); on other pages, when every key of its
 * saved view but `label` matches the page's state (always, until the page reports one).
 */
export function isHere(saved: ViewState | undefined, slide: string | null, state: ViewState | null): boolean {
  if (slide !== null) return saved?.slide === undefined || saved.slide === slide;
  if (!saved || !state) return true;
  return Object.entries(saved).every(([k, v]) => k === "label" || k === "slide" || state[k] === v);
}

export function pageSlideLook(): SlideLook {
  return {
    box: (el) => el.getBoundingClientRect(),
    shown: (el) => el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false,
    opacity: (el) => parseFloat(getComputedStyle(el).opacity) || 0,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
  };
}

interface RevealJs {
  getIndices(): { h: number };
  slide(h: number): void;
}
const revealJs = (): RevealJs | null => {
  const r = (window as { Reveal?: Partial<RevealJs> }).Reveal;
  return typeof r?.getIndices === "function" && typeof r.slide === "function" ? (r as RevealJs) : null;
};

/**
 * Follows here: the deck's hook, else reveal.js, else the marked slide that is showing; plus the page's
 * reported state. `onCheck` runs after every re-check (at most once a frame), so the app can re-sort threads.
 */
export function createHere(root: Element, onCheck: () => void, look: SlideLook = pageSlideLook()): Here {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  let shown: Element | null = null;
  let slide: string | null = null;
  let raf = 0;
  let destroyed = false;
  const marked = () => [...root.querySelectorAll(SLIDE)];
  const sections = () => [...root.querySelectorAll(".slides > section")];
  /** A slide is kept only as a string the anchor can hold. */
  const fit = (s: unknown): string | null =>
    typeof s === "string" && s.length > 0 && s.length <= LIMITS.viewValue ? s : null;
  const numberOf = (el: Element | null | undefined) => fit(el?.getAttribute("data-pipeup-slide"));

  function find(): string | null {
    // The page's own functions may fail; then Pipeup falls back to what it can see.
    if (hook) {
      let s: string | null = null;
      safely(() => {
        const n = hook!.current();
        if (Number.isInteger(n) && n > 0) s = String(n);
      });
      if (s !== null) return s;
    }
    const r = revealJs();
    if (r) {
      let s: string | null = null;
      safely(() => {
        const h = r.getIndices().h;
        const sec = sections()[h];
        s = numberOf(sec?.matches(SLIDE) ? sec : sec?.querySelector(SLIDE)) ?? fit(String(h + 1));
      });
      if (s !== null) return s;
    }
    if (shown && !shown.isConnected) shown = null;
    shown = pickSlide(marked(), look, shown) ?? shown;
    return numberOf(shown);
  }

  function check(): void {
    raf = 0;
    slide = find();
    onCheck();
  }
  const schedule = () => {
    if (!raf && !destroyed) raf = requestAnimationFrame(check);
  };

  const holds = (saved: ViewState | undefined) => isHere(saved, slide, page);

  function navigate(view: ViewState): Promise<boolean> {
    if (holds(view)) return Promise.resolve(true);
    const want = view.slide;
    const r = revealJs();
    const el = marked().find((s) => numberOf(s) === want);
    // A stored slide is untrusted: decks are only driven to whole numbers.
    const num = /^[1-9]\d{0,5}$/.test(want ?? "");
    if (num && hook) safely(() => hook!.go(Number(want)));
    else if (num && r) {
      const i = el ? sections().findIndex((s) => s === el || s.contains(el)) : -1;
      safely(() => r.slide(i >= 0 ? i : Number(want) - 1));
    } else if (revealers.size) for (const fn of revealers) safely(() => fn({ ...view }));
    else if (el) el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    else return Promise.resolve(false);
    const t0 = performance.now();
    return new Promise((resolve) => {
      // Frames pause in a background tab, so a timer ends the wait too.
      const end = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => end(false), NAVIGATE_MS);
      const step = () => {
        if (destroyed) return end(false);
        slide = find();
        if (holds(view)) return end(true);
        if (performance.now() - t0 >= NAVIGATE_MS) return end(false);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Only the slides' own changes count; Pipeup's root is outside the page's root.
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.target instanceof Element && r.target.matches(SLIDE))) schedule();
  });
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  for (const e of EVENTS) window.addEventListener(e, schedule, { capture: true, passive: true });
  watchers.add(schedule);
  slide = find();

  return {
    slide: () => slide,
    view(at) {
      const el = at instanceof Element ? at : at?.parentElement;
      const s = numberOf(el?.closest(SLIDE)) ?? slide;
      const v: ViewState = { ...(s !== null ? { slide: s } : {}), ...page };
      return Object.keys(v).length ? v : undefined;
    },
    holds,
    navigate,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const e of EVENTS) window.removeEventListener(e, schedule, true);
      watchers.delete(schedule);
    },
  };
}
