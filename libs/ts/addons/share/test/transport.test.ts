import { describe, expect, it } from "vitest";
import { interval } from "../src/transport";

const MIN = 60_000;

describe("polling cadence (add-ons design §7.2)", () => {
  it("every 30 s ± 5 while a change was made or seen in the last 10 minutes", () => {
    expect(interval(0, false, 0, 0)).toBe(25_000);
    expect(interval(9 * MIN, false, 0, 1)).toBe(35_000);
  });
  it("every 2 minutes when quiet for 10 minutes, every 5 when quiet for 30 or hidden", () => {
    expect(interval(11 * MIN, false, 0)).toBe(2 * MIN);
    expect(interval(31 * MIN, false, 0)).toBe(5 * MIN);
    expect(interval(0, true, 0)).toBe(5 * MIN);
  });
  it("backs off after errors, to at most 5 minutes", () => {
    expect(interval(0, false, 1, 0)).toBe(50_000);
    expect(interval(0, false, 10, 0)).toBe(5 * MIN);
  });
});

describe("a service's own rule for how often to post", () => {
  it("is learned from 'please wait 60 seconds' and kept as the least gap from then on", async () => {
    const { RetryAfter } = await import("@pipeup/kit");
    const { ShareTransport } = await import("../src/transport");
    const op = { body: { v: 1, id: "a".repeat(43) }, sig: "s" } as never;
    const backend = {
      ids: new Set<string>(),
      expires: null,
      moved: false,
      big: false,
      read: async () => [],
      req: async () => ["", {}] as [string, RequestInit],
      post: async () => {
        throw new RetryAfter(60, true);
      },
    };
    const t = new ShareTransport(backend as never, {
      signal: new AbortController().signal,
      gap: 10_000,
      lock: false,
      allowed: () => [],
      changed() {},
    });
    expect(t.gap).toBe(10_000);
    await expect(t.send([op])).rejects.toMatchObject({ seconds: 60 });
    expect(t.gap).toBe(60_000);
    // A plain 429 with a Retry-After is patience for now, not a standing rule: the gap stays as it was.
    backend.post = async () => {
      throw new RetryAfter(5);
    };
    await expect(t.send([op])).rejects.toMatchObject({ seconds: 5 });
    expect(t.gap).toBe(60_000);
  });
});
