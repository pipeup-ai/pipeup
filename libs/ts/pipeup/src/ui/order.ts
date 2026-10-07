import type { Thread } from "../model/types";
import type { Ctx } from "./context";

/** Where a thread's content starts on the page: its words' first node, else its element; null when lost. */
export function nodeOf(ctx: Ctx, t: Thread): Node | null {
  const r = ctx.resolved.get(t.id);
  return r?.range?.startContainer ?? r?.element ?? null;
}

/** Threads in page order: by where their content starts, then a pin's place (top to bottom), else as written. */
export const byPage =
  (ctx: Ctx) =>
  (a: Thread, b: Thread): number => {
    const na = nodeOf(ctx, a);
    const nb = nodeOf(ctx, b);
    const pt = (t: Thread) => t.anchor.point ?? { x: 0, y: -1 };
    if (na !== nb) return !nb || (na && na.compareDocumentPosition(nb) & 4) /* FOLLOWING */ ? -1 : 1;
    return pt(a).y - pt(b).y || pt(a).x - pt(b).x;
  };
