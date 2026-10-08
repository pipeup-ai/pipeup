import { describeElement } from "../anchor/describe";
import { kindOf, labelOf, wordsOf } from "../anchor/locate";
import type { Thread } from "../model/types";
import type { Ctx, Draft, View } from "./context";
import { fit, h, inert, selected } from "./dom";
import { icon, type IconName } from "./icons";
import { placeBar } from "./layout";
import { byPage, nodeOf } from "./order";
import { blockTree, childBlocks, pageLook, parentBlock, pickBlock, row, type Block } from "./pick";

/** Page controls Enter or Space would activate. */
export const ACTIVATES =
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
/** How long a move counts as a glide: must cover `--mv` (0.34 s), the glide's duration in the stylesheet. */
const GLIDE_MS = 400;
/** The keyboard's hint: shown as a toast, and read with the block cursor's first landing. */
export const KEYS_HINT =
  "Tab moves between blocks · \u2191 \u2193 change level · Enter comments · Esc to finish · F7 selects text";
/** Pointer movement, in px, the cursor ignores before the mouse takes the outline from it. */
const NUDGE = 4;
/** A block with at most this many characters is read whole as the cursor's name; a longer one as its description. */
const SHORT_BLOCK = 150;

/** Comment mode's view. */
export interface CommentMode extends View {
  /** Escape's step: clears a chosen block; false when there was none (comment mode ends next). */
  back(): boolean;
  /** The keyboard's block cursor is in use (started, and not put away by a click, a selection or the mouse). */
  cursor(): boolean;
  /** The block cursor was put away by the mouse or a selection: the shortcut brings it back. */
  away(): boolean;
  /** Starts the block cursor, or brings it back: on its last block if still here, else where focus is, else the first block in view. */
  resume(): boolean;
  /** Focuses the block cursor on its block again, as a move, so its name is read afresh. */
  refocus(): void;
}

/**
 * Comment mode: the page goes quiet, an outline glides to the obvious block under the pointer, and a click
 * chooses it. Listeners are on window in the capture phase and stop propagation there, so the page's own
 * handlers never run while Pipeup's other window listeners (selection, the menu) still do, whatever their order.
 *
 * Known limits: the page's CSS `:hover` still applies; page listeners on window in the capture phase that were
 * added before comment mode started still hear events; Escape still reaches the page's own handlers.
 */
export function createCommentMode(ctx: Ctx): CommentMode {
  const look = pageLook();
  // The hint, read once as part of the cursor's first landing.
  const hintText = h("span", { hidden: true }, KEYS_HINT);
  const outline = h("div", { class: "pick" }, hintText);
  // The keyboard's block cursor: two invisible markers over the outlined block take turns to hold focus, so
  // every move is a real focus change that screen readers announce and magnifiers follow. Never in Tab's order.
  const markers = [0, 1].map(() => {
    const m = h(
      "div",
      { class: "km", tabindex: "-1", role: "button" },
      h("span", { hidden: true }),
      h("span", { hidden: true }),
    );
    m.inert = true;
    m.addEventListener("keydown", onMarkerKey);
    // A screen reader's activate.
    m.addEventListener("click", (e) => {
      e.stopPropagation();
      act();
    });
    m.addEventListener("focus", () => outline.classList.add("kf"));
    m.addEventListener("blur", () => outline.classList.remove("kf"));
    return m;
  });
  const label = h("span", { class: "lbl" });
  /** A naming-bar button: an icon, with a name for screen readers and a tooltip. */
  const nb = (name: string, tip: string, ic: IconName, run: () => void) => {
    const b = h("button", { class: "nb", type: "button", "aria-label": name, title: tip }, icon(ic, 16));
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });
    return b;
  };
  const up = nb("Around it", "Select the block around it", "expand", around);
  const down = nb("Inside it", "Select a block inside it", "shrink", inside);
  const pinner = nb("Pin", "Pin its centre", "pin", () =>
    ctx.keepCaret(() => commentOn((chosen ?? cur)!, { x: 0.5, y: 0.5 })),
  );
  // A group, not a toolbar: it has no arrow keys of its own.
  const bar = h(
    "div",
    { class: "namebar", role: "group", "aria-label": "Chosen block" },
    label,
    up,
    down,
    pinner,
  );
  bar.inert = true;
  // Before the control, so Tab from a draft reaches the bar before the corner control.
  const launch = ctx.layer.querySelector(".launch");
  for (const el of [outline, ...markers, bar]) ctx.layer.insertBefore(el, launch);
  // Pressing the bar must not move the page's focus or drop its selection.
  bar.addEventListener("mousedown", (e) => e.preventDefault());
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
  /** The block cursor: the block it is on (null while not in use), its row's level, the marker holding focus. */
  let cur: Element | null = null;
  let lvl = 0;
  let turn = 0;
  /** It has been in use (so it was put away, not never started). */
  let had = false;
  /** The block Tab carries on from while the cursor isn't out: where it was, or the block last clicked or hovered. */
  let was: Element | null = null;
  /** Where focus was when it started: it goes back there when comment mode ends. */
  let before: Element | null = null;
  /** The block the cursor last came up from (↓ goes back towards it). */
  let from: Element | null = null;
  /** How far the pointer has moved since the cursor last moved: past NUDGE, the mouse takes the outline. */
  let moved = 0;
  /** Shift+Enter: the block's thread opened last (-1: none yet on this block). */
  let nth = -1;
  /** The hint is still to be read with the first landing. */
  let first = true;
  /** The page's blocks as the keyboard sees them; null when the page may have changed (rebuilt when next needed). */
  let tree: Block[] | null = null;
  /** The page control Enter or Space was pressed on while the cursor wasn't in use: its click is the page's. */
  let passed: EventTarget | null = null;

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
    const { left, top } = placeBar(
      barAt.getBoundingClientRect(),
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
    barTo(el);
  }

  /** The naming bar goes to `el` (or fades out with none). */
  function barTo(el: Element | null): void {
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
    up.hidden = parentBlock(el, ctx.root, look) === null;
    // Only the cursor has read the whole page; a mouse user's check looks inside the block alone.
    down.hidden = (cur ? kids(el).length : blockTree(el, look, keep).length) === 0;
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
   * With a `point` (fractions of its box) the comment is a pin there, and no block stays chosen.
   * `drafted` is the box that belongs to the chosen block, so comment mode clears with it.
   */
  function commentOn(el: Element, point?: { x: number; y: number }): void {
    let anchor;
    try {
      anchor = describeElement(el, ctx.root, point, ctx.here.view(el));
    } catch (err) {
      ctx.report(err);
      return;
    }
    const next: Draft = {
      anchor,
      label: point ? `Pin on ${labelOf(el).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}` : labelOf(el),
      ranges: [],
      resolved: { state: "attached", element: el, range: null },
    };
    const open = ctx.state.draft;
    // The cursor follows the draft's block, so it comes back there.
    if (cur) {
      cur = el;
      nth = -1;
    }
    choose(point ? null : el);
    drafted = open ?? next;
    ctx.moveDraft(next);
    ctx.say(point ? next.label : `Commenting on ${next.label}`);
  }

  /** The expand icon: the draft moves to the surrounding block and the caret stays where it was. */
  function moveDraftTo(el: Element): void {
    ctx.keepCaret(() => commentOn(el));
  }

  /** Option-click: a pin at that exact spot, as fractions of the block under it (or of the whole area). */
  function pin(e: MouseEvent): void {
    const el = (e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null) ?? ctx.root;
    if (el !== ctx.root) was = el;
    const r = el.getBoundingClientRect();
    if (r.width && r.height)
      commentOn(el, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
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
    // A pointer's click puts the block cursor away; a screen reader's activate (no pointer) moves it there.
    if (cur && e.detail) stow();
    if (e.altKey) {
      pin(e);
      return;
    }
    const block = e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null;
    if (block) was = block;
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
    const block = !selected() && e.target instanceof Element ? pickBlock(e.target, ctx.root, look) : null;
    if (cur) {
      // The mouse moving onto another block takes the outline; Tab carries on from there. A move the browser
      // makes up after a scroll has no movement, so the cursor's own scrolling never puts it away.
      if (!block || block === cur) return;
      // A nudge of a pixel or two (a trackpad touched while typing) doesn't count.
      moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (moved <= NUDGE) return;
      stow();
    }
    if (block) was = block;
    show(block);
  };
  /** Selected words have their own comment icon: no block is offered while they are, wherever the pointer goes. */
  const onSelect = () => {
    if (!selected()) return;
    // Words selected while the block cursor is out: it is put away, so the selection's own icon shows.
    if (cur) stow();
    if (!chosen) show(null);
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
    // The click a key made on a page control while the cursor isn't in use is the page's, and so is the submit;
    // Enter in a form's field clicks its submit button.
    const t = e.target as HTMLButtonElement;
    if (
      (t === passed || (t.form && t.form === (passed as HTMLInputElement | null)?.form)) &&
      (e.type === "submit" || (e.type === "click" && !(e as MouseEvent).detail))
    ) {
      passed = e.type === "click" && t.type === "submit" ? t.form : null;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    // A click that closes the open menu does only that (whichever of the two hears it first).
    if (e.type === "click" && !ctx.state.menu && !ctx.claimed(e)) onPick(e as MouseEvent);
  };

  // Escape is the app's: it steps back one level at a time (draft, thread, chosen block, comment mode).
  // Enter and Space on a page control do what the page expects while the block cursor isn't in use.
  const onKey = (e: KeyboardEvent) => {
    passed = null;
    // A keyup lost on the way (focus left the window) never swallows a later one.
    taken = "";
    if (e.key === "Tab" && tabs(e)) {
      e.preventDefault();
      e.stopPropagation();
      taken = e.key;
      if (ctx.state.active) ctx.open(null);
      if (ctx.state.menu) {
        ctx.state.menu = false;
        ctx.render();
      }
      return land(e.shiftKey ? -1 : 1);
    }
    if (!onPage(e) || !(e.target instanceof Element)) return;
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(ACTIVATES)) {
      if (!cur) {
        passed = e.target;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      // Enter in a page field with a form submits it, as the page expects.
    } else if (e.key === "Enter" && !cur && (e.target as HTMLInputElement).form) passed = e.target;
  };

  /**
   * Tab is the block cursor's in comment mode wherever its markers aren't the ones to hear it: on the page (not in
   * an ignored area) and on the Comment control and its menu (not its name field). Pipeup's comment box, threads
   * and panels keep their own Tab.
   */
  const tabs = (e: KeyboardEvent): boolean => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
    const t = e.composedPath()[0];
    if (!(t instanceof Element) || markers.some((m) => m === t)) return false;
    // Ignored areas, also from inside a web component's own shadow root.
    if (!ctx.owns(e))
      return !e.composedPath().some((n) => n instanceof Element && n.hasAttribute("data-pipeup-ignore"));
    return !!t.closest(".launch,.menu") && !t.closest("input,textarea,select,[contenteditable]");
  };

  /** Pipeup's own element with focus, if any; a marker has it. */
  const focused = () => (ctx.layer.getRootNode() as ShadowRoot).activeElement;
  const onMarker = () => markers.some((m) => m === focused());
  /** Only what the reviewer can see here: shown, and on the current slide (a `display: contents` box has none). */
  const keep = (el: Element) =>
    (el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false ||
      getComputedStyle(el).display === "contents") &&
    ctx.here.holds(ctx.here.view(el));
  /** The blocks; read afresh when one of them has left the page, so the cursor never lands on a removed element. */
  const blocks = () => {
    if (tree?.some((b) => !b.el.isConnected)) tree = null;
    return (tree ??= blockTree(ctx.root, look, keep));
  };
  const blockOf = (el: Element | null) => blocks().find((b) => b.el === el);

  /** Some of `el` is in the window; `top`: its top edge is. */
  const inView = (el: Element, top = false) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && (!top || r.top >= 0);
  };
  /** The first block of the smallest level in the window: its top edge in it, else the one covering the top. */
  const firstInView = (): Block | undefined => {
    const r = row(blocks(), 0);
    return r.find((b) => inView(b.el, true)) ?? r.find((b) => inView(b.el)) ?? r[0];
  };

  /** Threads shown here on `el` or inside it (element, pin and text), in page order. */
  const threadsOn = (el: Element): Thread[] =>
    ctx.doc
      .threads()
      .filter((t) => ctx.visible(t) && el.contains(nodeOf(ctx, t)))
      .sort(byPage(ctx));

  /**
   * Names marker `m` for block `el`: "Paragraph, 3 of 12, has 1 comment", then the block's own words. A short
   * block is read whole as part of the name; a long one by its first words, the whole block as the description.
   */
  function name(m: HTMLElement, el: Element): void {
    const [lab, words] = m.children as unknown as [HTMLElement, HTMLElement];
    const r = row(blocks(), lvl);
    const n = threadsOn(el).length;
    lab.textContent = `${kindOf(el)}, ${r.findIndex((b) => b.el === el) + 1} of ${r.length}${n ? `, has ${n} comment${n === 1 ? "" : "s"}` : ""}`;
    const short = ((el as HTMLElement).innerText ?? el.textContent ?? "").length <= SHORT_BLOCK;
    words.textContent = wordsOf(el);
    const hint = first ? [hintText] : [];
    first = false;
    // Element references from the shadow root out to the page; where they are missing, the words as a string.
    if (m.ariaLabelledByElements !== undefined) {
      m.ariaLabelledByElements = short ? [lab, el] : [lab, words];
      m.ariaDescribedByElements = short ? hint : [...hint, el];
    } else m.setAttribute("aria-label", `${lab.textContent}, ${words.textContent}`);
  }

  /** Moves the cursor to `el`: the outline and bar go there, and the idle marker, named for it, takes focus. */
  function go(el: Element, focus = true): void {
    moved = 0;
    const t = blocks();
    const b = t.find((x) => x.el === el);
    // A block outside the row it was in: the row becomes its level.
    if (b && !row(t, lvl).includes(b)) lvl = b.level;
    if (el !== cur) nth = -1;
    // Off the draft's block, the cursor lets go of it: the draft waits there, and Esc or ↑ are the cursor's.
    if (el !== chosen) chosen = null;
    cur = el;
    show(el);
    barTo(el);
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    if (!focus) return;
    ctx.hideHint();
    const m = markers[(turn ^= 1)]!;
    name(m, el);
    fit(m, el.getBoundingClientRect(), 4);
    m.inert = false;
    m.focus({ preventScroll: true });
    markers[turn ^ 1]!.inert = true;
  }

  function resume(): boolean {
    // The page may have changed since the blocks were last read.
    tree = null;
    const page = document.activeElement;
    before = focused() ?? page;
    const back = blockOf(was);
    const b =
      back ??
      (page && page !== document.body && ctx.root.contains(page) && !page.closest("[data-pipeup-ignore]")
        ? blocks()
            .filter((x) => x.el.contains(page))
            .pop()
        : undefined) ??
      firstInView();
    if (!b) return false;
    // A fresh landing starts at its block's level; coming back to the last block keeps the row if it is in it.
    if (!back) lvl = b.level;
    had = true;
    go(b.el);
    return true;
  }

  /** The cursor stops being in use: the outline and bar fade out where they are, and the markers go quiet. */
  function stow(): boolean {
    const held = onMarker();
    was = cur;
    cur = null;
    show(null);
    barTo(null);
    for (const m of markers) inert(m, true);
    return held;
  }

  /**
   * Focus goes back where it was: a page element still there, else the Comment control (for the menu that is
   * gone, or when focus came from nowhere on the page).
   */
  function giveBack(): void {
    const b = before as HTMLElement | null;
    if (b && b !== document.body && b.isConnected) b.focus?.({ preventScroll: true });
    // :focus also matches inside a shadow root, where document.activeElement is only its host.
    if (!b || b === document.body || !b.matches?.(":focus"))
      ctx.layer.querySelector<HTMLElement>(".launch .mode")?.focus({ preventScroll: true });
  }

  /** The blocks directly inside `el`. */
  function kids(el: Element): Block[] {
    const b = blockOf(el);
    return b ? childBlocks(blocks(), b) : [];
  }

  /** Tab and Shift+Tab: the next or previous block in the cursor's row, wrapping at the ends. */
  function step(by: number): void {
    const r = row(blocks(), lvl);
    const i = r.findIndex((b) => b.el === cur);
    // The cursor's own block is gone: it is before the first, so Tab goes to the first and Shift+Tab the last.
    const to = r[i < 0 ? (by > 0 ? 0 : r.length - 1) : (i + by + r.length) % r.length];
    if (to) go(to.el);
  }

  /**
   * Tab with the cursor not out (comment mode turned on with the mouse, or put away by a click, a selection or the
   * mouse): it starts on the block after the one it carries on from (before it, for Shift+Tab), in that block's
   * row; a block the keyboard doesn't stop on is placed by page order among the smallest blocks. With none to
   * carry on from, it starts on the first block in view. With the cursor out but focus elsewhere, it moves on as from its marker.
   */
  function land(by: number): void {
    if (cur) return step(by);
    tree = null;
    const page = document.activeElement;
    before = focused() ?? page;
    const ref = was?.isConnected ? was : null;
    const known = ref && blockOf(ref);
    let to: Block | undefined;
    if (known) {
      lvl = known.level;
      const r = row(blocks(), lvl);
      const i = r.indexOf(known);
      to = r[(i + by + r.length) % r.length];
    } else if (ref) {
      lvl = 0;
      const r = row(blocks(), 0);
      const after = (b: Block) =>
        (ref.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const around = (b: Block) => b.el.contains(ref);
      if (by > 0) to = r.find((b) => after(b) && !around(b)) ?? r[0];
      else to = r.filter((b) => !after(b) && !around(b)).pop() ?? r[r.length - 1];
    } else {
      to = firstInView();
      if (to) lvl = to.level;
    }
    if (!to) return ctx.say("Nothing here to comment on");
    had = true;
    go(to.el);
  }

  /** ↑ and Around it: the block around the cursor's, or the draft moves to the block around its own. */
  function around(): void {
    const el = chosen ?? cur;
    const p = el && parentBlock(el, ctx.root, look);
    if (!p) return ctx.say("Nothing around it");
    if (!from || !el.contains(from)) from = el;
    if (chosen) return moveDraftTo(p);
    go(p);
  }

  /** ↓ and Inside it: the block it last came up from, else the first inside it in view, else the first. */
  function inside(): void {
    const el = chosen ?? cur;
    const l = el ? kids(el) : [];
    const k = l.find((c) => from && c.el.contains(from)) ?? l.find((c) => inView(c.el)) ?? l[0];
    if (!k) return ctx.say("Nothing inside it");
    if (chosen) moveDraftTo(k.el);
    else go(k.el);
  }

  /**
   * Enter, Space or a screen reader's activate on the cursor: a comment on its block; Shift+Enter (`more`): its
   * threads, one at a time, in page order, wrapping. A draft with words holds the reviewer: they go back to it.
   */
  function act(more = false): void {
    if (!cur) return;
    if (ctx.state.draft && !ctx.draftEmpty()) return ctx.backToDraft();
    if (!more) return commentOn(cur);
    const l = threadsOn(cur);
    if (!l.length) return ctx.say("No comments on this block");
    nth = (nth + 1) % l.length;
    ctx.open(l[nth]!.id);
    if (l.length > 1) ctx.say(`Comment ${nth + 1} of ${l.length} on this block`);
  }

  /** The keys the cursor takes while a marker has focus: stopped, so the page (and a deck) never hears them. */
  function onMarkerKey(e: KeyboardEvent): void {
    if (!["Tab", "ArrowUp", "ArrowDown", "Enter", " ", "Escape"].includes(e.key)) return;
    // ⌘↑, Ctrl↑ and Alt↑ are the page's (top, bottom).
    if (e.key.startsWith("Arrow") && (e.metaKey || e.ctrlKey || e.altKey)) return;
    e.preventDefault();
    e.stopPropagation();
    taken = e.key;
    if (e.key === "Escape") return void ctx.back();
    if (e.key === "Enter" || e.key === " ") return act(e.shiftKey && e.key === "Enter");
    // Moving on closes an open thread, as a click elsewhere does.
    if (ctx.state.active) ctx.open(null);
    if (e.key === "Tab") step(e.shiftKey ? -1 : 1);
    else if (e.key === "ArrowUp") around();
    else inside();
  }

  /** Focus is nowhere: on the page's body, or on Pipeup's own element that has gone inert. */
  const lost = () => {
    const a = focused();
    return a ? !!a.closest("[inert]") : !document.activeElement || document.activeElement === document.body;
  };

  /** The key the cursor took on keydown: its keyup is the cursor's too, wherever focus has gone by then. */
  let taken = "";
  /** Comment mode has ended: the listener stays only for the keyup of the key that ended it (Esc). */
  let ended = false;
  const onKeyUp = (e: KeyboardEvent) => {
    if (ended) window.removeEventListener("keyup", onKeyUp, true);
    if (e.key !== taken) return;
    taken = "";
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("pointermove", onMove, true);
  document.addEventListener("selectionchange", onSelect);
  for (const type of MUTED) window.addEventListener(type, mute, true);
  for (const type of SWALLOWED) window.addEventListener(type, swallow, true);
  window.addEventListener("keydown", onKey, true);

  return {
    back() {
      if (!chosen) return false;
      choose(null);
      return true;
    },
    cursor: () => cur !== null,
    away: () => had && !cur,
    resume,
    refocus() {
      if (cur && !onMarker()) go(cur);
    },
    render() {
      tree = null;
      // The cursor's block left (removed, hidden, or on a slide that isn't here): it lands again in view.
      if (cur && !(cur.isConnected && keep(cur))) {
        const b = firstInView();
        if (b) go(b.el, onMarker() || lost());
        else stow();
      }
      // The views were rebuilt (a new control): the outline, markers and bar go back before it, unless in use.
      const l = ctx.layer.querySelector(".launch");
      if (l && bar.nextElementSibling !== l && !onMarker() && !bar.contains(focused()))
        for (const el of [outline, ...markers, bar]) ctx.layer.insertBefore(el, l);
      const d = ctx.state.draft;
      // The box closed (Esc, sent, dropped) or another one took over: the block lets go with it.
      if (drafted && d !== drafted) {
        drafted = null;
        choose(null);
        // With the cursor in use it comes back on its block, and takes focus back if the draft left it nowhere.
        if (cur) go(cur, lost());
      } else if (d && !drafted && (target || chosen)) choose(null);
    },
    frame() {
      place();
      positionBar();
      if (cur) fit(markers[turn]!, cur.getBoundingClientRect(), 4);
    },
    destroy() {
      // Focus on the cursor goes back where it was before the markers leave.
      if (stow()) giveBack();
      for (const m of markers) m.remove();
      stopFade();
      stopBar();
      ended = true;
      if (!taken) window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("selectionchange", onSelect);
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
