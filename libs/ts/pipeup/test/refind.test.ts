// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cluesOf, headsOf, kindOf, nameOf, similarity } from "../src/anchor/clues";
import { describeElement } from "../src/anchor/describe";
import { resolveAnchor } from "../src/anchor/resolve";
import { foldThreads } from "../src/model/fold";
import { isAnchor, isWellFormed } from "../src/model/ops";
import type { Anchor, OpBody, SignedOp } from "../src/model/types";

const tier = (name: string, price: string) => `<div class="tier"><b>${name}</b> <span>${price}</span></div>`;
const PRICING = (...tiers: string[]) => `
  <main>
    <h1>Lumen</h1>
    <h2>Pricing</h2>
    <section class="tiers">${tiers.join("")}</section>
    <h2>Support</h2>
    <p>Write to us any time.</p>
    <img src="/img/team-photo.jpg?v=2" />
    <button aria-label="Start a trial">Go</button>
  </main>`;

beforeEach(() => {
  document.body.innerHTML = PRICING(
    tier("Starter", "$8 a month"),
    tier("Team", "$20 a month"),
    tier("Business", "Ask us"),
  );
});

const tierNamed = (name: string) =>
  [...document.querySelectorAll(".tier")].find((el) => el.querySelector("b")?.textContent === name)!;

describe("clues", () => {
  it("names the kind of thing, its name and the headings it sits under", () => {
    expect(kindOf(document.querySelector("h2")!)).toBe("h");
    expect(kindOf(document.querySelector("button")!)).toBe("button");
    expect(kindOf(tierNamed("Team"))).toBe("box");
    expect(nameOf(document.querySelector("img")!)).toBe("team-photo.jpg");
    expect(nameOf(document.querySelector("button")!)).toBe("Start a trial");
    expect(headsOf(tierNamed("Team"), document.body)).toEqual(["Lumen", "Pricing"]);
    expect(headsOf(document.querySelector("p")!, document.body)).toEqual(["Lumen", "Support"]);
  });

  it("keeps the clues with a comment on a thing someone clicked, within the limits a comment allows", () => {
    const anchor = describeElement(tierNamed("Team"), document.body);
    expect(anchor).toMatchObject({ kind: "box", heads: ["Lumen", "Pricing"] });
    expect(isAnchor(anchor)).toBe(true);
    expect(cluesOf(document.querySelector("button")!, document.body).name).toBe("Start a trial");
  });

  it("refuses clues that are too long or not what they say", () => {
    const base: Anchor = { path: "", fingerprint: "00000000", snapshot: "" };
    expect(isAnchor({ ...base, kind: "table" })).toBe(false);
    expect(isAnchor({ ...base, name: "x".repeat(201) })).toBe(false);
    expect(isAnchor({ ...base, heads: ["a", "b", "c", "d"] })).toBe(false);
    expect(isAnchor({ ...base, heads: ["x".repeat(121)] })).toBe(false);
    expect(isAnchor({ ...base, y: 2 })).toBe(false);
    expect(isAnchor({ ...base, lost: false })).toBe(false);
    expect(isAnchor({ ...base, kind: "img", name: "a.png", heads: ["A"], y: 0.5, lost: true })).toBe(true);
  });

  it("scores reworded text as alike and different text as not", () => {
    expect(similarity("Team $20 a month", "Team $20 a month")).toBe(1);
    expect(similarity("Team $24 a month", "Team $20 a month")).toBeGreaterThan(0.7);
    expect(similarity("Starter $8 a month", "Team $20 a month")).toBeLessThan(0.5);
  });
});

describe("re-finding a thing someone clicked", () => {
  it("follows it when something new is added before it, instead of landing on a neighbour", () => {
    const anchor = describeElement(tierNamed("Team"), document.body);
    document.body.innerHTML = PRICING(
      tier("Free", "$0"),
      tier("Starter", "$8 a month"),
      tier("Team", "$20 a month"),
      tier("Business", "Ask us"),
    );
    const r = resolveAnchor(anchor, document.body);
    expect(r.element?.textContent).toContain("Team");
    expect(r).toMatchObject({ state: "moved", alike: true });
  });

  it("follows it when the page around it is rebuilt", () => {
    const anchor = describeElement(document.querySelector("button")!, document.body);
    document.body.innerHTML = `<header><nav><button aria-label="Start a trial">Go</button></nav></header>`;
    const r = resolveAnchor(anchor, document.body);
    expect(r.element?.getAttribute("aria-label")).toBe("Start a trial");
    expect(r.alike).toBe(true);
  });

  it("stays where it was, moved, when only its words changed", () => {
    const anchor = describeElement(tierNamed("Team"), document.body);
    tierNamed("Team").querySelector("span")!.textContent = "$24 a month";
    const r = resolveAnchor(anchor, document.body);
    expect(r).toMatchObject({ state: "moved" });
    expect(r.alike).toBeUndefined();
  });

  it("is lost rather than guessed when two things match about equally", () => {
    document.body.innerHTML = `<main><h2>News</h2><a href="/a">Learn more</a><a href="/b">Learn more</a></main>`;
    const anchor = describeElement(document.querySelectorAll("a")[0]!, document.body);
    document.body.innerHTML = `<main><h2>News</h2><div><a href="/c">Learn more</a></div><div><a href="/d">Learn more</a></div></main>`;
    expect(resolveAnchor(anchor, document.body).state).toBe("orphaned");
  });

  it("waits for the second pass before looking alike, so first paint stays quick", () => {
    const anchor = describeElement(tierNamed("Team"), document.body);
    document.body.innerHTML = PRICING(
      tier("Free", "$0"),
      tier("Starter", "$8 a month"),
      tier("Team", "$20 a month"),
    );
    expect(resolveAnchor(anchor, document.body, { fuzzy: false }).state).toBe("orphaned");
  });

  it("finds an older comment without clues by its words", () => {
    const { kind, heads, ...old } = describeElement(tierNamed("Team"), document.body);
    void kind;
    void heads;
    document.body.innerHTML = PRICING(
      tier("Free", "$0"),
      tier("Starter", "$8 a month"),
      tier("Team", "$20 a month"),
    );
    expect(resolveAnchor(old, document.body).element?.textContent).toContain("Team");
  });

  it("never re-finds a place someone said is gone", () => {
    const anchor = describeElement(tierNamed("Team"), document.body);
    expect(resolveAnchor({ ...anchor, lost: true }, document.body).state).toBe("orphaned");
  });
});

describe("the place op", () => {
  const A = "A".repeat(43);
  const id = (n: string) => n.padEnd(43, "_");
  const ANCHOR: Anchor = { path: "", fingerprint: "00000000", snapshot: "x" };
  const NEW: Anchor = {
    path: ":scope > p:nth-of-type(2)",
    fingerprint: "11111111",
    snapshot: "y",
    kind: "p",
  };
  let clock = 0;
  const op = (kind: OpBody["kind"], over: Partial<OpBody>): SignedOp => {
    clock += 1;
    return {
      sig: "",
      body: {
        v: 1,
        id: id(`p${clock}`),
        kind,
        doc: "d",
        thread: id("t1"),
        author: A,
        name: "Ada",
        clock,
        at: clock,
        ...over,
      },
    };
  };

  it("sets the thread's place for everyone, and says who did it and how", () => {
    const ops = [
      op("create", { id: id("t1"), text: "Show the yearly price too?", anchor: ANCHOR }),
      op("place", { anchor: NEW, text: "moved" }),
    ];
    const [t] = foldThreads(ops);
    expect(t?.anchor).toEqual(NEW);
    expect(t?.placed).toMatchObject({ how: "moved", name: "Ada" });
  });

  it("must carry a place and say whether it was confirmed, moved or gone", () => {
    expect(isWellFormed({ sig: "x", body: op("place", { anchor: NEW, text: "moved" }).body })).toBe(true);
    expect(isWellFormed({ sig: "x", body: op("place", { anchor: NEW, text: "maybe" }).body })).toBe(false);
    expect(isWellFormed({ sig: "x", body: op("place", { text: "gone" }).body })).toBe(false);
  });
});
