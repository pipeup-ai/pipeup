// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { describeElement, describeRange } from "../src/anchor/describe";
import { resolveAnchor } from "../src/anchor/resolve";
import { indexText, rangeFromOffsets } from "../src/anchor/text";

const PAGE = `
  <main>
    <p id="a">We will launch the new onboarding flow in July, targeting a 20% lift in week-one retention.</p>
    <p id="b">Pricing changes follow in August.</p>
    <div data-pipeup-id="chart"><svg></svg><span>Q4</span></div>
  </main>`;

beforeEach(() => {
  document.body.innerHTML = PAGE;
});

function quote(el: Element, words: string) {
  const index = indexText(el);
  const i = index.text.indexOf(words);
  return describeRange(rangeFromOffsets(index, i, i + words.length)!, document.body);
}

describe("resolveAnchor", () => {
  it("attaches text that is unchanged", () => {
    const anchor = quote(document.getElementById("a")!, "targeting a 20% lift");
    const r = resolveAnchor(anchor, document.body);
    expect(r.state).toBe("attached");
    expect(r.range?.toString()).toBe("targeting a 20% lift");
  });

  it("re-finds text after the page re-renders and moves things around", () => {
    const anchor = quote(document.getElementById("b")!, "Pricing changes");
    document.body.innerHTML = `<header>New banner</header>${PAGE}`;
    const r = resolveAnchor(anchor, document.body);
    expect(r.state).toBe("attached");
    expect(r.range?.toString()).toBe("Pricing changes");
  });

  it("marks text as moved when its paragraph was edited", () => {
    const anchor = quote(document.getElementById("a")!, "week-one retention");
    document.getElementById("a")!.textContent = "We now target better week-one retention overall.";
    const r = resolveAnchor(anchor, document.body);
    expect(r.state).toBe("moved");
    expect(r.range?.toString()).toBe("week-one retention");
  });

  it("finds reworded text approximately and marks it moved", () => {
    const anchor = quote(document.getElementById("a")!, "targeting a 20% lift in week-one retention");
    document.getElementById("a")!.textContent = "We launch in July, target a 25% lift in week-one retention.";
    const r = resolveAnchor(anchor, document.body);
    expect(r.state).toBe("moved");
    expect(r.range?.toString()).toContain("lift in week-one retention");
  });

  it("skips approximate search when fuzzy is off", () => {
    const anchor = quote(document.getElementById("a")!, "targeting a 20% lift in week-one retention");
    document.getElementById("a")!.textContent = "We launch in July, target a 25% lift in week-one retention.";
    expect(resolveAnchor(anchor, document.body, { fuzzy: false }).state).toBe("orphaned");
    expect(resolveAnchor(anchor, document.body).state).toBe("moved");
  });

  it("picks the occurrence whose context matches", () => {
    document.body.innerHTML = "<p>Alpha: the plan. Beta: the plan.</p>";
    const p = document.querySelector("p")!;
    const second = p.textContent!.lastIndexOf("the plan");
    const anchor = describeRange(rangeFromOffsets(indexText(p), second, second + 8)!, document.body);
    const r = resolveAnchor(anchor, document.body);
    expect(r.range?.startOffset).toBe(second);
  });

  it("orphans text that is gone", () => {
    const anchor = quote(document.getElementById("b")!, "Pricing changes follow");
    document.getElementById("b")!.remove();
    expect(resolveAnchor(anchor, document.body).state).toBe("orphaned");
  });

  it("resolves elements by stable id and path", () => {
    const span = document.querySelector("[data-pipeup-id=chart] span")!;
    const anchor = describeElement(span, document.body, { x: 0.5, y: 0.5 });
    document.body.innerHTML = `<aside>Inserted</aside>${PAGE}`;
    const r = resolveAnchor(anchor, document.body);
    expect(r.state).toBe("attached");
    expect(r.element?.textContent).toBe("Q4");
  });

  it("marks changed elements moved and missing ones orphaned", () => {
    const span = document.querySelector("[data-pipeup-id=chart] span")!;
    const anchor = describeElement(span, document.body);
    span.textContent = "Q4 (est.)";
    expect(resolveAnchor(anchor, document.body).state).toBe("moved");
    document.querySelector("[data-pipeup-id=chart]")!.remove();
    expect(resolveAnchor(anchor, document.body).state).toBe("orphaned");
  });

  describe("untrusted anchors", () => {
    const base = { path: "", fingerprint: "x", snapshot: "" };

    it("matches an id with newline and bracket by exact attribute", () => {
      const el = document.createElement("section");
      el.setAttribute("data-pipeup-id", "a\n]b");
      document.body.appendChild(el);
      const r = resolveAnchor({ ...base, id: "a\n]b" }, document.body);
      expect(r.element).toBe(el);
      expect(resolveAnchor({ ...base, id: "a\n]c" }, document.body).state).toBe("orphaned");
    });

    it("orphans malformed and foreign paths without throwing", () => {
      expect(resolveAnchor({ ...base, path: ":scope > div[" }, document.body).state).toBe("orphaned");
      expect(resolveAnchor({ ...base, path: "body p" }, document.body).state).toBe("orphaned");
    });
  });

  describe("approximate search bounds", () => {
    const pad = (n: number) => "lorem ipsum dolor sit amet ".repeat(Math.ceil(n / 27)).slice(0, n);
    function reword(exact: string, changed: string, page: string) {
      document.body.innerHTML = `<p id="q">${exact}</p>`;
      const anchor = quote(document.getElementById("q")!, exact);
      document.body.innerHTML = `<p>${changed}</p><p>${page}</p>`;
      return resolveAnchor(anchor, document.body);
    }

    it("does not treat short quotes as moved on a 1-edit near match", () => {
      expect(reword("cat sx", "zzz", "the cat sat on the mat").state).toBe("orphaned");
    });

    it("skips approximate search on very large pages, finds it on small ones", () => {
      const exact = "the quick brown fox jumps over the lazy dog";
      const changed = "the quick brown fox jumped over the lazy dog";
      expect(reword(exact, changed, "x").state).toBe("moved");
      expect(reword(exact, changed, pad(50_001)).state).toBe("orphaned");
    });

    it("skips approximate search for quotes over 300 chars", () => {
      const exact = pad(301);
      const changed = exact.slice(0, 100) + "ZZZ" + exact.slice(103);
      expect(reword(exact, changed, "x").state).toBe("orphaned");
    });
  });
});
