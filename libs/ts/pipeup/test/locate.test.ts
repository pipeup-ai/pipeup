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
