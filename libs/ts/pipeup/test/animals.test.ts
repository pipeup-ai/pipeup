import { describe, expect, it } from "vitest";
import { ANIMALS, COLOURS, animalName, animalOf, colourOf, nameOf } from "../src/model/animals";

/** Deterministic stand-ins for public keys: 43 base64url characters from a small LCG. */
function keys(n: number): string[] {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let seed = 12345;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let k = "";
    for (let j = 0; j < 43; j++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      k += abc[(seed >>> 16) & 63];
    }
    out.push(k);
  }
  return out;
}

describe("animals", () => {
  it("are the five chosen animals, in order", () => {
    expect([...ANIMALS]).toEqual(["Otter", "Fox", "Owl", "Bear", "Rabbit"]);
    for (const a of ANIMALS) expect(a).toMatch(/^[A-Z][a-z]{2,8}$/);
  });

  it("gives one identity the same animal every time", () => {
    const key = "Kq3wYb0u7m2Hn9xFZtVd1PcRj6LgSa8Ee5oTiUyMWQk";
    const first = animalOf(key);
    for (let i = 0; i < 5; i++) expect(animalOf(key)).toBe(first);
    expect(animalName(key)).toBe(`${COLOURS[colourOf(key)]} ${ANIMALS[first]}`);
    // Pinned: a change to the pick would give every existing reviewer a new animal.
    expect(animalName(key)).toBe(animalName("Kq3wYb0u7m2Hn9xFZtVd1PcRj6LgSa8Ee5oTiUyMWQk"));
    expect(animalName("A".repeat(43))).toBe(PINNED_A);
    for (const [c, animal] of Object.entries(PINNED)) expect(animalName(c.repeat(43))).toBe(animal);
  });

  it("are ten colours, in order", () => {
    expect([...COLOURS]).toEqual([
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "Teal",
      "Blue",
      "Purple",
      "Pink",
      "Brown",
      "Grey",
    ]);
  });

  it("names a reviewer as their colour, then their animal", () => {
    for (const k of keys(200)) {
      const name = animalName(k);
      expect(name).toBe(`${COLOURS[colourOf(k)]} ${ANIMALS[animalOf(k)]}`);
      expect(name).toMatch(
        /^(Red|Orange|Yellow|Green|Teal|Blue|Purple|Pink|Brown|Grey) (Otter|Fox|Owl|Bear|Rabbit)$/,
      );
    }
  });

  it("gives one identity the same colour every time, independent of its animal", () => {
    const key = "Kq3wYb0u7m2Hn9xFZtVd1PcRj6LgSa8Ee5oTiUyMWQk";
    const first = colourOf(key);
    for (let i = 0; i < 5; i++) expect(colourOf(key)).toBe(first);
    // Animal and colour come from different parts of the hash: every animal shows up in every colour.
    const seen = new Set(keys(5000).map((k) => `${animalOf(k)}/${colourOf(k)}`));
    expect(seen.size).toBe(50);
  });

  it("spreads identities evenly over all 50 combinations", () => {
    const counts = new Map<string, number>();
    for (const k of keys(10000)) counts.set(animalName(k), (counts.get(animalName(k)) ?? 0) + 1);
    expect(counts.size).toBe(50);
    // 200 expected per combination; 140..260 is about 4 standard deviations either side.
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(140);
      expect(c).toBeLessThan(260);
    }
  });

  it("spreads identities evenly over all five", () => {
    const counts = new Array<number>(5).fill(0);
    for (const k of keys(5000)) counts[animalOf(k)]!++;
    expect(counts.every((c) => c > 0)).toBe(true);
    // 1000 expected per animal; 880..1120 is about 4 standard deviations either side.
    for (const c of counts) {
      expect(c).toBeGreaterThan(880);
      expect(c).toBeLessThan(1120);
    }
  });

  it("names a comment by its name, or else its writer's animal", () => {
    const author = "A".repeat(43);
    expect(nameOf({ author, name: "Sam" })).toBe("Sam");
    expect(nameOf({ author, name: "" })).toBe(animalName(author));
  });
});

const PINNED_A = "Yellow Rabbit";
/** Pinned mapping: each letter repeated 43 times; every animal is covered. */
const PINNED: Record<string, string> = {
  B: "Orange Otter",
  F: "Blue Fox",
  I: "Pink Owl",
  H: "Brown Bear",
  X: "Blue Rabbit",
  Z: "Orange Bear",
  J: "Green Otter",
  L: "Red Fox",
  N: "Pink Owl",
};
