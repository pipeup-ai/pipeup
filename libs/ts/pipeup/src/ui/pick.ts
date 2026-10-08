/** What picking needs to know about the page's layout (faked in unit tests). */
export interface Look {
  box(el: Element): { left: number; top: number; width: number; height: number };
  /** The element draws something of its own — a background, border or shadow — so it reads as a block. */
  drawn(el: Element): boolean;
  /** The element lays out its children as flex or grid, so with several children it visibly groups them. */
  grouped(el: Element): boolean;
  viewport(): { width: number; height: number };
  /**
   * How the element sits in the page, for the keyboard's tree: its computed `display` and `position`, whether it
   * clips what overflows it (hidden or clip, never a scroll box), and whether it is set not to respond to the
   * pointer. Optional: without it every block counts.
   */
  flow?(el: Element): Flow;
}

export interface Flow {
  display: string;
  position: string;
  clips: boolean;
  off: boolean;
}
const FLOWING: Flow = { display: "block", position: "static", clips: false, off: false };
/** An inline-level box taller than this is a block in its own right (an inline-block card), not words in a line. */
const LINE = 48;

/** Accessible roles that make an element "a thing" (widgets, landmarks and structure). */
const ROLES = (
  "button link img figure region list listitem tab tabpanel article navigation complementary banner " +
  "contentinfo form search group dialog menu menuitem checkbox switch radio slider textbox combobox option " +
  "row cell heading table"
)
  .split(" ")
  .map((r) => `[role=${r}]`);
/** Things that are obviously "a thing" to comment on. */
const OBVIOUS = [
  "button,a,input,select,textarea,label,summary,details,img,svg,canvas,video,picture,figure,figcaption,table,th,td",
  "li,ul,ol,dl,dt,dd,p,h1,h2,h3,h4,h5,h6,blockquote,pre",
  "section,article,aside,nav,header,footer,main,form,fieldset",
  ...ROLES,
].join(",");
/** Controls whose own layout wrappers are part of them, never blocks of their own. */
const CONTROL = "a,button,label,summary,[role=button],[role=link],[role=tab],[role=option],[role=menuitem]";
/** What the keyboard still stops on inside a line of text, or when tiny: controls and pictures. */
const STANDS = `${CONTROL},input,select,textarea,img,svg,canvas,video,picture,[role=img]`;
/** A block this size or smaller both ways is a decoration to the keyboard, unless it is a control or marked. */
const TINY = 24;
/** Containers covering more of the window than this are the page, not a block. */
const LARGE = 0.6;
/** Boxes within this many pixels of each other are the same block. */
const SAME = 2;

type Box = ReturnType<Look["box"]>;
const sameBox = (a: Box, b: Box) =>
  Math.abs(a.left - b.left) <= SAME &&
  Math.abs(a.top - b.top) <= SAME &&
  Math.abs(a.width - b.width) <= SAME &&
  Math.abs(a.height - b.height) <= SAME;

/** `el` is a block a click would choose: big enough to see, and marked, obvious, drawn or grouping things. */
export function isBlock(el: Element, look: Look): boolean {
  const b = look.box(el);
  if (b.width < 2 || b.height < 2) return false;
  if (el.hasAttribute("data-pipeup-id")) return true;
  const vp = look.viewport();
  return (
    b.width * b.height <= LARGE * vp.width * vp.height &&
    (el.matches(OBVIOUS) ||
      look.drawn(el) ||
      // A flex or grid box holding several things groups them, unless it is a control's own inner layout.
      (el.childElementCount > 1 && !el.parentElement?.closest(CONTROL) && look.grouped(el)))
  );
}

/** The obvious block under `from`: what the outline glides to in comment mode. */
export function pickBlock(from: Element, root: Element, look: Look): Element | null {
  if (from === root || !root.contains(from) || from.closest("[data-pipeup-ignore]")) return null;
  let found: Element | null = null;
  for (let el: Element | null = from; el && el !== root && !found; el = el.parentElement)
    if (isBlock(el, look)) found = el;
  if (!found || found.hasAttribute("data-pipeup-id")) return found;
  // Prefer what the author marked: a marked element drawn exactly around the found one.
  const b = look.box(found);
  for (let el = found.parentElement; el && el !== root && sameBox(look.box(el), b); el = el.parentElement)
    if (el.hasAttribute("data-pipeup-id")) return el;
  return found;
}

/** The next block out from `el` with a different box (wrappers the same size are skipped). */
export function parentBlock(el: Element, root: Element, look: Look): Element | null {
  const b = look.box(el);
  for (let p = el.parentElement; p && p !== root;) {
    const next = pickBlock(p, root, look);
    if (!next) return null;
    if (!sameBox(look.box(next), b)) return next;
    p = next.parentElement;
  }
  return null;
}

/** The real page: boxes from layout, "drawn" and "grouped" from computed styles. */
export function pageLook(win: Window = window): Look {
  return {
    box: (el) => el.getBoundingClientRect(),
    drawn: (el) => {
      const s = win.getComputedStyle(el);
      const painted = s.backgroundColor !== "transparent" && !/,\s*0\)$/.test(s.backgroundColor);
      const bordered = ["top", "right", "bottom", "left"].some(
        (side) => parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0,
      );
      return painted || bordered || s.backgroundImage !== "none" || s.boxShadow !== "none";
    },
    grouped: (el) => /^(inline-)?(flex|grid)$/.test(win.getComputedStyle(el).display),
    flow: (el) => {
      const s = win.getComputedStyle(el);
      const axes = [s.overflowX, s.overflowY];
      return {
        display: s.display,
        position: s.position,
        // A box that scrolls on either axis can bring what overflows it into view: it never hides it.
        clips:
          axes.some((o) => o === "hidden" || o === "clip") &&
          !axes.some((o) => o === "auto" || o === "scroll") &&
          el !== win.document.documentElement &&
          el !== win.document.body,
        off: s.pointerEvents === "none",
      };
    },
    viewport: () => ({ width: win.innerWidth, height: win.innerHeight }),
  };
}

/** A block in the keyboard's tree: the block around it, and its level (0 with no block inside it). */
export interface Block {
  el: Element;
  up: Block | null;
  level: number;
}

const meets = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;
const within = (a: Box, b: Box): Box => {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(0, Math.min(a.left + a.width, b.left + b.width) - left),
    height: Math.max(0, Math.min(a.top + a.height, b.top + b.height) - top),
  };
};

/**
 * Every block under `root` in page order, each with the block around it as `parentBlock` finds it: wrappers the
 * same size fold into the innermost, unless the outer one is marked (`data-pipeup-id`) and the inner one isn't.
 * Ignored areas, subtrees hidden from screen readers or clipped out of sight, and subtrees `keep` rejects
 * (hidden, on another slide), are left out. The keyboard stops only where a reviewer would click: never on what
 * doesn't take the pointer, on the parts inside a control (the control is the stop), on words styled inside a
 * line of text, or on tiny decorations; what the author marked always counts.
 */
export function blockTree(root: Element, look: Look, keep: (el: Element) => boolean = () => true): Block[] {
  const all: Block[] = [];
  /**
   * `clip`: the box the nearest clipping ancestor (`clipper`) shows; `inControl`: inside a link or button;
   * `inLine`: laid out in a line of text by its parent (an inline-flex or inline-grid box, or a flex or grid box
   * that is itself in a line: their items are blockified, so their own display can't tell).
   */
  const visit = (
    parent: Element,
    up: Block | null,
    clip: Box | null,
    clipper: Element | null,
    inControl: boolean,
    inLine: boolean,
  ): void => {
    for (const el of parent.children) {
      if (el.hasAttribute("data-pipeup-ignore") || el.getAttribute("aria-hidden") === "true" || !keep(el))
        continue;
      const f = look.flow?.(el) ?? FLOWING;
      // Fixed boxes, and absolute ones placed against something outside the clipper, aren't clipped by it.
      const offParent = (el as HTMLElement).offsetParent;
      const escapes =
        f.position === "fixed" ||
        (f.position === "absolute" && !!clipper && !(offParent && clipper.contains(offParent)));
      const shown = escapes ? null : clip;
      const box = look.box(el);
      const sized = box.width > 0 && box.height > 0;
      if (shown && sized && !meets(box, shown)) continue;
      const control = el.matches(CONTROL);
      const inline = f.display.startsWith("inline");
      // Words in a line: an inline-level box that isn't a control or a picture, or a box its parent lays in a line,
      // unless it is an atomic inline (inline-block, inline-flex…) tall enough to be a block of its own.
      const words =
        (inline || inLine) && !el.matches(STANDS) && (f.display === "inline" || box.height <= LINE);
      const tiny = box.width <= TINY && box.height <= TINY;
      const stops =
        el.hasAttribute("data-pipeup-id") || (!inControl && !f.off && !words && !(tiny && !control));
      let at = up;
      if (stops && isBlock(el, look)) {
        if (up && sameBox(look.box(up.el), box)) {
          if (el.hasAttribute("data-pipeup-id") || !up.el.hasAttribute("data-pipeup-id")) up.el = el;
        } else all.push((at = { el, up, level: 0 }));
      }
      const clips = f.clips && sized;
      visit(
        el,
        at,
        clips ? (shown ? within(shown, box) : box) : shown,
        clips ? el : escapes ? null : clipper,
        inControl || control,
        /^inline-(flex|grid)$/.test(f.display) || (inLine && /(flex|grid)$/.test(f.display)),
      );
    }
  };
  visit(root, null, null, null, false, false);
  // Children come after their parent, so from the end each block's level is final before its parent's is set.
  for (let i = all.length - 1; i >= 0; i--) {
    const b = all[i]!;
    if (b.up) b.up.level = Math.max(b.up.level, b.level + 1);
  }
  return all;
}

/** The blocks Tab visits at level `k`: at that level or below, with no block of that level around them. */
export const row = (tree: readonly Block[], k: number): Block[] =>
  tree.filter((b) => b.level <= k && (!b.up || b.up.level > k));

/** The blocks directly inside `b`, in page order. */
export const childBlocks = (tree: readonly Block[], b: Block): Block[] => tree.filter((c) => c.up === b);
