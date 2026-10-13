// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { settings } from "../src/settings";

describe("an add-on's settings", () => {
  it("are kept in IndexedDB and read back, and say they last", async () => {
    const a = await settings("kit-test");
    expect(a.lasting).toBe(true);
    await a.set("choice", { sent: ["a", "b"] });
    const b = await settings("kit-test");
    expect(await b.get("choice")).toEqual({ sent: ["a", "b"] });
    expect(await b.get("missing")).toBeUndefined();
  });

  it("fall back to memory, saying they don't last, when asked or when IndexedDB is missing", async () => {
    const m = await settings("kit-test2", { memory: true });
    expect(m.lasting).toBe(false);
    await m.set("k", 1);
    expect(await m.get("k")).toBe(1);
    const real = globalThis.indexedDB;
    // @ts-expect-error simulating a browser with IndexedDB turned off
    delete globalThis.indexedDB;
    try {
      expect((await settings("kit-test3")).lasting).toBe(false);
    } finally {
      globalThis.indexedDB = real;
    }
  });
});
