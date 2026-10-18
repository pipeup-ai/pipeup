export interface StackItem {
  id: string;
  /** Where the thread wants its top edge (page coordinates). */
  want: number;
  height: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  /** The bottom of what can be seen; `top`, its top (a phone's on-screen keyboard covers the rest). */
  height: number;
  top?: number;
  /**
   * Where the comment control's corner starts (its left and top edges, and the left of comment mode's touch hint
   * beside it): a box reaching past `left` stays above `top`, so nothing sits under the control.
   */
  keep?: { left: number; top: number };
}

export interface AnchorPoint {
  x: number;
  y: number;
  /** Text comments open below their line; element comments open beside. */
  below: boolean;
  /** What it is about: with no room beside, an element or pin's popover goes below it or above, not over it. */
  box: Box;
}

/** Threads sit level with what they're about; overlaps push down; the open thread aligns exactly. */
export function stackColumn(items: StackItem[], activeId: string | null, gap = 10): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.want - b.want);
  const pos: number[] = new Array<number>(sorted.length).fill(0);
  const active = sorted.findIndex((i) => i.id === activeId);
  const item = (i: number) => sorted[i] as StackItem;
  if (active < 0) {
    sorted.forEach((it, i) => {
      pos[i] = i === 0 ? it.want : Math.max(it.want, (pos[i - 1] ?? 0) + item(i - 1).height + gap);
    });
  } else {
    pos[active] = item(active).want;
    for (let i = active + 1; i < sorted.length; i++)
      pos[i] = Math.max(item(i).want, (pos[i - 1] ?? 0) + item(i - 1).height + gap);
    for (let i = active - 1; i >= 0; i--)
      pos[i] = Math.min(item(i).want, (pos[i + 1] ?? 0) - item(i).height - gap);
  }
  return new Map(sorted.map((it, i) => [it.id, pos[i] ?? 0]));
}

/**
 * All comments' width, and a popover's (threads, drafts, the side popover). The only place they are set: the
 * host writes them onto Pipeup's layer as --pu-panel and --pu-pop for the stylesheet.
 */
export const PANEL = 320;
export const POPOVER = 300;
/** A popover's width: roomier where the window has the space (All comments keeps its own width). */
export const popover = (): number => (window.innerWidth >= 900 ? 400 : POPOVER);
/** On screens this narrow or less, All comments takes the whole width (it gets .full). */
export const NARROW = 480;
export const narrow = (): boolean => window.innerWidth <= NARROW;
/** A touch screen: a finger is the main pointer (the stylesheet's `pointer: coarse`). */
export const touch = (): boolean => window.matchMedia?.("(pointer: coarse)").matches === true;

/** How far Pipeup's layer has moved down to follow a page Safari has panned (see `startApp`'s frame). */
let panned = 0;
export const setPanned = (px: number): void => void (panned = px);

/**
 * What of the window can be seen, top to bottom: a phone's on-screen keyboard covers the bottom of the window without
 * making it shorter (only the visual viewport shrinks), and the page may be panned within it.
 */
export function seen(): { top: number; bottom: number } {
  const v = window.visualViewport;
  const top = v ? Math.max(0, v.offsetTop - panned) : 0;
  return { top, bottom: v ? Math.min(window.innerHeight, top + v.height) : window.innerHeight };
}

/** The viewport left for popovers: what can be seen, less All comments' width from the right when it is open. */
export function room(listing: boolean): Viewport {
  const w = window.innerWidth;
  const s = seen();
  return { width: listing && !narrow() ? w - PANEL : w, height: s.bottom, top: s.top };
}

/** The lowest a box from `left`, `width` across, may reach: clear of the comment control's corner, and of the margin. */
const floor = (left: number, width: number, vp: Viewport, margin: number): number =>
  vp.keep && left + width > vp.keep.left ? Math.min(vp.height - margin, vp.keep.top - 8) : vp.height - margin;

export function placePopover(
  at: AnchorPoint,
  size: { width: number; height: number },
  vp: Viewport,
  margin = 12,
): { left: number; top: number } {
  // No room beside (a phone, or the right edge): below what it is about, or above it, not over it.
  if (!at.below && at.x + 14 + size.width > vp.width - margin) return placeDraft(at.box, size, vp, margin, 0);
  const left = Math.max(margin, at.below ? Math.min(at.x, vp.width - size.width - margin) : at.x + 14);
  const low = floor(left, size.width, vp, margin);
  let top = at.below ? at.y + 8 : at.y - 12;
  if (at.below && top + size.height > low) top = at.y - size.height - 40;
  // Always in what can be seen, even when what it is about has gone below it (a phone turned on its side, or its
  // keyboard up).
  return { left, top: Math.max((vp.top ?? 0) + margin, Math.min(top, low - size.height)) };
}

/**
 * An element draft: just below its block, above it when there is no room below, never over the block or the
 * naming bar (which sits above the block, or below it when there is no room above). A block too tall for either
 * keeps the box on screen, as low as it fits. Where the comment control's corner is in the way below, the box moves left
 * of the control if it can, rather than up over the block.
 */
export function placeDraft(
  block: Box,
  size: { width: number; height: number },
  vp: Viewport,
  margin = 12,
  bar = 44,
): { left: number; top: number; above: boolean } {
  const barAbove = block.top - bar >= 8;
  const below = block.top + block.height + 8 + (barAbove ? 0 : bar);
  const above = block.top - 8 - (barAbove ? bar : 0) - size.height;
  let left = Math.max(margin, Math.min(block.left, vp.width - size.width - margin));
  const fits = (l: number) => below + size.height <= floor(l, size.width, vp, margin);
  const aside = vp.keep ? vp.keep.left - 8 - size.width : -1;
  if (!fits(left) && aside >= margin && fits(aside)) left = Math.min(left, aside);
  const low = floor(left, size.width, vp, margin);
  const min = (vp.top ?? 0) + margin;
  const under = below + size.height <= low || above < min;
  // Whichever side, the box stays in what can be seen: with a phone's keyboard up, over its block if it must.
  return { above: !under, left, top: Math.max(min, Math.min(under ? below : above, low - size.height)) };
}

/**
 * The naming bar (and the selection's icon): centred above the target, or below it when there's no room; never covering
 * it. A target taller than the window has room for neither: the bar sits at the window's top, over it.
 */
export function placeBar(
  target: Box,
  size: { width: number; height: number },
  vp: Viewport,
): { left: number; top: number } {
  const above = target.top - size.height - 10;
  let top = above < 8 ? target.top + target.height + 10 : above;
  if (top + size.height > vp.height - 8) top = Math.max(8, above);
  const left = Math.max(
    8,
    Math.min(target.left + target.width / 2 - size.width / 2, vp.width - size.width - 8),
  );
  return { left, top };
}

/**
 * The selection's comment icon: just past the right of its block's text, level with the selection's last line, so it
 * covers no words; above the selection (or below) when there's no room there. On a touch screen (`below`), at the
 * window's right edge, level with the selection's last line (its first, when the last runs into that edge): the
 * phone's own menu for a selection sits above or below it, never beside, and its handles sit at its ends.
 */
export function placeIcon(
  sel: Box,
  line: Box,
  textRight: number,
  size: { width: number; height: number },
  vp: Viewport,
  below = false,
): { left: number; top: number } {
  const left = textRight + 8;
  if (below) {
    const edge = vp.width - size.width - 4;
    const mid = line.left + line.width < edge - 8 ? line.top + line.height / 2 : sel.top + line.height / 2;
    const top = Math.max((vp.top ?? 0) + 8, Math.min(mid - size.height / 2, vp.height - size.height - 8));
    return { left: edge, top };
  }
  if (left + size.width > vp.width - 8) return placeBar(sel, size, vp);
  return { left, top: line.top + line.height / 2 - size.height / 2 };
}
