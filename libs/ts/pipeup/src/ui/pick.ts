/** What picking needs to know about the page's layout (faked in unit tests). */
export interface Look {
  box(el: Element): { left: number; top: number; width: number; height: number };
  /** The element draws something of its own — a background, border or shadow — so it reads as a block. */
  drawn(el: Element): boolean;
  viewport(): { width: number; height: number };
}

/** Things that are obviously "a thing" to comment on. */
const OBVIOUS =
  "button,a,input,select,textarea,label,summary,details,img,svg,canvas,video,picture,figure,table,th,td,li,p,h1,h2,h3,h4,h5,h6,blockquote,pre";
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

/** The obvious block under `from`: what the outline glides to in comment mode. */
export function pickBlock(from: Element, root: Element, look: Look): Element | null {
  if (from === root || !root.contains(from) || from.closest("[data-pipeup-ignore]")) return null;
  const vp = look.viewport();
  const large = LARGE * vp.width * vp.height;
  let found: Element | null = null;
  for (let el: Element | null = from; el && el !== root; el = el.parentElement) {
    const b = look.box(el);
    if (b.width < 2 || b.height < 2) continue;
    if (el.hasAttribute("data-pipeup-id")) {
      found = el;
      break;
    }
    if (b.width * b.height > large) continue;
    if (el.matches(OBVIOUS) || look.drawn(el)) {
      found = el;
      break;
    }
  }
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

/** The real page: boxes from layout, "drawn" from computed backgrounds, borders and shadows. */
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
    viewport: () => ({ width: win.innerWidth, height: win.innerHeight }),
  };
}
