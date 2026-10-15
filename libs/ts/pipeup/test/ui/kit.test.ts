// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clip, fit, h } from "../../src/ui/dom";
import { createHost } from "../../src/ui/host";
import { icon } from "../../src/ui/icons";
import { STYLES } from "../../src/ui/styles";
import { authorLook, luminance, pageIsDark, parseRgb, readTheme } from "../../src/ui/theme";

afterEach(() => {
  document.documentElement.querySelectorAll("pipeup-root").forEach((e) => e.remove());
  document.documentElement.style.removeProperty("--pipeup-accent");
});

describe("h", () => {
  it("builds elements with attributes and text, never parsing HTML", () => {
    const el = h(
      "div",
      { class: "x", title: "t", hidden: true, skip: undefined },
      "<b>bold</b>",
      h("span", {}, "s"),
      null,
      false,
    );
    expect(el.className).toBe("x");
    expect(el.hasAttribute("hidden")).toBe(true);
    expect(el.hasAttribute("skip")).toBe(false);
    expect(el.textContent).toBe("<b>bold</b>s");
    expect(el.querySelector("b")).toBeNull();
  });

  it("clips long text with an ellipsis", () => {
    expect(clip("abcdef", 4)).toBe("abc…");
    expect(clip("abc", 4)).toBe("abc");
  });
});

describe("icon", () => {
  it("draws an svg from path data", () => {
    const svg = icon("comment", 17);
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("width")).toBe("17");
    expect(svg.querySelectorAll("path").length).toBe(2);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("theme", () => {
  it("parses colours and judges darkness", () => {
    expect(parseRgb("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseRgb("rgba(0, 0, 0, 0)")?.a).toBe(0);
    expect(parseRgb("transparent")).toBeNull();
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("reads the accent from --pipeup-accent and darkness from the background", () => {
    document.documentElement.style.setProperty("--pipeup-accent", "rgb(255, 102, 153)");
    document.body.style.backgroundColor = "rgb(20, 20, 20)";
    expect(readTheme(document.body, "dark")).toMatchObject({
      accent: "rgb(255, 102, 153)",
      dark: true,
      on: "#111",
    });
    // An author's accent whose words wouldn't read at 4.5 to 1 on Pipeup's surface gives way to Pipeup's own.
    document.documentElement.style.setProperty("--pipeup-accent", "rgb(255, 0, 102)");
    expect(readTheme(document.body, "dark").accent).toBe("#9A94EE");
    expect(readTheme(document.body, "light").accent).toBe("#534AB7");
    document.documentElement.style.setProperty("--pipeup-accent", "rgb(245, 196, 0)");
    expect(readTheme(document.body, "light").accent).toBe("#534AB7");
    expect(pageIsDark(document)).toBe(true);
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(pageIsDark(document)).toBe(false);
    expect(readTheme(document.body, "light").dark).toBe(false);
  });

  it("does not take a link colour that can't be seen, and picks text that reads on the accent", () => {
    document.documentElement.style.removeProperty("--pipeup-accent");
    const a = document.createElement("a");
    a.href = "#x";
    a.style.color = "rgb(157, 187, 248)"; // a dark page's pale link
    document.body.append(a);
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(readTheme(document.body, "light").accent).toBe("#534AB7");
    document.body.style.backgroundColor = "rgb(20, 20, 20)";
    const dark = readTheme(document.body, "dark");
    expect(dark.accent).toBe("rgb(157, 187, 248)"); // pale is fine on a dark surface
    expect(dark.on).toBe("#111");
    a.style.color = "rgb(40, 90, 200)";
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(readTheme(document.body, "light")).toMatchObject({ accent: "rgb(40, 90, 200)", on: "#fff" });
    // A mid blue reads at 3.7 to 1 on white, too little for words: Pipeup's own accent instead.
    a.style.color = "rgb(59, 130, 246)";
    expect(readTheme(document.body, "light").accent).toBe("#534AB7");
    a.remove();
    document.body.style.backgroundColor = "";
  });
});

describe("looks", () => {
  it("a mid-grey page keeps the look it had, instead of flipping", () => {
    document.body.style.backgroundColor = "rgb(120, 120, 120)";
    expect(pageIsDark(document, true)).toBe(true);
    expect(pageIsDark(document, false)).toBe(false);
    document.body.style.backgroundColor = "";
  });

  it("an author's data-pipeup-theme names a look; anything else is ignored", () => {
    expect(authorLook(document)).toBeNull();
    document.documentElement.setAttribute("data-pipeup-theme", "dark");
    expect(authorLook(document)).toBe("dark");
    document.documentElement.setAttribute("data-pipeup-theme", "sepia");
    expect(authorLook(document)).toBeNull();
    document.documentElement.removeAttribute("data-pipeup-theme");
  });
});

describe("styles", () => {
  it("resets inherited page styles on the layer", () => {
    expect(STYLES).toMatch(/\.layer\{all:initial;direction:ltr;unicode-bidi:normal;display:block;/);
    expect(STYLES).toMatch(/:host\{all:initial;direction:ltr;unicode-bidi:normal\}/);
  });
});

describe("host", () => {
  it("adds one ignored, fixed, click-through root with an open shadow and a layer", () => {
    const host = createHost({ font: "serif", accent: "#123456", dark: true, on: "#fff" }, "");
    expect(host.element.tagName).toBe("PIPEUP-ROOT");
    expect(host.element.parentElement).toBe(document.documentElement);
    expect(host.element.hasAttribute("data-pipeup-ignore")).toBe(true);
    expect(host.element.style.position).toBe("fixed");
    expect(host.element.style.pointerEvents).toBe("none");
    expect(host.element.shadowRoot).toBe(host.shadow);
    expect(host.element.style.opacity).toBe("1");
    expect(host.layer.classList.contains("dark")).toBe(true);
    expect(host.layer.style.getPropertyValue("--pu-accent")).toBe("#123456");
    host.destroy();
    expect(document.querySelector("pipeup-root")).toBeNull();
  });
});

describe("fit", () => {
  it("sizes an overlay to a box with padding", () => {
    const el = document.createElement("div");
    fit(el, { left: 10, top: 20, width: 100, height: 50 }, 4);
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual([
      "6px",
      "16px",
      "108px",
      "58px",
    ]);
  });
});
