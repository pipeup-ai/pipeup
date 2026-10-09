import { labelOf } from "../anchor/locate";
import { nameOf } from "../model/animals";
import type { Thread } from "../model/types";
import type { Ctx, Draft, View } from "./context";
import { clip, fit, h, inert, linkify, reorder } from "./dom";
import { draftBox, type DraftBox } from "./draft-view";
import { bubblePoint, popoverAnchor } from "./geometry";
import { placeDraft, placePopover, popover, room, type AnchorPoint } from "./layout";
import { threadNotes } from "./notes";
import { byPage } from "./order";
import { threadView, type ThreadView } from "./thread-view";

const INTERACTIVE = "a,button,input,select,textarea,label,summary,[role=button],[contenteditable]";
/** How long a preview waits after the pointer leaves, so the pointer can reach it and click. */
export const PREVIEW_GRACE_MS = 400;

/**
 * Bubbles for element and pin comments, a hover preview, and (unless the document column is showing
 * threads) a popover. Text comments have no bubble: their highlight is what you hover and click.
 */
export function createBubbles(ctx: Ctx, opts: { popovers: boolean }): View {
  const bubbles = new Map<string, HTMLButtonElement>();
  const tip = h("div", { class: "tip", role: "tooltip" });
  const mark = h("div", { class: "mark" });
  const pop = h("div", { class: "pop", role: "dialog", "aria-label": "Comment thread" });
  // Hidden, the preview and the popover are out of the keyboard's reach: a closed thread's reply line never
  // takes typing. (The preview is pointer-only; bubbles give keyboard users the thread.)
  tip.inert = pop.inert = true;
  ctx.layer.append(mark, tip, pop);
  /** The pin being written, shown at its point until the draft is sent or dropped (in the layer only then). */
  const ghost = h("div", { class: "bub pin ghost", "aria-hidden": "true" });
  let threads: readonly Thread[] = [];
  let shown: Thread | null = null;
  let shownView: ThreadView | null = null;
  /** The reply an add-on was writing into the shown thread when it was last drawn. */
  let shownNote: string | undefined;
  let draft: { box: DraftBox; of: Draft; at: unknown; above: boolean | null } | null = null;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  let gliding = 0;
  /** The thread under the pointer (its bubble, highlight or preview). */
  let hovered: string | null = null;
  /** The highlight the pointer was last over on the page (null over nothing, or over Pipeup's own UI). */
  let onQuote: string | null = null;
  let tipFor: string | null = null;
  let leaving = 0;

  const byId = (id: string) => threads.find((t) => t.id === id) ?? null;
  /** Threads open as popovers here: always with bubbles, and in the column layout while All comments covers it. */
  const pops = () => opts.popovers || ctx.state.listing;
  let listing = false;

  /** Previews and popovers sit in the same place: below quoted text, beside a bubble or pin. */
  const at = (t: Thread): AnchorPoint | null => {
    const r = ctx.resolved.get(t.id);
    return r ? popoverAnchor(t.anchor, r) : null;
  };
  function put(el: HTMLElement, where: AnchorPoint, width: number): void {
    // Never under All comments.
    const { left, top } = placePopover(
      where,
      { width: el.offsetWidth || width, height: el.offsetHeight },
      room(ctx.state.listing),
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  /** Shows the preview for thread `id` (not while it's open, and not in the document column), or hides it. */
  function showTip(id: string | null): void {
    const t = id && pops() && ctx.state.active !== id ? byId(id) : null;
    const where = t ? at(t) : null;
    if (!t || !where) {
      tipFor = null;
      tip.classList.remove("show");
      inert(tip, true);
      return;
    }
    if (tipFor !== t.id) {
      const n = t.root.replies.length;
      tip.replaceChildren(
        h("div", { class: "tx clamp" }, ...(t.root.deleted ? ["Deleted"] : linkify(t.root.text))),
        h("div", { class: "who" }, `${nameOf(t.root)}${n ? ` · ${n} ${n === 1 ? "reply" : "replies"}` : ""}`),
      );
      tipFor = t.id;
    }
    put(tip, where, 260);
    // A preview that is already showing glides to a new place; a new one appears where it belongs.
    if (!tip.classList.contains("show")) void tip.offsetWidth;
    tip.classList.add("show");
    tip.inert = false;
  }

  function settle(id: string | null): void {
    hovered = id;
    showTip(id);
    ctx.hot(id);
  }

  /** The pointer is now on thread `id`'s bubble, highlight or preview, or on none of them (null). */
  function pointAt(id: string | null): void {
    window.clearTimeout(leaving);
    if (id !== null) {
      settle(id);
      return;
    }
    // Let go only after a grace period, so the pointer can travel onto the preview and click it.
    leaving = window.setTimeout(() => settle(null), pops() ? PREVIEW_GRACE_MS : 0);
  }

  tip.addEventListener("mouseenter", () => window.clearTimeout(leaving));
  tip.addEventListener("mouseleave", () => pointAt(null));
  tip.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = tipFor;
    if (!id) return;
    window.clearTimeout(leaving);
    // The pointer is about to leave with the preview: drop the hover so nothing returns after Esc.
    settle(null);
    ctx.open(id);
  });

  function bubbleFor(t: Thread): HTMLButtonElement {
    const existing = bubbles.get(t.id);
    if (existing) return existing;
    // `data-thread`: Esc in the thread it opens comes back here.
    const b = h("button", { class: "bub", type: "button", "data-thread": t.id });
    b.addEventListener("mouseenter", () => pointAt(t.id));
    b.addEventListener("mouseleave", () => pointAt(null));
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      // Clicking always opens. Escape, a click elsewhere or opening another thread closes.
      showTip(null);
      ctx.open(t.id);
    });
    ctx.layer.insertBefore(b, mark);
    bubbles.set(t.id, b);
    return b;
  }

  /** The draft box is stepped aside because its slide or view is elsewhere. */
  let stepped = false;

  function place(): void {
    const d = ctx.state.draft;
    const block = draft && d && !d.anchor.quote && !d.anchor.point ? d.resolved.element : null;
    if (block) {
      // A block's box sits below it (above if no room), so it never covers what it is about.
      const { left, top, above } = placeDraft(
        block.getBoundingClientRect(),
        { width: pop.offsetWidth || popover(), height: pop.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      const flipped = draft?.above !== null && draft?.above !== above;
      if (draft) draft.above = above;
      if (flipped && move()) return;
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      return;
    }
    const where = draft && d ? popoverAnchor(d.anchor, d.resolved) : shown ? at(shown) : null;
    if (where) put(pop, where, popover());
  }

  /** The naming bar already names this draft's block, so its box needn't. */
  const named = (d: Draft) => ctx.state.commenting && !d.anchor.quote && !d.anchor.point;

  /**
   * The open box moves (to another side of its block, another block, or beside All comments): it glides, or
   * with reduced motion fades out, changes and moves while unseen, and fades back in. True when it waits to move.
   */
  function move(change: () => void = () => {}): boolean {
    window.clearTimeout(gliding);
    if (reduced) {
      pop.classList.remove("show");
      gliding = window.setTimeout(() => {
        change();
        place();
        pop.classList.add("show");
      }, 220);
      return true;
    }
    change();
    pop.classList.add("glide");
    gliding = window.setTimeout(() => pop.classList.remove("glide"), 450);
    return false;
  }

  /** The element an open element thread (or element draft) is about, outlined while its popover shows. */
  function marked(): Element | null {
    if (!pops()) return null;
    const d = ctx.state.draft;
    // In comment mode the chosen block's own outline marks it.
    if (d) return d.anchor.quote || d.anchor.point || ctx.state.commenting ? null : d.resolved.element;
    if (!shown || shown.anchor.quote || shown.anchor.point) return null;
    return ctx.resolved.get(shown.id)?.element ?? null;
  }

  function render(list: readonly Thread[]): void {
    threads = list;
    const live = new Set<string>();
    for (const t of list) {
      if (!ctx.visible(t) || t.anchor.quote) continue;
      const r = ctx.resolved.get(t.id);
      if (!r || r.state === "orphaned") continue;
      live.add(t.id);
      const b = bubbleFor(t);
      b.classList.toggle("done", t.resolved);
      b.classList.toggle("on", ctx.state.active === t.id);
      b.classList.toggle("pin", t.anchor.point !== undefined);
      // Its name says what it is on, and keeps up with the comment.
      const name = `Comment on ${labelOf(r.element!)}: ${clip(t.root.text, 60)}`;
      if (b.getAttribute("aria-label") !== name) b.setAttribute("aria-label", name);
    }
    // Tab meets the bubbles in page order, before the preview and the popover.
    reorder(
      ctx.layer,
      list
        .filter((t) => live.has(t.id))
        .sort(byPage(ctx))
        .map((t) => bubbles.get(t.id)!),
      mark,
    );
    for (const [id, b] of bubbles) {
      if (live.has(id)) continue;
      b.classList.remove("in");
      bubbles.delete(id);
      window.setTimeout(() => b.remove(), 300);
    }
    // The preview follows the thread it shows (it hides once that thread opens).
    showTip(hovered);
    // All comments opening or closing changes the room beside it: an open popover glides to its new place.
    if (listing !== ctx.state.listing && pop.classList.contains("show") && !reduced) move();
    listing = ctx.state.listing;

    const d = opts.popovers ? ctx.state.draft : null;
    if (d) {
      const where = d.anchor.point ?? d.resolved.element;
      if (draft?.of !== d) {
        window.clearTimeout(gliding);
        pop.classList.remove("glide");
        draft = { box: draftBox(ctx, d), of: d, at: where, above: null };
        draft.box.hideLabel(named(d));
        pop.replaceChildren(draft.box.element);
        pop.inert = false;
        draft.box.focus();
        shown = null;
        shownView = null;
        place();
        pop.classList.add("show");
      } else if (draft) {
        // Moved to another block: the same box, its words and focus kept, glides (or fades) there.
        if (draft.at !== where) {
          draft.at = where;
          draft.above = null;
          move(() => draft?.box.setLabel(d.label));
        }
        draft.box.hideLabel(named(d));
      }
      // Its slide or view is elsewhere: the words wait, the box steps aside and comes back with the reviewer.
      const away = !ctx.here.holds(d.anchor.view);
      if (away !== stepped) {
        stepped = away;
        pop.classList.toggle("show", !away);
        pop.inert = away;
        if (!away) place();
      }
      return;
    }
    if (draft) {
      // A move still waiting to show the box again must not bring this one back.
      window.clearTimeout(gliding);
      pop.classList.remove("glide");
      draft = null;
      stepped = false;
      ctx.registerDraft(null);
    }

    const next = pops() && ctx.state.active ? byId(ctx.state.active) : null;
    if (!next || !ctx.visible(next)) {
      shown = null;
      shownView = null;
      pop.classList.remove("show");
      inert(pop, true);
      return;
    }
    const quote = next.anchor.quote?.exact ?? null;
    if (!shown || !shownView || shown.id !== next.id) {
      shownView = threadView(next, ctx.actions, { variant: "popover", quote });
      pop.replaceChildren(shownView.element);
      shown = next;
      shownNote = threadNotes.get(next.id);
      place();
      pop.classList.add("show");
      pop.inert = false;
    } else if (shown !== next || shownNote !== threadNotes.get(next.id)) {
      // The same thread, refolded after some change: update in place so a reply being typed survives.
      shownView.update(next, { quote });
      shown = next;
      shownNote = threadNotes.get(next.id);
    }
  }

  function frame(): void {
    for (const [id, b] of bubbles) {
      const t = byId(id);
      const r = ctx.resolved.get(id);
      const p = t && r ? bubblePoint(t.anchor, r) : null;
      if (!p || p.y < -40 || p.y > window.innerHeight + 40) {
        b.style.visibility = "hidden";
        continue;
      }
      b.style.visibility = "";
      b.style.left = `${p.x}px`;
      b.style.top = `${p.y}px`;
      if (!b.classList.contains("in")) {
        void b.offsetWidth;
        b.classList.add("in");
      }
    }
    const d = ctx.state.draft;
    const g = d?.anchor.point && ctx.here.holds(d.anchor.view) ? bubblePoint(d.anchor, d.resolved) : null;
    if (g) {
      ghost.style.left = `${g.x}px`;
      ghost.style.top = `${g.y}px`;
      if (!ghost.classList.contains("in")) {
        ctx.layer.insertBefore(ghost, mark);
        void ghost.offsetWidth;
        ghost.classList.add("in");
      }
    } else if (ghost.classList.contains("in")) {
      // Fades out where it is, then leaves the layer (unless a new pin took it back meanwhile).
      ghost.classList.remove("in");
      window.setTimeout(() => ghost.classList.contains("in") || ghost.remove(), 300);
    }
    if (pop.classList.contains("show")) place();
    const m = marked();
    mark.classList.toggle("show", m !== null);
    if (m) fit(mark, m.getBoundingClientRect(), 4);
  }

  const onMove = (e: PointerEvent) => {
    // Over Pipeup's own UI the pointer has left any highlight. A bubble or the preview tracks the pointer
    // itself (enter and leave); anything else (the popover, the control) lets go after the grace period.
    if (ctx.owns(e)) {
      const over = e.composedPath()[0];
      if (onQuote !== null && !(over instanceof Element && over.closest(".tip,.bub"))) pointAt(null);
      onQuote = null;
      return;
    }
    // Comments only show in comment mode, so highlights preview there too, unless a comment is being written.
    const id = ctx.readsAt(e.clientX, e.clientY)?.id ?? null;
    if (id === onQuote) return;
    onQuote = id;
    pointAt(id);
  };

  const onClick = (e: MouseEvent) => {
    if (ctx.owns(e)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    // In comment mode the page's controls are quiet, so a highlight on one still opens; Option-click pins.
    if (ctx.state.commenting ? e.altKey : e.target instanceof Element && e.target.closest(INTERACTIVE))
      return;
    // A draft with words in it keeps them (the same rule as hovering). Comment mode leaves a click on a
    // highlight to this listener, whichever was added first, so it reads the thread instead of picking a block.
    const found = ctx.readsAt(e.clientX, e.clientY);
    if (!found) return;
    ctx.claim(e);
    showTip(null);
    ctx.open(found.id);
  };

  window.addEventListener("pointermove", onMove, { capture: true, passive: true });
  window.addEventListener("click", onClick, true);

  return {
    render,
    frame,
    destroy() {
      window.clearTimeout(leaving);
      window.clearTimeout(gliding);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("click", onClick, true);
      ctx.registerDraft(null);
      for (const b of bubbles.values()) b.remove();
      ghost.remove();
      tip.remove();
      mark.remove();
      pop.remove();
    },
  };
}
