// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { h, linkify } from "../../src/ui/dom";
import { threadView } from "../../src/ui/thread-view";
import type { Thread } from "../../src/model/types";

const render = (text: string) => h("div", {}, ...linkify(text));
const links = (el: Element) =>
  [...el.querySelectorAll("a")].map((a) => [a.getAttribute("href"), a.textContent, a.target, a.rel]);

describe("linkify", () => {
  it("turns http and https addresses into safe links and keeps the rest as text", () => {
    const el = render("See https://x.test/a?b=1 and http://y.test, then <b>bold</b>.");
    expect(links(el)).toEqual([
      ["https://x.test/a?b=1", "https://x.test/a?b=1", "_blank", "noopener noreferrer"],
      ["http://y.test/", "http://y.test", "_blank", "noopener noreferrer"],
    ]);
    expect(el.textContent).toBe("See https://x.test/a?b=1 and http://y.test, then <b>bold</b>.");
    expect(el.querySelector("b")).toBeNull();
  });

  it("links nothing else: no javascript:, data: or bare words", () => {
    const el = render('javascript:alert(1) data:text/html,<script>x</script> www.x.test "ftp://x.test"');
    expect(el.querySelectorAll("a")).toHaveLength(0);
  });

  it("leaves trailing punctuation and unbalanced brackets outside the link", () => {
    expect(links(render("(see https://x.test/a).")).map((l) => l[1])).toEqual(["https://x.test/a"]);
    expect(links(render("https://en.wikipedia.org/wiki/Foo_(bar)!")).map((l) => l[1])).toEqual([
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    ]);
  });

  it("links nothing for javascript:/data: in any letter case", () => {
    for (const t of ["JAVASCRIPT:alert(1)", "jaVasCript:alert(1)", "data:text/html,<b>x</b>"])
      expect(render(t).querySelectorAll("a")).toHaveLength(0);
  });

  it("normalises the scheme and host of an upper-case address", () => {
    expect(links(render("HTTPS://A.TEST/x"))[0]![0]).toBe("https://a.test/x");
  });

  it("links only the address in javascript:http://x", () => {
    expect(links(render("javascript:http://x")).map((l) => l[1])).toEqual(["http://x"]);
  });

  it("copes with a leading control character", () => {
    const el = render("\u0001https://a.test");
    expect(links(el).map((l) => l[1])).toEqual(["https://a.test"]);
    expect(el.textContent).toBe("\u0001https://a.test");
  });

  it("keeps each trailing punctuation character, and a quote after it, outside the link", () => {
    for (const p of [".", ",", ";", ":", "!", "?", "'", '"', "]", "}"]) {
      expect(links(render(`https://a.test/x${p}`)).map((l) => l[1])).toEqual(["https://a.test/x"]);
      expect(links(render(`https://a.test/x${p}"`)).map((l) => l[1])).toEqual(["https://a.test/x"]);
    }
  });

  it("does not link an address containing bidi controls", () => {
    for (const c of ["\u202A", "\u202E", "\u2066", "\u2069"])
      expect(render(`see https://a.test/${c}moc.x`).querySelectorAll("a")).toHaveLength(0);
  });

  it("stays fast on a long run of closing brackets", () => {
    const text = "https://x" + ")".repeat(100_000);
    const start = performance.now();
    const out = linkify(text);
    expect(performance.now() - start).toBeLessThan(50);
    expect(out).toEqual([text]); // over the length cap: plain text
    const within = linkify("https://x" + ")".repeat(2000));
    expect(within).toHaveLength(2); // the link, then the brackets as text
  });

  it("leaves an address longer than 2,048 characters as plain text", () => {
    const long = "https://x.test/" + "a".repeat(2040);
    expect(render(long).querySelectorAll("a")).toHaveLength(0);
    expect(render("https://x.test/" + "a".repeat(2000)).querySelectorAll("a")).toHaveLength(1);
  });

  it("a click on a link goes no further than the link", () => {
    const outer = vi.fn();
    const el = render("https://x.test/a");
    const wrap = h("div", {}, el);
    wrap.addEventListener("click", outer);
    el.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(outer).not.toHaveBeenCalled();
  });

  it("shows links in comments and replies", () => {
    const c = (id: string, text: string) => ({
      id,
      author: "a",
      name: "A",
      text,
      at: 0,
      edited: false,
      deleted: false,
      replies: [],
    });
    const t: Thread = {
      id: "t",
      resolved: false,
      anchor: { path: "", fingerprint: "00000000", snapshot: "" },
      root: { ...c("t", "Spec: https://x.test/spec"), replies: [c("r", "Also https://x.test/more")] },
    };
    const actions = { reply: vi.fn(), resolve: vi.fn(), reopen: vi.fn(), copy: vi.fn(), close: vi.fn() };
    const el = threadView(t, actions, { variant: "popover", now: () => 0 }).element;
    expect([...el.querySelectorAll(".tx a")].map((a) => a.getAttribute("href"))).toEqual([
      "https://x.test/spec",
      "https://x.test/more",
    ]);
  });
});

describe("an AI reply's references", () => {
  it("shows them as pills under the words, with a slide icon for a slide, and hides the lines", async () => {
    const { referenced } = await import("../../src/ui/dom");
    const box = document.createElement("div");
    box.append(
      ...referenced(
        "It slips with onboarding [1].\n\n[1]: slide:5\n[2]: https://example.org/notes.md#hiring notes.md › Hiring\n[3]: quote:Hiring%20a%20second Risks",
      ),
    );
    expect(box.firstChild?.textContent).toBe("It slips with onboarding.");
    const pills = [...box.querySelectorAll(".refs .ref")];
    expect(pills.map((p) => p.textContent)).toEqual(["Slide 5", "[2] notes.md › Hiring", "[3] Risks"]);
    expect(pills[0]?.querySelector("i.sl")).not.toBeNull();
    expect(pills[1]?.getAttribute("href")).toBe("https://example.org/notes.md#hiring");
    expect(pills[1]?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(pills[0]?.tagName).toBe("BUTTON");
  });
  it("sends a pressed pill to where it points, and leaves lines with no usable target as they are", async () => {
    const { referenced } = await import("../../src/ui/dom");
    const { reveal } = await import("../../src/ui/notes");
    const go = vi.fn();
    reveal.go = go;
    const box = document.createElement("div");
    box.append(...referenced("See it.\n[1]: slide:7"));
    (box.querySelector(".ref") as HTMLElement).click();
    expect(go).toHaveBeenCalledWith("slide:7");
    reveal.go = undefined;
    const bad = document.createElement("div");
    bad.append(...referenced("See [2].\n[1]: javascript:alert(1)\n[3]: ftp://example.org/"));
    expect(bad.querySelector(".ref")).toBeNull();
    expect(bad.textContent).toContain("javascript:alert(1)");
  });
});
