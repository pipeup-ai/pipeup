import type { Thread } from "../model/types";
import type { Ctx, Draft, View } from "./context";
import { clip, h, inert, reorder } from "./dom";
import { draftBox, type DraftBox } from "./draft-view";
import { anchorTop } from "./geometry";
import { stackColumn, type StackItem } from "./layout";
import { notesKey } from "./notes";
import { byPage } from "./order";
import { plural, replies, threadView, type ThreadView } from "./thread-view";

/** Free width needed beside the content before comments get their own column. */
export const COLUMN_MIN = 300;
const GAP_FROM_CONTENT = 32;
/** The exit motion (0.20 s) plus a frame, before a faded-out element is removed. */
const EXIT_MS = 220;
/** The comment control's corner: a 32 px square flush with the window's edges (44 on touch screens). */
const CORNER = 44;
/** A comment taller than this at rest (four lines and a little) shows its first lines, then "more". */
const LONG = 88;

/** Width of the gutter that pages with data-pipeup-reserve keep for comments. */
export const GUTTER = 320;
/** Once the column shows on a reserving page, the window can narrow this much before it gives way. */
const HYSTERESIS = 24;
const GUTTER_PADDING = 24;

/** Where the column goes (viewport x and width), or null when the page should use bubbles. */
export function columnSpot(root: Element, showing = false): { x: number; width: number } | null {
  const html = root.ownerDocument.documentElement;
  const pref = html.getAttribute("data-pipeup-layout");
  if (pref === "bubbles" || root.querySelector("[data-pipeup-slide]")) return null;
  const main = root.querySelector("article, main, [role=main]") ?? (pref === "column" ? root : null);
  if (!main) return null;
  if (html.hasAttribute("data-pipeup-reserve")) {
    // Decided from the window, not the free space: publishing the gutter changes the free space.
    const width = html.clientWidth;
    const style = getComputedStyle(main);
    const max = style.maxWidth;
    let content: number;
    if (max.endsWith("px")) content = parseFloat(max);
    // Percentages stay unresolved in computed style; use the share of the window. The page shrinks when the
    // gutter opens, so the hysteresis band scales by 1/(1-p): for 80% it is on at 1600 and off below 1480.
    else if (max.endsWith("%")) content = (parseFloat(max) / 100) * width;
    // Measured alone: stable for a fixed width, and a fluid page tracks the window so it never gets a column.
    else content = main.getBoundingClientRect().width;
    if (pref !== "column" && width < content + GUTTER - (showing ? HYSTERESIS : 0)) return null;
    return { x: width - GUTTER + GUTTER_PADDING, width: GUTTER - 2 * GUTTER_PADDING };
  }
  const right = main.getBoundingClientRect().right;
  if (window.innerWidth - right < COLUMN_MIN && pref !== "column") return null;
  const x = right + GAP_FROM_CONTENT;
  return { x, width: Math.max(220, Math.min(300, window.innerWidth - x - 16)) };
}

interface Item {
  el: HTMLElement;
  thread: Thread;
  lost: boolean;
  moved: boolean;
  /** The reply an add-on was writing into this thread when it was last drawn. */
  note?: string;
  view: ThreadView;
  /** Last known line (page y); a thread waiting for its fuzzy match stays there. */
  placed: number | null;
}

/** The thread's content is gone (not just waiting for its fuzzy match). */
export function lost(ctx: Ctx, t: Thread): boolean {
  const r = ctx.resolved.get(t.id);
  return !r || (r.state === "orphaned" && !ctx.pending.has(t.id));
}

/** The thread's content was found changed, or nearby: it is flagged Moved, for someone to confirm. */
export const moved = (ctx: Ctx, t: Thread): boolean => ctx.resolved.get(t.id)?.state === "moved";

/** Threads beside the document, level with what they're about; the open one aligns exactly. */
export function createColumn(ctx: Ctx): View {
  const col = h("div", { class: "col" });
  ctx.layer.append(col);
  const items = new Map<string, Item>();
  let draft: { el: HTMLElement; box: DraftBox; of: Draft } | null = null;
  const sizes = new ResizeObserver(() => restack());
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const isLost = (t: Thread) => lost(ctx, t);

  function want(t: Thread): number {
    const r = ctx.resolved.get(t.id);
    const top = r ? anchorTop(t.anchor, r) : null;
    return top === null ? Number.POSITIVE_INFINITY : top + window.scrollY - 4;
  }

  /**
   * Moves a thread (or the draft) to `y`. With reduced motion it never slides: it fades out, moves while unseen and fades
   * back in, and moves asked for meanwhile join that one.
   */
  const hops = new WeakMap<HTMLElement, string>();
  function moveTo(el: HTMLElement, y = 0): void {
    const t = `translateY(${Math.round(y)}px)`;
    if (!reduced || !el.style.transform) return void (el.style.transform = t);
    if (el.style.transform === t && !hops.has(el)) return;
    if (!hops.has(el)) {
      el.classList.add("hop");
      // It moves once it has faded right out (a busy page can start the fade late).
      const land = () => {
        if (+getComputedStyle(el).opacity > 0.01) return void requestAnimationFrame(land);
        el.style.transform = hops.get(el)!;
        hops.delete(el);
        el.classList.remove("hop");
      };
      window.setTimeout(land, 200);
    }
    hops.set(el, t);
  }

  function restack(): void {
    const finite: StackItem[] = [];
    const lost: { id: string; height: number }[] = [];
    // A long comment at rest shows its first lines, then "more": measured here, where the cards are laid out anyway.
    for (const { el } of items.values()) {
      const tx = el.querySelector<HTMLElement>(".root>.tx");
      if (!tx) continue;
      tx.style.setProperty("--full", `${tx.scrollHeight}px`);
      el.classList.toggle("long", tx.scrollHeight > LONG);
    }
    for (const [id, item] of items) {
      let w = want(item.thread);
      if (Number.isFinite(w)) item.placed = w;
      else if (ctx.pending.has(id)) {
        if (item.placed === null) {
          item.el.classList.add("wait");
          continue;
        }
        w = item.placed;
      }
      if (Number.isFinite(w)) finite.push({ id, want: w, height: item.el.offsetHeight });
      else lost.push({ id, height: item.el.offsetHeight });
    }
    const d = ctx.state.draft;
    const top = d ? anchorTop(d.anchor, d.resolved) : null;
    if (draft && top !== null)
      finite.push({ id: "draft", want: top + window.scrollY - 4, height: draft.el.offsetHeight });
    // The open thread or draft lines up with its words, nudged up if the comment control would cover it. A new
    // comment's box and buttons are always in the window, even on the page's last lines.
    const lead = draft ? "draft" : ctx.state.active;
    const f = finite.find((x) => x.id === lead);
    const corner = col.getBoundingClientRect().right > window.innerWidth - CORNER ? CORNER : 0;
    if (f && (corner || draft))
      f.want = Math.max(
        window.scrollY + 8,
        Math.min(f.want, window.scrollY + window.innerHeight - corner - 10 - f.height),
      );
    const pos = stackColumn(finite, lead);
    let y = Math.max(0, ...finite.map((f) => (pos.get(f.id) ?? 0) + f.height)) + 24;
    for (const l of lost) {
      pos.set(l.id, y);
      y += l.height + 10;
    }
    for (const [id, el] of [
      ...[...items].map(([id, i]) => [id, i.el] as const),
      ["draft", draft?.el] as const,
    ]) {
      if (!el) continue;
      if (el.classList.contains("wait")) {
        if (!pos.has(id) && el !== draft?.el) continue;
        // First placement: appear in place (fading in), don't glide in from the top.
        el.style.transition = "none";
        el.style.transform = `translateY(${Math.round(pos.get(id) ?? 0)}px)`;
        void el.offsetWidth;
        el.style.transition = "";
        el.classList.remove("wait");
        continue;
      }
      moveTo(el, pos.get(id));
    }
  }

  function fill(item: Item, t: Thread): void {
    item.thread = t;
    item.note = notesKey(t);
    item.lost = isLost(t);
    item.moved = moved(ctx, t);
    item.view.update(t, { lost: item.lost ? t.anchor.snapshot : null, moved: item.moved });
  }

  function create(t: Thread): Item {
    const lost = isLost(t);
    const view = threadView(t, ctx.actions, {
      variant: "column",
      lost: lost ? t.anchor.snapshot : null,
      moved: moved(ctx, t),
    });
    // A closed thread opens from the keyboard with its button, which has no box of its own (the thread shows its
    // focus); `data-thread`: Esc in the open thread comes back to it.
    // It waits unseen until it is first placed, then fades in there.
    const el = h(
      "div",
      { class: "th wait", "data-thread": t.id },
      h("button", { class: "opn sr", type: "button", "data-thread": t.id }),
      view.element,
    );
    el.addEventListener("mouseenter", () => ctx.hot(t.id));
    el.addEventListener("mouseleave", () => ctx.hot(null));
    el.addEventListener("click", () => ctx.open(t.id));
    col.append(el);
    sizes.observe(el);
    return { el, thread: t, lost, moved: moved(ctx, t), placed: null, view };
  }

  /** Fades an element out (no longer measured) and removes it. */
  function leave(el: HTMLElement): void {
    sizes.unobserve(el);
    el.classList.add("out");
    window.setTimeout(() => el.remove(), EXIT_MS);
  }

  function syncDraft(): void {
    // While All comments is open, a new comment is written there instead.
    const d = ctx.state.listing ? null : ctx.state.draft;
    if (draft && draft.of !== d) {
      leave(draft.el);
      draft = null;
      if (!d) ctx.registerDraft(null);
    }
    if (!d) return;
    const made = !draft;
    if (draft) draft.box.setLabel(d.label);
    else {
      const box = draftBox(ctx, d);
      const el = h("div", { class: "th on wait" }, box.element);
      col.append(el);
      sizes.observe(el);
      draft = { el, box, of: d };
    }
    draft.box.hideLabel(ctx.state.commenting && !d.anchor.quote && !d.anchor.point);
    if (made) draft.box.focus();
  }

  function render(list: readonly Thread[]): void {
    // Under All comments the column steps aside (faded, out of reach); chosen threads open as popovers.
    inert(col, ctx.state.listing);
    const live = new Set<string>();
    const focused = ctx.state.active !== null || ctx.state.draft !== null;
    for (const t of list) {
      if (!ctx.visible(t)) continue;
      let item = items.get(t.id);
      // A comment just sent waits for its draft to go, then takes the draft's place.
      if (!item && ctx.state.draft?.sending) continue;
      live.add(t.id);
      if (!item) {
        item = create(t);
        items.set(t.id, item);
      } else if (
        item.thread !== t ||
        item.lost !== isLost(t) ||
        item.moved !== moved(ctx, t) ||
        item.note !== notesKey(t)
      ) {
        fill(item, t);
      }
      const el = item.el;
      const on = ctx.state.active === t.id;
      el.classList.toggle("on", on);
      const opn = el.firstElementChild as HTMLElement;
      const n = replies(t).length;
      opn.setAttribute("aria-label", `Open thread: ${clip(t.root.text, 60)}, ${plural(n)}`);
      opn.setAttribute("aria-expanded", String(on));
      inert(opn, on);
      // A closed thread's replies and reply line are folded away, and out of the keyboard's reach.
      const more = el.querySelector<HTMLElement>(".more");
      if (more) inert(more, !on);
      el.classList.toggle("dim", focused && !on);
      el.classList.toggle("hot", ctx.state.hot === t.id && !on);
      el.classList.toggle("resolved", t.resolved);
      el.classList.toggle("lost", item.lost);
    }
    for (const [id, item] of items) {
      if (live.has(id)) continue;
      items.delete(id);
      leave(item.el);
    }
    syncDraft();
    // Tab meets the threads in page order, before the draft; moved ones settle before they glide.
    if (
      reorder(
        col,
        list
          .filter((t) => live.has(t.id))
          .sort(byPage(ctx))
          .map((t) => items.get(t.id)!.el),
        draft?.el ?? null,
      )
    )
      void col.offsetWidth;
    restack();
  }

  function frame(): void {
    const spot = columnSpot(ctx.root, true);
    if (!spot) return;
    col.style.width = `${spot.width}px`;
    col.style.transform = `translate(${spot.x}px, ${-window.scrollY}px)`;
  }

  return {
    render,
    frame,
    destroy() {
      sizes.disconnect();
      ctx.registerDraft(null);
      col.remove();
    },
  };
}
