import type { Anchor } from "pipeup";

/** What one person shows others (add-ons design §9.4). Sent over data channels only, never stored. */
export interface Presence {
  view?: Record<string, string>;
  /** Where the pointer is: an element and fractions of its box. */
  pointer?: { el: Anchor; x: number; y: number } | null;
  selection?: Anchor | null;
  /** null: not writing; "": a new comment; else that thread. */
  typing?: string | null;
}

export const MAX_FRAME = 16_000;
export const MAX_HZ = 15;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.length <= max ? v : undefined;
const unit = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined;

/**
 * An anchor from a peer: an object with a path and a bounded size. The page only ever searches with it inside a
 * try block, the way the core treats an anchor on any op.
 */
export function cleanAnchor(a: unknown): Anchor | null {
  const o = a as Anchor | null;
  return o &&
    typeof o === "object" &&
    typeof o.path === "string" &&
    o.path.length <= 2000 &&
    JSON.stringify(o).length < 12_000
    ? o
    : null;
}

export function cleanView(v: unknown): Record<string, string> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(
        Object.entries(v)
          .slice(0, 16)
          .filter(([k, x]) => k.length <= 64 && str(x, 200) !== undefined),
      )
    : undefined;
}

/** A presence frame from a peer, made safe: oversized or malformed parts are dropped, never trusted. */
export function cleanPresence(raw: unknown): Presence | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const out: Presence = {};
  const view = cleanView(m.view);
  if (view) out.view = view;
  const p = m.pointer as Record<string, unknown> | null | undefined;
  const el = p ? cleanAnchor(p.el) : null;
  const x = p ? unit(p.x) : undefined;
  const y = p ? unit(p.y) : undefined;
  out.pointer = el && x !== undefined && y !== undefined ? { el, x, y } : null;
  out.selection = m.selection ? cleanAnchor(m.selection) : null;
  out.typing = typeof m.typing === "string" ? m.typing.slice(0, 64) : null;
  return out;
}

/**
 * Sends the person's own presence: at most 15 times a second, only when something changed, as one frame holding
 * everything (a peer that just joined gets the same frame).
 */
export class Beacon {
  private state: Presence = {};
  private last = "";
  private at = -Infinity;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly send: (frame: string) => void) {}

  /** The whole state as a frame. */
  frame(): string {
    return JSON.stringify({ t: "p", ...this.state });
  }

  set(patch: Presence): void {
    Object.assign(this.state, patch);
    this.tick();
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    if (this.timer) return;
    const wait = this.at + 1000 / MAX_HZ - performance.now();
    if (wait > 0) this.timer = setTimeout(() => ((this.timer = undefined), this.tick()), wait);
    else {
      const frame = this.frame();
      if (frame === this.last) return;
      this.last = frame;
      this.at = performance.now();
      this.send(frame);
    }
  }
}
