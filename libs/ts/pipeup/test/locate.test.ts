// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { describeElement, describeRange } from "../src/anchor/describe";
import { labelOf, locate, viewName } from "../src/anchor/locate";
import { resolveAnchor } from "../src/anchor/resolve";
import { indexText, rangeFromOffsets } from "../src/anchor/text";

beforeEach(() => {
  document.body.innerHTML = `
    <h2>Q3 plan</h2>
    <p>We target a 20% lift.</p>
    <h2>Pricing</h2>
    <a href="#" data-pipeup-id="cta">Start free trial</a>
    <section data-pipeup-slide="3" data-pipeup-id="s3"><h2>Revenue grew 42%</h2><div class="bar" data-pipeup-label="Q4 bar"></div></section>`;
});

describe("labelOf", () => {
  it("names elements by kind and their words (cut short when long), or by their label", () => {
    expect(labelOf(document.querySelector("a")!)).toBe("Link · Start free trial");
    expect(labelOf(document.querySelector(".bar")!)).toBe("Q4 bar");
    expect(labelOf(document.querySelector("p")!)).toBe("Paragraph · We target a 20% lift.");
    const long = document.createElement("p");
    long.textContent = "x".repeat(60);
    expect(labelOf(long)).toBe(`Paragraph · ${"x".repeat(39)}…`);
    // Long words keep their start, cut short with an ellipsis within the 40-character budget.
    long.textContent = "Everything you save is there on the plane.";
    expect(labelOf(long)).toBe("Paragraph · Everything you save is there on the pla…");
    long.textContent = "x".repeat(40);
    expect(labelOf(long)).toBe(`Paragraph · ${"x".repeat(40)}`);
  });
});

describe("labelOf for controls and structures", () => {
  it("names a control by what it is and its own words: its label, its chosen option", () => {
    document.body.innerHTML = `
      <label><input type="checkbox" id="c"> Email me updates</label>
      <button role="switch" id="s">Dark mode</button>
      <button role="tab" id="t">Overview</button>
      <details><summary id="d">Shipping and returns</summary></details>
      <select id="p"><option>Monthly</option><option selected>Yearly</option></select>
      <input id="e" placeholder="you@example.test">
      <ul id="l"><li>One</li></ul>
      <div role="constructor" id="x">Odd role</div>`;
    const at = (s: string) => labelOf(document.querySelector(s)!);
    expect(at("#c")).toBe("Checkbox · Email me updates");
    expect(at("#s")).toBe("Switch · Dark mode");
    expect(at("#t")).toBe("Tab · Overview");
    expect(at("#d")).toBe("Disclosure · Shipping and returns");
    expect(at("#p")).toBe("Dropdown · Yearly");
    expect(at("#e")).toBe("Field · you@example.test");
    expect(at("#l")).toBe("List · One");
    // Only the roles Pipeup knows count, never a name every object has.
    expect(at("#x")).toBe("Block · Odd role");
  });

  it("names a wordless block by its shape", () => {
    document.body.innerHTML = `<div id="b"></div>`;
    const b = document.querySelector("#b")!;
    const box = (width: number, height: number) =>
      (b.getBoundingClientRect = () => ({ width, height }) as DOMRect);
    box(40, 120);
    expect(labelOf(b)).toBe("Bar");
    box(200, 60);
    expect(labelOf(b)).toBe("Bar");
    box(50, 50);
    expect(labelOf(b)).toBe("Shape");
  });
});

describe("locate", () => {
  it("describes a text comment by section and block", () => {
    const p = document.querySelector("p")!;
    const index = indexText(p);
    const i = index.text.indexOf("20% lift");
    const anchor = describeRange(rangeFromOffsets(index, i, i + 8)!, document.body);
    const loc = locate(anchor, resolveAnchor(anchor, document.body), document.body);
    expect(loc.where).toBe('Section "Q3 plan" › Paragraph · We target a 20% lift.');
    expect(loc.quote).toBe("20% lift");
    expect(loc.pin).toBeNull();
  });

  it("describes an element comment by section, label and id", () => {
    const anchor = describeElement(document.querySelector("a")!, document.body);
    const loc = locate(anchor, resolveAnchor(anchor, document.body), document.body);
    expect(loc.where).toBe('Section "Pricing" › Link · Start free trial');
    expect(loc.id).toBe("cta");
  });

  it("describes a slide pin by slide number and title", () => {
    const bar = document.querySelector(".bar")!;
    const anchor = describeElement(bar, document.body, { x: 0.5, y: 0.06 }, { slide: "3" });
    const loc = locate(anchor, resolveAnchor(anchor, document.body), document.body);
    expect(loc.where).toBe('Slide 3 "Revenue grew 42%" › Q4 bar');
    expect(loc.pin).toBe("50% across, 6% down the element");
  });

  it("names a view the page reported before the section; a slide's view is the slide", () => {
    const a = document.querySelector("a")!;
    const labelled = describeElement(a, document.body, undefined, { tab: "pricing", label: "Pricing tab" });
    expect(locate(labelled, resolveAnchor(labelled, document.body), document.body).where).toBe(
      'Pricing tab › Section "Pricing" › Link · Start free trial',
    );
    const plain = describeElement(a, document.body, undefined, { tab: "pricing", plan: "pro" });
    expect(locate(plain, resolveAnchor(plain, document.body), document.body).where).toBe(
      'pricing · pro › Section "Pricing" › Link · Start free trial',
    );
  });

  it("takes a section's heading from before it, never from another card or a hidden panel", () => {
    document.body.innerHTML = `
      <h2>Features</h2>
      <div class="cards">
        <div class="card"><h3>Offline first</h3><p>On the plane.</p></div>
        <div class="card" id="listen"><h3>Listen</h3> <p>Natural voices.</p></div>
      </div>
      <div class="wrap"><h2>Pricing</h2></div>
      <p id="price">Pro is $12.</p>
      <div role="tabpanel" hidden><h2>FAQ</h2><p id="refunds">Refunds within 30 days.</p></div>
      <p id="fine">Fine print.</p>`;
    const where = (s: string) => {
      const a = describeElement(document.querySelector(s)!, document.body);
      return locate(a, resolveAnchor(a, document.body), document.body).where;
    };
    expect(where("#listen")).toBe('Section "Features" › Block · Listen Natural voices.');
    // A wrapper holding only its heading is the heading.
    expect(where("#price")).toBe('Section "Pricing" › Paragraph · Pro is $12.');
    // Content hidden with its heading keeps it.
    expect(where("#refunds")).toBe('Section "FAQ" › Paragraph · Refunds within 30 days.');
    expect(where("#fine")).toBe('Section "Pricing" › Paragraph · Fine print.');
  });

  it("says when the id is a marked element around the one commented on", () => {
    const own = describeElement(document.querySelector(".bar")!, document.body);
    expect(locate(own, resolveAnchor(own, document.body), document.body).within).toBe(true);
    const cta = describeElement(document.querySelector("a")!, document.body);
    expect(locate(cta, resolveAnchor(cta, document.body), document.body).within).toBe(false);
  });

  it("explains orphaned comments with their snapshot", () => {
    const anchor = describeElement(document.querySelector("a")!, document.body);
    document.querySelector("a")!.remove();
    const loc = locate(anchor, resolveAnchor(anchor, document.body), document.body);
    expect(loc.where).toBe('No longer on the page (it read: "Start free trial")');
  });
});

describe("viewName", () => {
  it("is the label, else the values joined, never the slide", () => {
    expect(viewName({ tab: "faq", label: "FAQ tab" })).toBe("FAQ tab");
    expect(viewName({ slide: "3", tab: "faq", plan: "pro" })).toBe("faq · pro");
    expect(viewName({ slide: "3" })).toBe("");
    expect(viewName(undefined)).toBe("");
    expect(viewName({ tab: "faq", label: "" })).toBe("faq");
  });
});
