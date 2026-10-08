import type { AddonHost, Anchor } from "pipeup";
import { h } from "./dom";
import type { Beacon } from "./presence";
import type { Person } from "./session";

interface Resolved {
  element: Element | null;
  range: Range | null;
}

/** What this add-on borrows from the core's global (a page with only the ESM core has none: no cursors then). */
interface Core {
  resolveAnchor(
    a: Anchor,
    root: Element,
    o?: { fuzzy?: boolean },
  ): { element: Element | null; range: Range | null };
  describeElement(el: Element, root: Element, point?: { x: number; y: number }): Anchor;
  describeRange(range: Range, root: Element): Anchor;
  animalName(key: string): string;
}
export const core = (): Partial<Core> => (globalThis as { Pipeup?: Partial<Core> }).Pipeup ?? {};

/** Hue of each of the core's ten colours (Red … Grey), in the order of `Pipeup.COLOURS`. */
const HUES = [4, 25, 42, 125, 175, 220, 275, 335, 28, 0];
/** A readable, saturated colour for white text, by the colour name the core gives each reviewer's animal. */
export const colourOf = (key: string): string => {
  const i = ["Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple", "Pink", "Brown", "Grey"].indexOf(
    core().animalName?.(key).split(" ")[0] ?? "",
  );
  return `hsl(${HUES[i < 0 ? 9 : i]} ${i < 0 || i === 9 ? 0 : 65}% ${i === 8 ? 32 : 42}%)`;
};

const EASE = "opacity .25s var(--pu-ease,ease)";
export const STYLES = `
.live-c,.live-s{position:absolute;opacity:0;transition:${EASE}}
.live-c{left:0;top:0}
.live-c.on{opacity:1}
.live-c svg{display:block;width:16px;height:16px;fill:var(--c);stroke:#fff;stroke-width:1.5}
.live-c span{position:absolute;left:13px;top:13px;padding:2px 6px;border-radius:6px;white-space:nowrap;font:600 11px/1.3 var(--pu-font,system-ui,sans-serif);color:#fff;background:var(--c)}
.live-s.on{opacity:.18}
.live-p{display:flex;align-items:center;gap:10px;padding:8px 0}
.live-n{flex:1;min-width:0}
.live-n small{display:block;color:var(--pu-muted)}
.live-go{padding:6px 12px;border:1px solid var(--pu-line);border-radius:8px;background:none;color:inherit;font:inherit;cursor:pointer;transition:background-color .2s var(--pu-ease,ease)}
.live-go:hover{background:var(--pu-hover)}
.live-row{display:flex;gap:8px;margin-top:12px}
`;

const NS = "http://www.w3.org/2000/svg";
const REUSE_MS = 1000;

interface Found {
  key: string;
  r: Resolved | null;
  at: number;
}

interface Mark {
  el: HTMLElement;
  tag: HTMLElement;
  x: number;
  y: number;
  ptr?: Found;
  sel?: Found;
  rects: HTMLElement[];
}

const keyOf = (a: Anchor) =>
  `${a.id}|${a.path}|${a.fingerprint}|${a.quote?.exact.length ?? ""}|${a.quote?.prefix ?? ""}`;

/** Draws other people's pointers and selections in the overlay (add-ons design §9.4). */
export class Cursors {
  private readonly marks = new Map<string, Mark>();
  private last = performance.now();
  private readonly reduce = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private readonly host: AddonHost,
    private readonly name: (key: string) => string,
  ) {}

  private make(p: Person): Mark {
    const svg = document.createElementNS(NS, "svg");
    const path = document.createElementNS(NS, "path");
    svg.setAttribute("viewBox", "0 0 16 16");
    path.setAttribute("d", "M2 1.5l11 5-4.6 1.6L6.8 13z");
    svg.append(path);
    const tag = h("span");
    const el = h("div", { className: "live-c" }, svg, tag);
    el.style.setProperty("--c", colourOf(p.key));
    this.host.overlay().append(el);
    const m: Mark = { el, tag, x: 0, y: 0, rects: [] };
    this.marks.set(p.session, m);
    return m;
  }

  /** What an anchor resolves to, found again only when it changes or after a second. */
  private find(m: Mark, k: "ptr" | "sel", a: Anchor, now: number): Resolved | null {
    const key = keyOf(a);
    const c = m[k];
    if (!c || c.key !== key || now - c.at > REUSE_MS || (k === "ptr" && !c.r?.element?.isConnected)) {
      let r: Resolved | null = null;
      try {
        r = core().resolveAnchor?.(a, this.host.root, { fuzzy: false }) ?? null;
      } catch {
        /* a selector the browser refuses: nowhere */
      }
      m[k] = { key, r, at: now };
    }
    return m[k]!.r;
  }

  /** Where a person's pointer is on screen now, if it can be found. */
  pointOf(p: Person): { x: number; y: number; el: Element } | null {
    const a = p.pres.pointer;
    const m = this.marks.get(p.session);
    const el = a && m ? this.find(m, "ptr", a.el, performance.now())?.element : null;
    if (!a || !el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + a.x * r.width, y: r.top + a.y * r.height, el };
  }

  /** Runs once per frame: `show` is false while comments are closed or cursors are off. */
  frame(people: Iterable<Person>, show: boolean): void {
    const now = performance.now();
    const k = 1 - Math.exp(-Math.min(0.25, (now - this.last) / 1000) / 0.12);
    this.last = now;
    const live = new Set<string>();
    const reads: (() => void)[] = [];
    for (const p of people) {
      live.add(p.session);
      const m = this.marks.get(p.session) ?? this.make(p);
      const here = show && this.host.isHere(p.pres.view);
      const at = here ? this.pointOf(p) : null;
      const rects = here && p.pres.selection ? this.rects(m, p.pres.selection, now) : [];
      reads.push(() => {
        const name = this.name(p.key);
        if (name !== m.tag.textContent) m.tag.textContent = name;
        if (!at) return void m.el.classList.remove("on");
        const far = Math.hypot(at.x - m.x, at.y - m.y);
        if (!m.el.classList.contains("on") || this.reduce.matches) {
          // Shown again, or reduced motion: no glide. Reduced motion cross-fades where it jumps.
          if (far > 40 && m.el.classList.contains("on"))
            m.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease" });
          m.x = at.x;
          m.y = at.y;
        } else {
          m.x += (at.x - m.x) * k;
          m.y += (at.y - m.y) * k;
        }
        m.el.classList.add("on");
        m.el.style.transform = `translate(${m.x.toFixed(1)}px,${m.y.toFixed(1)}px)`;
      });
      this.paint(m, rects, p.key);
    }
    for (const w of reads) w();
    for (const [s, m] of this.marks)
      if (!live.has(s)) {
        m.el.remove();
        for (const r of m.rects) r.remove();
        this.marks.delete(s);
      }
  }

  private rects(m: Mark, a: Anchor, now: number): DOMRect[] {
    try {
      return [...(this.find(m, "sel", a, now)?.range?.getClientRects() ?? [])].slice(0, 60);
    } catch {
      return [];
    }
  }

  private paint(m: Mark, rects: DOMRect[], key: string): void {
    while (m.rects.length < rects.length) {
      const d = h("div", { className: "live-s" });
      d.style.background = colourOf(key);
      this.host.overlay().append(d);
      m.rects.push(d);
    }
    m.rects.forEach((d, i) => {
      const r = rects[i];
      d.classList.toggle("on", !!r);
      if (!r) return;
      Object.assign(d.style, {
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    });
  }
}

/**
 * Sends this person's own pointer and selection (when `on()`), from a passive capture listener on the window:
 * comment mode stops events at window capture, but other capture listeners still run.
 */
export function track(host: AddonHost, beacon: Beacon, on: () => boolean): () => void {
  const ac = new AbortController();
  const opts = { capture: true, passive: true, signal: ac.signal } as const;
  let lastEl: Element | null = null;
  let anchor: Anchor | null = null;
  addEventListener(
    "pointermove",
    (e) => {
      if (!on()) return;
      const t = e.target;
      if (!(t instanceof Element) || t.closest("pipeup-root") || !host.root.contains(t))
        return void beacon.set({ pointer: null });
      try {
        if (t !== lastEl) {
          anchor = core().describeElement?.(t, host.root) ?? null;
          lastEl = t;
        }
      } catch {
        anchor = null;
      }
      const r = t.getBoundingClientRect();
      if (!anchor || !r.width || !r.height) return void beacon.set({ pointer: null });
      beacon.set({
        pointer: {
          el: anchor,
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        },
      });
    },
    opts,
  );
  document.documentElement.addEventListener("pointerleave", () => beacon.set({ pointer: null }), opts);
  document.addEventListener(
    "selectionchange",
    () => {
      let selection: Anchor | null = null;
      const s = getSelection();
      if (on() && s?.rangeCount && !s.isCollapsed) {
        const r = s.getRangeAt(0);
        if (host.root.contains(r.commonAncestorContainer))
          try {
            selection = core().describeRange?.(r, host.root) ?? null;
          } catch {
            selection = null;
          }
      }
      beacon.set({ selection });
    },
    opts,
  );
  return () => ac.abort();
}
