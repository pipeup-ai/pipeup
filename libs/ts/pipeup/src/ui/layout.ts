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
  height: number;
}

export interface AnchorPoint {
  x: number;
  y: number;
  /** Text comments open below their line; element comments open beside. */
  below: boolean;
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

/** The viewport left for popovers: All comments, when open, takes its width from the right. */
export function room(listing: boolean): Viewport {
  const w = window.innerWidth;
  return { width: listing && !narrow() ? w - PANEL : w, height: window.innerHeight };
}

export function placePopover(
  at: AnchorPoint,
  size: { width: number; height: number },
  vp: Viewport,
  margin = 12,
): { left: number; top: number } {
  let left: number;
  let top: number;
  if (at.below) {
    left = Math.min(at.x, vp.width - size.width - margin);
    top = at.y + 8;
    if (top + size.height > vp.height - margin) top = at.y - size.height - 40;
  } else {
    left = at.x + 14;
    if (left + size.width > vp.width - margin) left = at.x - size.width - 28;
    top = Math.min(at.y - 12, vp.height - size.height - margin);
  }
  return { left: Math.max(margin, left), top: Math.max(margin, top) };
}

/**
 * An element draft: just below its block, above it when there is no room below, never over the block or the
 * naming bar (which sits above the block, or below it when there is no room above).
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
  const under = below + size.height <= vp.height - margin || above < margin;
  const top = under ? below : above;
  return {
    above: !under,
    left: Math.max(margin, Math.min(block.left, vp.width - size.width - margin)),
    top: Math.max(margin, top),
  };
}

/** The selection bar: centred above the target, or below it when there's no room; never covering it. */
export function placeBar(
  target: Box,
  size: { width: number; height: number },
  vp: Viewport,
): { left: number; top: number } {
  let top = target.top - size.height - 10;
  if (top < 8) top = target.top + target.height + 10;
  const left = Math.max(
    8,
    Math.min(target.left + target.width / 2 - size.width / 2, vp.width - size.width - 8),
  );
  return { left, top };
}
