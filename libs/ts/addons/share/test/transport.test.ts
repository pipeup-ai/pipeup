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
