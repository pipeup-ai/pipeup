// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cssPath, describeElement, describeRange } from "../src/anchor/describe";
import { indexText, rangeFromOffsets, textOffset } from "../src/anchor/text";
import { isAnchor } from "../src/model/ops";
import { fingerprint } from "../src/util/encoding";

beforeEach(() => {
  document.body.innerHTML = `
    <main>
      <h1>Q3 plan</h1>
      <p id="p1">We will launch the <b>new onboarding</b> flow in July.</p>
      <section data-pipeup-id="team"><p>The team stays at six people.</p><button>Save</button></section>
    </main>`;
});

function selectText(el: Element, from: number, to: number): Range {
  const range = rangeFromOffsets(indexText(el), from, to);
  if (!range) throw new Error("bad offsets");
  return range;
}

describe("text index", () => {
  it("maps offsets across element boundaries both ways", () => {
    const p = document.getElementById("p1")!;
    const index = indexText(p);
    const start = index.text.indexOf("new onboarding flow");
    const range = rangeFromOffsets(index, start, start + "new onboarding flow".length)!;
    expect(range.toString()).toBe("new onboarding flow");
    expect(textOffset(p, range.startContainer, range.startOffset)).toBe(start);
  });
});

describe("describeRange", () => {
  it("stores the quote with context relative to the page when nothing is marked", () => {
    const p = document.getElementById("p1")!;
    const anchor = describeRange(selectText(p, 19, 33), document.body);
    expect(isAnchor(anchor)).toBe(true);
    expect(anchor.id).toBeUndefined();
    expect(anchor.quote?.exact).toBe("new onboarding");
    expect(anchor.quote?.prefix.endsWith("launch the ")).toBe(true);
    expect(anchor.quote?.suffix.startsWith(" flow in July")).toBe(true);
    expect(anchor.fingerprint).toBe(fingerprint(p.textContent ?? ""));
    expect(anchor.snapshot).toContain("new onboarding flow");
  });

  it("uses the nearest marked element as its base", () => {
    const section = document.querySelector("[data-pipeup-id=team]")!;
    const p = section.querySelector("p")!;
    const anchor = describeRange(selectText(p, 4, 8), document.body, { slide: "2" });
    expect(isAnchor(anchor)).toBe(true);
    expect(anchor.id).toBe("team");
    expect(anchor.quote?.exact).toBe("team");
    expect(anchor.view).toEqual({ slide: "2" });
  });
});

describe("describeElement", () => {
  it("records a path from the marked ancestor and a clamped pin point", () => {
    const button = document.querySelector("button")!;
    const anchor = describeElement(button, document.body, { x: 1.4, y: -0.2 });
    expect(isAnchor(anchor)).toBe(true);
    expect(anchor.id).toBe("team");
    expect(anchor.path).toBe(":scope > button:nth-of-type(1)");
    expect(anchor.point).toEqual({ x: 1, y: 0 });
    expect(anchor.snapshot).toBe("Save");
  });

  it("records a path from the root when nothing is marked", () => {
    const p = document.getElementById("p1")!;
    expect(describeElement(p, document.body).path).toBe(":scope > main:nth-of-type(1) > p:nth-of-type(1)");
    expect(cssPath(p, p)).toBe("");
  });
});

describe("valid anchors only", () => {
  const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

  it("skips marked elements with an empty id and uses the next valid ancestor", () => {
    document.body.innerHTML = `<section data-pipeup-id="outer"><div data-pipeup-id=""><p>hello world</p></div></section>`;
    const p = document.querySelector("p")!;
    const anchor = describeRange(selectText(p, 0, 5), document.body);
    expect(anchor.id).toBe("outer");
    expect(isAnchor(anchor)).toBe(true);
    document.body.innerHTML = `<div data-pipeup-id=""><p>hello world</p></div>`;
    const a2 = describeRange(selectText(document.querySelector("p")!, 0, 5), document.body);
    expect(a2.id).toBeUndefined();
    expect(isAnchor(a2)).toBe(true);
  });

  it("treats a 201-character id as unmarked", () => {
    document.body.innerHTML = `<section data-pipeup-id="${"x".repeat(201)}"><p>hello world</p></section>`;
    const anchor = describeRange(selectText(document.querySelector("p")!, 0, 5), document.body);
    expect(anchor.id).toBeUndefined();
    expect(isAnchor(anchor)).toBe(true);
  });

  it("rejects a selection outside the commentable area", () => {
    const main = document.querySelector("main")!;
    const outside = document.createElement("aside");
    outside.textContent = "Not part of the document";
    document.body.append(outside);
    expect(() => describeRange(selectText(outside, 0, 8), main)).toThrow(
      "pipeup: the selection is outside the commentable area",
    );
  });

  it("rejects a collapsed range", () => {
    const p = document.getElementById("p1")!;
    expect(() => describeRange(selectText(p, 3, 3), document.body)).toThrow(/select some text/);
  });

  it("rejects selections over the quote limit", () => {
    document.body.innerHTML = `<p>${"a".repeat(10_001)}</p>`;
    const p = document.querySelector("p")!;
    expect(() => describeRange(selectText(p, 0, 10_001), document.body)).toThrow(
      /limited to 10000 characters/,
    );
  });

  it("rejects elements nested too deeply to path", () => {
    document.body.innerHTML = "<div id=top></div>";
    let el: Element = document.getElementById("top")!;
    for (let i = 0; i < 150; i++) {
      const child = document.createElement("div");
      el.appendChild(child);
      el = child;
    }
    expect(() => describeElement(el, document.body)).toThrow(/nested too deeply/);
  });

  it("treats a non-finite point coordinate as 0", () => {
    const button = document.querySelector("button")!;
    const anchor = describeElement(button, document.body, { x: NaN, y: 0.5 });
    expect(anchor.point).toEqual({ x: 0, y: 0.5 });
  });

  it("never splits a surrogate pair in context or snapshot", () => {
    document.body.innerHTML = `<p>a${"\u{1F600}".repeat(60)}xneedley${"\u{1F600}".repeat(60)}</p>`;
    const p = document.querySelector("p")!;
    const start = p.textContent!.indexOf("needle");
    const anchor = describeRange(selectText(p, start, start + 6), document.body);
    expect(anchor.quote?.prefix).not.toMatch(LONE);
    expect(anchor.quote?.suffix).not.toMatch(LONE);
    expect(anchor.snapshot).not.toMatch(LONE);
    expect(isAnchor(anchor)).toBe(true);
  });

  it("refuses an invalid view with a clear error", () => {
    const view = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, "v"]));
    const p = document.getElementById("p1")!;
    expect(() => describeRange(selectText(p, 0, 3), document.body, view)).toThrow(/could not describe/);
    const button = document.querySelector("button")!;
    expect(() => describeElement(button, document.body, undefined, view)).toThrow(/could not describe/);
  });
});
