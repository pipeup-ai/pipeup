// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { anchorTop, bubblePoint, hit, popoverAnchor } from "../../src/ui/geometry";
import { placeBar, placePopover, stackColumn } from "../../src/ui/layout";
import type { Anchor } from "../../src/model/types";

const vp = { width: 1000, height: 800 };

describe("stackColumn", () => {
  it("keeps threads level with their anchors and pushes overlaps down", () => {
    const pos = stackColumn(
      [
        { id: "b", want: 100, height: 80 },
        { id: "a", want: 50, height: 40 },
        { id: "c", want: 400, height: 20 },
      ],
      null,
    );
    expect(pos.get("a")).toBe(50);
    expect(pos.get("b")).toBe(100);
    expect(pos.get("c")).toBe(400);
    const tight = stackColumn(
      [
        { id: "a", want: 50, height: 100 },
        { id: "b", want: 60, height: 20 },
      ],
      null,
    );
    expect(tight.get("b")).toBe(160);
  });

  it("aligns the active thread exactly and moves the ones above it up", () => {
    const pos = stackColumn(
      [
        { id: "a", want: 50, height: 100 },
        { id: "b", want: 60, height: 20 },
      ],
      "b",
    );
    expect(pos.get("b")).toBe(60);
    expect(pos.get("a")).toBe(60 - 100 - 10);
  });
});

describe("placement", () => {
  it("puts popovers below quotes, flipping above near the bottom", () => {
    expect(placePopover({ x: 100, y: 200, below: true }, { width: 300, height: 120 }, vp)).toEqual({
      left: 100,
      top: 208,
    });
    expect(placePopover({ x: 100, y: 750, below: true }, { width: 300, height: 120 }, vp).top).toBe(
      750 - 120 - 40,
    );
  });

  it("puts popovers beside elements, flipping left near the right edge, inside the margins", () => {
    expect(placePopover({ x: 100, y: 200, below: false }, { width: 300, height: 120 }, vp)).toEqual({
      left: 114,
      top: 188,
    });
    expect(placePopover({ x: 900, y: 200, below: false }, { width: 300, height: 120 }, vp).left).toBe(
      900 - 300 - 28,
    );
    expect(placePopover({ x: 5, y: 2, below: false }, { width: 300, height: 120 }, vp)).toEqual({
      left: 19,
      top: 12,
    });
  });

  it("centres the selection bar above, or below when there's no room", () => {
    expect(placeBar({ left: 100, top: 300, width: 200, height: 20 }, { width: 36, height: 34 }, vp)).toEqual({
      left: 182,
      top: 256,
    });
    expect(placeBar({ left: 100, top: 20, width: 200, height: 20 }, { width: 36, height: 34 }, vp).top).toBe(
      50,
    );
  });
});

describe("geometry", () => {
  const anchor = (a: Partial<Anchor>): Anchor => ({ path: "", fingerprint: "00000000", snapshot: "", ...a });
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON() {},
    }) as DOMRect;

  it("puts pins at their fraction of the element and finds tops", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => rect(100, 200, 200, 100);
    const r = { state: "attached" as const, element: el, range: null };
    expect(bubblePoint(anchor({ point: { x: 0.5, y: 0.25 } }), r)).toEqual({ x: 200, y: 225 });
    expect(anchorTop(anchor({ point: { x: 0.5, y: 0.25 } }), r)).toBe(225);
    expect(anchorTop(anchor({}), r)).toBe(200);
    expect(popoverAnchor(anchor({ point: { x: 0, y: 0 } }), r)).toEqual({ x: 100, y: 200, below: false });
  });

  it("gives no bubble to text comments or orphaned ones", () => {
    const el = document.createElement("p");
    el.getBoundingClientRect = () => rect(0, 0, 10, 10);
    expect(
      bubblePoint(anchor({ quote: { exact: "x", prefix: "", suffix: "" } }), {
        state: "attached",
        element: el,
        range: null,
      }),
    ).toBeNull();
    expect(bubblePoint(anchor({}), { state: "orphaned", element: null, range: null })).toBeNull();
  });

  it("hit-tests rectangles", () => {
    expect(hit(5, 5, [rect(0, 0, 10, 10)])).toBe(true);
    expect(hit(15, 5, [rect(0, 0, 10, 10)])).toBe(false);
  });
});
