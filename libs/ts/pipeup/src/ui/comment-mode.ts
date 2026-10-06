import { describeElement } from "../anchor/describe";
import { labelOf } from "../anchor/locate";
import type { Ctx, Draft, View } from "./context";
import { fit, h, inert } from "./dom";
import { icon } from "./icons";
import { placeBar } from "./layout";
import { pageLook, parentBlock, pickBlock, type Look } from "./pick";

/** Page controls Enter or Space would activate. */
const ACTIVATES =
  "a,button,summary,[role=button],[role=link],[role=switch],[role=tab],[role=checkbox],input[type=checkbox],input[type=radio],input[type=submit],input[type=button],input[type=reset]";
/**
 * Page controls a press would focus, open or toggle. Not wrappers that merely hold text: a `tabindex="-1"`
 * container (skip-link targets, app roots), an open `details`, or a `label`, so text in them stays selectable.
 */
const CONTROL = `${ACTIVATES},input,select,textarea,[contenteditable]:not([contenteditable=false]),[tabindex]:not([tabindex="-1"])`;
/** What the page would act on (clicks, submits, its own context menus, drags): in comment mode it never happens. */
const SWALLOWED = ["click", "dblclick", "auxclick", "submit", "contextmenu", "dragstart"];
/**
 * What the page would react to (hover menus, presses, swipes and carousels): it doesn't hear them in comment
 * mode. Touches are muted but not prevented, so the page still scrolls.
 */
const MUTED = [
  ...["over", "out", "enter", "leave", "down", "up"].flatMap((s) => [`pointer${s}`, `mouse${s}`]),
  "mousemove",
  "touchstart",
  "touchmove",
  "touchend",
  "touchcancel",
];
/** How long a move counts as a glide: must cover `--pu-move` (0.34 s), the glide's duration in the stylesheet. */
const GLIDE_MS = 400;

/** Comment mode's view; `back()` is Escape's step for it: clears a chosen block, false when none was chosen. */
export interface CommentMode extends View {
  back(): boolean;
}

/**
 * Comment mode: the page goes quiet, an outline glides to the obvious block under the pointer, and a click
 * chooses it. Listeners are on window in the capture phase and stop propagation there, so the page's own
 * handlers never run while Pipeup's other window listeners (selection, the menu) still do, whatever their order.
 *
 * Known limits: the page's CSS `:hover` still applies; page listeners on window in the capture phase that were
 * added before comment mode started still hear events; Escape still reaches the page's own handlers.
 */
export function createCommentMode(ctx: Ctx, look: Look = pageLook()): CommentMode {
  const outline = h("div", { class: "pick" });
  ctx.layer.append(outline);
  const label = h("span", { class: "lbl" });
  const up = h(
    "button",
    {
      class: "nb",
      type: "button",
      "aria-label": "Select the block around it",
      title: "Select the block around it",
    },
    icon("expand", 16),
  );
  const bar = h("div", { class: "namebar", role: "toolbar", "aria-label": "Chosen block" }, label, up);
  bar.inert = true;
  ctx.layer.append(bar);
  // Pressing the bar must not move the page's focus or drop its selection.
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  up.addEventListener("click", (e) => {
    e.stopPropagation();
    const p = chosen && parentBlock(chosen, ctx.root, look);
    if (p) moveDraftTo(p);
  });
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  /** The block outlined now (under the pointer, or chosen), the chosen one, and where the outline is drawn. */
  let target: Element | null = null;
  let chosen: Element | null = null;
  /** The comment box opened on the chosen block. */
  let drafted: Draft | null = null;
  let at: Element | null = null;
  let glideUntil = 0;
  let stopFade = () => {};
  /** Where the bar is drawn (it stays on the old block while fading out), and a pending reveal to cancel. */
  let barAt: Element | null = null;
  let stopBar = () => {};

  /** The event is the page's, outside the areas the author asked Pipeup to leave alone. */
  const onPage = (e: Event) =>
    !ctx.owns(e) && !(e.target instanceof Element && e.target.closest("[data-pipeup-ignore]"));

  /** Keeps the outline on its block: gliding just after it moved there, tracking scroll otherwise. */
  function place(): void {
    if (!at) return;
    outline.classList.toggle("glide", performance.now() < glideUntil);
    fit(outline, at.getBoundingClientRect(), 4);
  }

  /** The bar sits above the chosen block (below it near the top), centred, never over it; glides with the outline. */
  function positionBar(): void {
    if (!barAt) return;
    bar.classList.toggle("glide", performance.now() < glideUntil && bar.classList.contains("show"));
    const r = barAt.getBoundingClientRect();
    const { left, top } = placeBar(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: bar.offsetWidth || 200, height: bar.offsetHeight || 34 },
      { width: window.innerWidth, height: window.innerHeight },
    );
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  function moveTo(el: Element, glide: boolean): void {
    at = el;
    glideUntil = glide ? performance.now() + GLIDE_MS : 0;
    place();
    outline.classList.add("show");
  }

  /**
   * Runs `then` once `el` has faded out completely; the stylesheet's own timing decides when. Returns a stop.
   */
  function afterFade(el: HTMLElement, then: () => void): () => void {
    const style = getComputedStyle(el);
    if (style.opacity === "0") {
      then();
      return () => {};
    }
    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", end);
    };
    const done = () => {
      stop();
      then();
    };
    const end = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "opacity") done();
    };
    // In case the transition never ends (cancelled or not running), give up just after its longest duration.
    const ms = Math.max(...style.transitionDuration.split(",").map((d) => parseFloat(d) * 1000 || 0));
    timer = window.setTimeout(done, ms + 100);
    el.addEventListener("transitionend", end);
    return stop;
  }

  function show(el: Element | null): void {
    if (el === target) return;
    target = el;
    stopFade();
    if (!el) {
      // Fades out where it is.
      outline.classList.remove("show");
      return;
    }
    if (getComputedStyle(outline).opacity === "0") moveTo(el, false);
    else if (!reduced) moveTo(el, true);
    else {
      // Reduced motion: movement becomes a soft cross-fade, and the outline only moves once it is invisible.
      outline.classList.remove("show");
      stopFade = afterFade(outline, () => moveTo(el, false));
    }
  }

  function choose(el: Element | null): void {
    chosen = el;
    outline.classList.toggle("on", el !== null);
    show(el);
    stopBar();
    bar.inert = !el;
    if (!el) {
      bar.classList.remove("show");
      barAt = null;
    } else if (reduced) {
      // Reduced motion: the bar fades out first, then reappears at the new block; it never moves while seen.
      bar.classList.remove("show");
      stopBar = afterFade(bar, () => reveal(el));
    } else reveal(el);
  }

  /** Names `el` in the bar and puts the bar beside it: gliding there if already shown, else fading in in place. */
  function reveal(el: Element): void {
    label.textContent = label.title = labelOf(el);
    const top = parentBlock(el, ctx.root, look) === null;
    up.hidden = top;
    const showing = bar.classList.contains("show");
    barAt = el;
    positionBar();
    if (!showing) {
      // First appearance: in place before it fades in, never gliding from wherever it last was.
      void bar.offsetWidth;
      bar.classList.add("show");
    }
  }

  /**
   * Chooses a block and opens the comment box on it, or moves the open one there (its words and focus kept).
   * `drafted` is the box that belongs to the chosen block, so comment mode clears with it.
   */
  function commentOn(el: Element): void {
    let anchor;
    try {
      anchor = describeElement(el, ctx.root);
    } catch (err) {
      ctx.report(err);
      return;
    }
    const next = {
      anchor,
      label: labelOf(el),
      ranges: [],
      resolved: { state: "attached", element: el, range: null },
    } as const;
    const cur = ctx.state.draft;
    choose(el);
    drafted = cur ?? { ...next, ranges: [] };
    if (cur) ctx.moveDraft({ ...next, ranges: [] });
    else ctx.startDraft(drafted);
  }

  /** The expand icon: the draft moves to the surrounding block and the caret stays where it was. */
  function moveDraftTo(el: Element): void {
    ctx.keepCaret(() => commentOn(el));
  }

  /** Option-click: a pin at that exact spot, as fractions of the block under it (or of the whole area). */
  function pin(e: MouseEvent): void {
    const el = (e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null) ?? ctx.root;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const point = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    let anchor;
    try {
      anchor = describeElement(el, ctx.root, point);
    } catch (err) {
      ctx.report(err);
      return;
    }
    const name = labelOf(el).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
    choose(null);
    show(null);
    ctx.startDraft({
      anchor,
      label: `Pin on ${name}`,
      ranges: [],
      resolved: { state: "attached", element: el, range: null },
    });
  }

  function onPick(e: MouseEvent): void {
    // A finished text selection: its own comment icon takes it from here.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    // A draft with words in it keeps them: a click elsewhere only drops an empty one.
    if (ctx.state.draft && (e.altKey || !ctx.draftEmpty())) {
      ctx.dismiss();
      return;
    }
    // A click on a highlight reads its thread (the comment views open it), never picks the block under it.
    if (!e.altKey && ctx.readsAt(e.clientX, e.clientY)) return;
    if (ctx.state.active) ctx.open(null);
    if (e.altKey) {
      pin(e);
      return;
    }
    const block = e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null;
    if (block) commentOn(block);
    else {
      ctx.dismiss();
      choose(null);
    }
  }

  const onMove = (e: PointerEvent) => {
    if (ctx.owns(e)) return;
    if (!onPage(e)) {
      if (!chosen) show(null);
      return;
    }
    e.stopPropagation();
    if (chosen || ctx.state.draft) return;
    show(e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null);
  };

  const mute = (e: Event) => {
    if (!onPage(e)) return;
    e.stopPropagation();
    // Pressing a control would focus, open or toggle it. Pressing text starts a selection, which still works.
    if (
      (e.type === "pointerdown" || e.type === "mousedown") &&
      e.target instanceof Element &&
      e.target.closest(CONTROL)
    )
      e.preventDefault();
  };

  const swallow = (e: Event) => {
    if (!onPage(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "click") onPick(e as MouseEvent);
  };

  // Escape is the app's: it steps back one level at a time (draft, thread, chosen block, comment mode).
  const onKey = (e: KeyboardEvent) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      onPage(e) &&
      e.target instanceof Element &&
      e.target.closest(ACTIVATES)
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  window.addEventListener("pointermove", onMove, true);
  for (const type of MUTED) window.addEventListener(type, mute, true);
  for (const type of SWALLOWED) window.addEventListener(type, swallow, true);
  window.addEventListener("keydown", onKey, true);

  return {
    back() {
      if (!chosen) return false;
      choose(null);
      return true;
    },
    render() {
      const d = ctx.state.draft;
      // The box closed (Esc, sent, dropped) or another one took over: the block lets go with it.
      if (drafted && d !== drafted) {
        drafted = null;
        choose(null);
      } else if (d && !drafted && (target || chosen)) choose(null);
    },
    frame() {
      place();
      positionBar();
    },
    destroy() {
      stopFade();
      stopBar();
      window.removeEventListener("pointermove", onMove, true);
      for (const type of MUTED) window.removeEventListener(type, mute, true);
      for (const type of SWALLOWED) window.removeEventListener(type, swallow, true);
      window.removeEventListener("keydown", onKey, true);
      // The outline and bar fade out where they are, then leave. Comment mode coming back meanwhile makes
      // its own, so these only ever touch themselves.
      outline.classList.remove("show");
      bar.classList.remove("show");
      inert(bar, true);
      afterFade(outline, () => outline.remove());
      afterFade(bar, () => bar.remove());
    },
  };
}
