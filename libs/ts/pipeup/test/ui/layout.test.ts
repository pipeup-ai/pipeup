// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { anchorTop, bubblePoint, hit, popoverAnchor } from "../../src/ui/geometry";
import { placeBar, placeDraft, placeIcon, placePopover, stackColumn } from "../../src/ui/layout";
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
  const line = { left: 100, top: 180, width: 200, height: 20 };
  it("puts popovers below quotes, flipping above near the bottom", () => {
    expect(placePopover({ x: 100, y: 200, below: true, box: line }, { width: 300, height: 120 }, vp)).toEqual(
      {
        left: 100,
        top: 208,
      },
    );
    expect(
      placePopover({ x: 100, y: 750, below: true, box: line }, { width: 300, height: 120 }, vp).top,
    ).toBe(750 - 120 - 40);
  });

  it("puts popovers beside elements, inside the margins", () => {
    expect(
      placePopover({ x: 100, y: 200, below: false, box: line }, { width: 300, height: 120 }, vp),
    ).toEqual({
      left: 114,
      top: 188,
    });
    expect(placePopover({ x: 5, y: 2, below: false, box: line }, { width: 300, height: 120 }, vp)).toEqual({
      left: 19,
      top: 12,
    });
  });

  it("with no room beside, puts the popover below the element, or above it, never over it", () => {
    const size = { width: 300, height: 120 };
    const at = (box: { left: number; top: number; width: number; height: number }) =>
      placePopover({ x: 900, y: box.top + 8, below: false, box }, size, vp);
    expect(at({ left: 600, top: 180, width: 310, height: 40 })).toMatchObject({ left: 600, top: 228 });
    expect(at({ left: 600, top: 700, width: 310, height: 60 })).toMatchObject({ left: 600, top: 572 });
    // A phone: the popover takes the width it can, and still stays off the element.
    expect(
      placePopover(
        { x: 300, y: 408, below: false, box: { left: 40, top: 400, width: 280, height: 44 } },
        size,
        {
          width: 390,
          height: 844,
        },
      ),
    ).toMatchObject({ left: 40, top: 452 });
    // Too tall for either: as low as it fits, on screen.
    expect(at({ left: 0, top: 50, width: 1000, height: 740 })).toMatchObject({ top: 800 - 120 - 12 });
  });

  it("puts the selection's icon past its block's text, level with the last line, or above when there's no room", () => {
    const sel = { left: 100, top: 300, width: 200, height: 44 };
    const last = { left: 100, top: 322, width: 120, height: 22 };
    expect(placeIcon(sel, last, 640, { width: 36, height: 34 }, vp)).toEqual({ left: 648, top: 316 });
    expect(placeIcon(sel, last, 980, { width: 36, height: 34 }, vp)).toEqual({ left: 182, top: 256 });
  });

  it("keeps boxes clear of the comment control's corner, and in the window", () => {
    const size = { width: 300, height: 160 };
    const phone = { width: 320, height: 568, keep: { left: 276, top: 524 } };
    // A block taller than the screen: the box sits as low as it can, just above the control.
    expect(placeDraft({ left: 0, top: 0, width: 320, height: 440 }, size, phone, 12, 60)).toEqual({
      left: 12,
      top: 524 - 8 - 160,
      above: false,
    });
    // Narrower than the gap beside the control: it can go lower.
    expect(
      placeDraft({ left: 0, top: 0, width: 320, height: 440 }, { width: 200, height: 160 }, phone, 12, 60)
        .top,
    ).toBe(568 - 12 - 160);
    // By touch in comment mode the hint runs along the bottom beside the control: nothing goes under either.
    const hint = { ...phone, keep: { left: 0, top: 524 } };
    expect(
      placeDraft({ left: 0, top: 0, width: 320, height: 440 }, { width: 200, height: 160 }, hint, 12, 60).top,
    ).toBe(524 - 8 - 160);
    // A thread on words that have gone below the window (a phone turned) still shows, at the bottom.
    expect(
      placePopover(
        { x: 20, y: 700, below: true, box: { left: 20, top: 680, width: 100, height: 20 } },
        size,
        {
          width: 812,
          height: 375,
        },
      ).top,
    ).toBe(375 - 12 - 160);
  });

  it("puts the selection's icon at the window's right edge on a touch screen, beside the phone's own menu", () => {
    const sel = { left: 100, top: 300, width: 200, height: 44 };
    const last = { left: 100, top: 322, width: 120, height: 22 };
    // Level with the last line.
    expect(placeIcon(sel, last, 640, { width: 48, height: 48 }, vp, true)).toEqual({
      left: vp.width - 52,
      top: 322 + 11 - 24,
    });
    // A last line that runs into the edge (where its handle is): level with the first line instead.
    const long = { left: 100, top: 322, width: vp.width - 120, height: 22 };
    expect(placeIcon(sel, long, 640, { width: 48, height: 48 }, vp, true).top).toBe(300 + 11 - 24);
    // Always in the window.
    expect(
      placeIcon({ ...sel, top: 760 }, { ...last, top: 782 }, 640, { width: 48, height: 48 }, vp, true).top,
    ).toBe(vp.height - 48 - 8);
  });

  it("puts the naming bar at the window's top over a block too tall for room above or below", () => {
    expect(placeBar({ left: 0, top: 0, width: 320, height: 760 }, { width: 200, height: 50 }, vp).top).toBe(
      8,
    );
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
    expect(popoverAnchor(anchor({ point: { x: 0, y: 0 } }), r)).toMatchObject({
      x: 100,
      y: 200,
      below: false,
    });
    // What it is about, for when there's no room beside: a pin's own spot.
    expect(popoverAnchor(anchor({ point: { x: 0.5, y: 0.25 } }), r)?.box).toMatchObject({
      left: 188,
      top: 213,
      width: 24,
      height: 24,
    });
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
