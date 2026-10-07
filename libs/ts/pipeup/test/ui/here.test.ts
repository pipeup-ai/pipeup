// @vitest-environment jsdom
import { isAnchor } from "../../src/model/ops";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHere,
  isHere,
  onReveal,
  pickSlide,
  setSlideHook,
  setViewState,
  type Here,
  type SlideHook,
  type SlideLook,
} from "../../src/ui/here";

/**
 * Boxes come from data-box="left,top,width,height"; data-hidden marks a slide hidden by display, visibility
 * or opacity; data-opacity is its own opacity (default 1). The window is 1000 × 800.
 */
const look: SlideLook = {
  box: (el) => {
    const [left = 0, top = 0, width = 0, height = 0] = (el.getAttribute("data-box") ?? "0,0,0,0")
      .split(",")
      .map(Number);
    return { left, top, width, height };
  },
  shown: (el) => !el.hasAttribute("data-hidden"),
  opacity: (el) => Number(el.getAttribute("data-opacity") ?? "1"),
  viewport: () => ({ width: 1000, height: 800 }),
};
const deck = (html: string) => {
  document.body.innerHTML = html;
  return [...document.querySelectorAll("[data-pipeup-slide]")];
};
const anchorOk = (view: Record<string, string>) =>
  isAnchor({ path: "p", snapshot: "s", fingerprint: "0".repeat(8), view });
const id = (el: Element | null) => el?.getAttribute("data-pipeup-slide") ?? null;
const frames = (n = 2) =>
  new Promise<void>((r) => {
    const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

let here: Here | null = null;
afterEach(() => {
  here?.destroy();
  here = null;
  setSlideHook(null);
  setViewState(null);
  delete (window as { Reveal?: unknown }).Reveal;
  document.body.innerHTML = "";
});

describe("pickSlide", () => {
  it("picks the showing slide that covers most of the window", () => {
    const s = deck(`
      <section data-pipeup-slide="1" data-box="0,-600,1000,800"></section>
      <section data-pipeup-slide="2" data-box="0,200,1000,800"></section>
      <section data-pipeup-slide="3" data-box="0,1000,1000,800"></section>`);
    expect(id(pickSlide(s, look, null))).toBe("2");
  });

  it("skips hidden slides and slides outside the window", () => {
    const s = deck(`
      <section data-pipeup-slide="1" data-hidden data-box="0,0,1000,800"></section>
      <section data-pipeup-slide="2" data-box="0,0,1000,800"></section>
      <section data-pipeup-slide="3" data-box="1200,0,1000,800"></section>`);
    expect(id(pickSlide(s, look, null))).toBe("2");
    s[1]!.setAttribute("data-hidden", "");
    expect(pickSlide(s, look, null)).toBeNull();
  });

  it("in a cross-fade the more opaque slide wins; a full tie keeps the current one", () => {
    const s = deck(`
      <section data-pipeup-slide="1" data-opacity="0.3" data-box="0,0,1000,800"></section>
      <section data-pipeup-slide="2" data-opacity="0.7" data-box="0,0,1000,800"></section>`);
    expect(id(pickSlide(s, look, s[0]!))).toBe("2");
    s[1]!.setAttribute("data-opacity", "0.3");
    expect(id(pickSlide(s, look, s[0]!))).toBe("1");
    expect(id(pickSlide(s, look, s[1]!))).toBe("2");
  });
});

describe("isHere", () => {
  it("on a deck, only the slide counts; threads with no slide are here", () => {
    expect(isHere({ slide: "2" }, "2", null)).toBe(true);
    expect(isHere({ slide: "3" }, "2", { tab: "a" })).toBe(false);
    expect(isHere(undefined, "2", null)).toBe(true);
    expect(isHere({ tab: "b" }, "2", { tab: "a" })).toBe(true);
  });

  it("elsewhere, every saved key but label must match the page's state", () => {
    expect(isHere({ tab: "faq", label: "FAQ tab" }, null, { tab: "faq", label: "FAQ" })).toBe(true);
    expect(isHere({ tab: "faq" }, null, { tab: "plans" })).toBe(false);
    expect(isHere({ tab: "faq", plan: "pro" }, null, { tab: "faq" })).toBe(false);
    // No saved view, or a page that never reported one: here.
    expect(isHere(undefined, null, { tab: "plans" })).toBe(true);
    expect(isHere({ tab: "faq" }, null, null)).toBe(true);
  });
});

describe("createHere", () => {
  it("follows the marked slide that is showing, and saves it with the page's state", async () => {
    const s = deck(`
      <section data-pipeup-slide="1" data-box="0,0,1000,800"></section>
      <section data-pipeup-slide="2" data-hidden data-box="0,0,1000,800"></section>`);
    const onCheck = vi.fn();
    here = createHere(document.body, onCheck, look);
    expect(here.slide()).toBe("1");
    setViewState({ tab: "pricing", label: "Pricing tab" });
    expect(here.view()).toEqual({ slide: "1", tab: "pricing", label: "Pricing tab" });
    s[0]!.setAttribute("data-hidden", "");
    s[1]!.removeAttribute("data-hidden");
    s[1]!.setAttribute("class", "on");
    await frames();
    expect(here.slide()).toBe("2");
    expect(onCheck).toHaveBeenCalled();
  });

  it("a new comment takes the slide holding its content, else the current one", () => {
    deck(`
      <section data-pipeup-slide="1" data-box="0,0,1000,800"><p id="a">A</p></section>
      <section data-pipeup-slide="2" data-hidden data-box="0,0,1000,800"><p id="b">B</p></section>
      <p id="out">Out</p>`);
    here = createHere(document.body, () => {}, look);
    expect(here.view(document.getElementById("b")!.firstChild!)).toEqual({ slide: "2" });
    expect(here.view(document.getElementById("out")!)).toEqual({ slide: "1" });
  });

  it("keeps only string values within the anchor's limits, never the slide, and forgets on null", () => {
    here = createHere(document.body, () => {}, look);
    expect(here.view()).toBeUndefined();
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "v"]));
    setViewState({ ...many, slide: "9", n: 3 as unknown as string, long: "x".repeat(201) });
    const v = here.view()!;
    expect(Object.keys(v)).toHaveLength(15);
    expect(v.slide).toBeUndefined();
    expect(v.long).toBeUndefined();
    setViewState(null);
    expect(here.view()).toBeUndefined();
  });

  it("a deck's hook says where it is and goes there", async () => {
    let at = 1;
    const go = vi.fn((n: number) => void (at = n));
    setSlideHook({ current: () => at, go });
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBe("1");
    expect(here.holds({ slide: "3" })).toBe(false);
    await expect(here.navigate({ slide: "3" })).resolves.toBe(true);
    expect(go).toHaveBeenCalledWith(3);
    expect(here.slide()).toBe("3");
  });

  it("gives up after a second when the deck doesn't move", async () => {
    setSlideHook({ current: () => 1, go: () => {} });
    here = createHere(document.body, () => {}, look);
    const t0 = performance.now();
    await expect(here.navigate({ slide: "2" })).resolves.toBe(false);
    expect(performance.now() - t0).toBeGreaterThanOrEqual(990);
  });

  it("follows and drives reveal.js", async () => {
    deck(`<div class="reveal"><div class="slides">
      <section data-pipeup-slide="1"></section><section><div data-pipeup-slide="2"></div></section><section></section>
    </div></div>`);
    let h = 1;
    const slide = vi.fn((n: number) => void (h = n));
    (window as { Reveal?: unknown }).Reveal = { getIndices: () => ({ h, v: 0 }), slide };
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBe("2");
    await expect(here.navigate({ slide: "1" })).resolves.toBe(true);
    expect(slide).toHaveBeenCalledWith(0);
    // An unmarked section counts by its place in the deck.
    h = 2;
    await frames();
    expect(here.holds({ slide: "3" })).toBe(false);
    window.dispatchEvent(new Event("slidechanged"));
    await frames();
    expect(here.slide()).toBe("3");
  });

  it("asks the page to reveal a view it reported, and resolves once the page says it is there", async () => {
    setViewState({ tab: "plans" });
    here = createHere(document.body, () => {}, look);
    const off = onReveal((view) => setViewState({ tab: view.tab! }));
    const seen = vi.fn();
    const off2 = onReveal(seen);
    await expect(here.navigate({ tab: "faq", label: "FAQ tab" })).resolves.toBe(true);
    expect(seen).toHaveBeenCalledWith({ tab: "faq", label: "FAQ tab" });
    off();
    off2();
    // With nothing to go there, it says so at once.
    await expect(here.navigate({ tab: "plans2" })).resolves.toBe(false);
  });

  it("a failing handler is reported, not thrown", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    setViewState({ tab: "plans" });
    here = createHere(document.body, () => {}, look);
    const off = onReveal(() => {
      throw new Error("page bug");
    });
    await expect(here.navigate({ tab: "faq" })).resolves.toBe(false);
    expect(reportError).toHaveBeenCalled();
    off();
    vi.unstubAllGlobals();
  });

  it("a hook or Reveal that throws never breaks Pipeup", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    setSlideHook({
      current: () => {
        throw new Error("hook bug");
      },
      go: () => {},
    });
    let made: Here | undefined;
    expect(() => (made = createHere(document.body, () => {}, look))).not.toThrow();
    here = made!;
    expect(here.slide()).toBeNull();
    const t0 = performance.now();
    // With no slide known the page is not a deck as far as Pipeup can tell, so a slide view counts as here.
    await expect(here.navigate({ slide: "2" })).resolves.toBe(true);
    expect(performance.now() - t0).toBeLessThan(1500);
    here.destroy();
    setSlideHook(null);
    (window as { Reveal?: unknown }).Reveal = {
      getIndices: () => {
        throw new Error("reveal bug");
      },
      slide: () => {},
    };
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBeNull();
    expect(reportError).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a hook without current and go is no hook", () => {
    deck(`<section data-pipeup-slide="1" data-box="0,0,1000,800"></section>`);
    setSlideHook({} as unknown as SlideHook);
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBe("1");
  });

  it("saves a slide only when it is a string within the limits", () => {
    deck(`<section data-pipeup-slide="${"x".repeat(300)}" data-box="0,0,1000,800"><p id="p">A</p></section>`);
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBeNull();
    const v = here.view(document.getElementById("p")!);
    expect(v).toBeUndefined();
    setViewState({ tab: "a" });
    const w = here.view(document.getElementById("p")!)!;
    expect(w.slide).toBeUndefined();
    expect(anchorOk(w)).toBe(true);
  });

  it("never navigates a deck to a stored slide that is not a whole number", async () => {
    const go = vi.fn();
    setSlideHook({ current: () => 1, go });
    here = createHere(document.body, () => {}, look);
    await expect(here.navigate({ slide: "2.5" })).resolves.toBe(false);
    await expect(here.navigate({ slide: "abc" })).resolves.toBe(false);
    for (const slide of ["-5", "", "1e3", "0"]) await expect(here.navigate({ slide })).resolves.toBe(false);
    expect(go).not.toHaveBeenCalled();
  });

  it("a hook that says no slide (or not a slide number) is not saved; the marked slide is used", () => {
    deck(`<section data-pipeup-slide="7" data-box="0,0,1000,800"></section>`);
    for (const n of [undefined, NaN, 0, -1, 2.5]) {
      setSlideHook({ current: () => n as unknown as number, go: () => {} });
      here = createHere(document.body, () => {}, look);
      expect(here.slide()).toBe("7");
      here.destroy();
    }
    document.body.innerHTML = "";
    setSlideHook({ current: () => undefined as unknown as number, go: () => {} });
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBeNull();
  });

  it("settles within a second even when animation frames are paused", async () => {
    setSlideHook({ current: () => 1, go: () => {} });
    here = createHere(document.body, () => {}, look);
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const t0 = performance.now();
    await expect(here.navigate({ slide: "2" })).resolves.toBe(false);
    expect(performance.now() - t0).toBeLessThan(1500);
    vi.unstubAllGlobals();
  });

  it("forgets a remembered slide that left the document", () => {
    const s = deck(`<section data-pipeup-slide="1" data-box="0,0,1000,800"></section>`);
    here = createHere(document.body, () => {}, look);
    expect(here.slide()).toBe("1");
    s[0]!.remove();
    window.dispatchEvent(new Event("scroll"));
    return frames().then(() => expect(here!.slide()).toBeNull());
  });

  it("destroy stops onCheck", async () => {
    deck(`<section data-pipeup-slide="1" data-box="0,0,1000,800"></section>`);
    const onCheck = vi.fn();
    here = createHere(document.body, onCheck, look);
    here.destroy();
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("slidechanged"));
    setViewState({ tab: "x" });
    await frames();
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("a view built from hostile state is a valid anchor view", () => {
    here = createHere(document.body, () => {}, look);
    const hostile = JSON.parse(
      '{"__proto__":"x","constructor":"y","a":1,"b":null,"c":{"d":"e"},"long":"' +
        "z".repeat(500) +
        '","ok":"fine"}',
    ) as Record<string, unknown>;
    setViewState(hostile);
    const v = here.view()!;
    expect(v).toEqual({ ok: "fine", constructor: "y" });
    expect(Object.getPrototypeOf(v)).toBe(Object.prototype);
    expect(anchorOk(v)).toBe(true);
  });
});
