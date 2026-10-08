// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clip, fit, h } from "../../src/ui/dom";
import { createHost } from "../../src/ui/host";
import { icon } from "../../src/ui/icons";
import { STYLES } from "../../src/ui/styles";
import { luminance, parseRgb, readTheme } from "../../src/ui/theme";

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
    document.documentElement.style.setProperty("--pipeup-accent", "#ff0066");
    document.body.style.backgroundColor = "rgb(20, 20, 20)";
    const t = readTheme(document.body);
    expect(t.accent).toBe("#ff0066");
    expect(t.dark).toBe(true);
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(readTheme(document.body).dark).toBe(false);
  });

  it("does not take a link colour that can't be seen, and picks text that reads on the accent", () => {
    document.documentElement.style.removeProperty("--pipeup-accent");
    const a = document.createElement("a");
    a.href = "#x";
    a.style.color = "rgb(157, 187, 248)"; // a dark page's pale link
    document.body.append(a);
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(readTheme(document.body).accent).toBe("#534AB7");
    document.body.style.backgroundColor = "rgb(20, 20, 20)";
    const dark = readTheme(document.body);
    expect(dark.accent).toBe("rgb(157, 187, 248)"); // pale is fine on a dark surface
    expect(dark.on).toBe("#111");
    a.style.color = "rgb(40, 90, 200)";
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(readTheme(document.body)).toMatchObject({ accent: "rgb(40, 90, 200)", on: "#fff" });
    a.remove();
    document.body.style.backgroundColor = "";
  });
});

describe("styles", () => {
  it("resets inherited page styles on the layer", () => {
    expect(STYLES).toMatch(/\.layer\{all:initial;display:block;/);
  });
});

describe("host", () => {
  it("adds one ignored, fixed, click-through root with an open shadow and a layer", () => {
    const host = createHost({ font: "serif", accent: "#123456", dark: true, on: "#fff" });
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
