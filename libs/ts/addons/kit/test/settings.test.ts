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

  it("are kept by the host when it keeps them (the browser extension), never in the site's IndexedDB", async () => {
    const held = new Map<string, unknown>();
    const keep = {
      get: async (k: string) => held.get(k),
      set: async (k: string, v: unknown) => void held.set(k, v),
    };
    const a = await settings("kit-host", { keep });
    expect(a.lasting).toBe(true);
    await a.set("consent", { on: true, seen: true });
    expect(held.get("consent")).toEqual({ on: true, seen: true });
    // A page that writes the same setting into its own storage changes nothing the add-on reads.
    await (await settings("kit-host")).set("consent", { on: false });
    expect(await a.get("consent")).toEqual({ on: true, seen: true });
  });
});
