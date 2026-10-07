// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Resolved } from "../../src/anchor/resolve";
import type { Thread } from "../../src/model/types";
import type { Ctx } from "../../src/ui/context";
import { byPage, nodeOf } from "../../src/ui/order";

document.body.innerHTML = `<p id="a">First <b id="w">words</b></p><p id="b">Second</p>`;
const $ = (id: string) => document.getElementById(id)!;
const resolved = new Map<string, Resolved>();
const ctx = { resolved } as unknown as Ctx;
/** A thread `id` on element `el` (a pin at `point`), or on the words inside `#w`. */
function thread(id: string, on: Element | "words" | null, point?: { x: number; y: number }): Thread {
  const range = on === "words" ? document.createRange() : null;
  range?.selectNodeContents($("w").firstChild!);
  resolved.set(id, {
    state: on ? "attached" : "orphaned",
    element: on === "words" ? $("a") : on,
    range,
  } as Resolved);
  return { id, anchor: { point } } as unknown as Thread;
}

describe("page order", () => {
  it("starts text threads at their words, others at their element", () => {
    expect(nodeOf(ctx, thread("t", "words"))).toBe($("w").firstChild);
    expect(nodeOf(ctx, thread("e", $("b")))).toBe($("b"));
    expect(nodeOf(ctx, thread("l", null))).toBeNull();
  });

  it("sorts by where content starts, then pins top to bottom, then as written; lost ones last", () => {
    const list = [
      thread("lost", null),
      thread("second", $("b")),
      thread("words", "words"),
      thread("low pin", $("a"), { x: 0.1, y: 0.9 }),
      thread("high pin", $("a"), { x: 0.9, y: 0.1 }),
      thread("element", $("a")),
      thread("element again", $("a")),
    ];
    expect(list.sort(byPage(ctx)).map((t) => t.id)).toEqual([
      "element",
      "element again",
      "high pin",
      "low pin",
      "words",
      "second",
      "lost",
    ]);
  });
});
