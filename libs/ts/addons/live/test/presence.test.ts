import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Beacon, cleanAnchor, cleanPresence } from "../src/presence";

const anchor = { id: "p1", path: "", fingerprint: "abcdef01", snapshot: "text" };

describe("presence on receipt", () => {
  it("keeps good fields and drops the rest", () => {
    const p = cleanPresence({
      view: { slide: "3", n: 4, label: "x".repeat(300) },
      pointer: { el: anchor, x: 0.5, y: 2 },
      selection: { ...anchor, quote: { exact: "hello", prefix: "a", suffix: "b" } },
      typing: "thread-id",
      extra: "ignored",
    });
    expect(p?.view).toEqual({ slide: "3" });
    expect(p?.pointer).toMatchObject({ x: 0.5, y: 1 });
    expect(p?.selection?.quote?.exact).toBe("hello");
    expect(p?.typing).toBe("thread-id");
    expect(p).not.toHaveProperty("extra");
  });

  it("caps sizes: long strings and paths are refused, typing is cut", () => {
    expect(cleanAnchor({ ...anchor, path: "p".repeat(2001) })).toBeNull();
    expect(
      cleanAnchor({ ...anchor, quote: { exact: "e".repeat(12_001), prefix: "", suffix: "" } }),
    ).toBeNull();
    expect(cleanPresence({ typing: "y".repeat(500) })?.typing).toHaveLength(64);
    expect(cleanPresence({ pointer: { el: { path: 5 }, x: 0, y: 0 } })?.pointer).toBeNull();
    expect(cleanPresence({ pointer: { el: anchor, x: "no", y: 0 } })?.pointer).toBeNull();
    expect(cleanPresence("nope")).toBeNull();
    expect(
      Object.keys(
        cleanPresence({ view: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, "v"])) })!
          .view!,
      ),
    ).toHaveLength(16);
  });
});

describe("Beacon", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());
  const make = () => {
    const sent: string[] = [];
    const b = new Beacon((f) => sent.push(f));
    return { b, sent };
  };

  it("sends at most 15 times a second and only what changed", () => {
    const { b, sent } = make();
    for (let i = 0; i < 100; i++) {
      b.set({ pointer: { el: anchor as never, x: i / 100, y: 0 } });
      vi.advanceTimersByTime(5);
    }
    expect(sent.length).toBeLessThanOrEqual(8 + 1); // 500 ms at 15 Hz
    expect(sent.length).toBeGreaterThan(3);
    // Setting what is already there sends nothing more.
    const n = sent.length;
    vi.advanceTimersByTime(1000);
    b.set({ typing: null });
    b.set({ typing: null });
    vi.advanceTimersByTime(1000);
    expect(sent.length).toBeLessThanOrEqual(n + 2);
  });

  it("holds the whole state for a peer who just joined", () => {
    const { b } = make();
    b.set({ view: { slide: "2" } });
    b.set({ typing: "" });
    expect(JSON.parse(b.frame())).toMatchObject({ t: "p", view: { slide: "2" }, typing: "" });
  });
});
