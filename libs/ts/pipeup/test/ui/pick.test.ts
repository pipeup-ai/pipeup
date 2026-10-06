// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { parentBlock, pickBlock, type Look } from "../../src/ui/pick";

/** Boxes come from data-box="left,top,width,height"; data-drawn marks elements with a background or border. */
const look: Look = {
  box: (el) => {
    const [left = 0, top = 0, width = 0, height = 0] = (el.getAttribute("data-box") ?? "0,0,0,0")
      .split(",")
      .map(Number);
    return { left, top, width, height };
  },
  drawn: (el) => el.hasAttribute("data-drawn"),
  viewport: () => ({ width: 1000, height: 800 }),
};
const $ = (id: string) => document.getElementById(id)!;
const pick = (id: string) => pickBlock($(id), document.body, look)?.id ?? null;

beforeEach(() => {
  document.body.innerHTML = `
  <main id="main" data-box="0,0,1000,3000">
    <header id="hero" data-pipeup-id="hero" data-box="0,0,1000,400">
      <h1 id="title" data-box="20,20,600,60"><span id="em" data-box="20,20,100,60">Answers</span></h1>
      <button id="go" data-box="20,100,120,40"><span id="go-text" data-box="30,110,80,20">Start</span></button>
    </header>
    <section id="tiles" data-box="0,400,1000,300">
      <div id="tile" data-pipeup-id="tile-mrr" data-box="20,420,300,120">MRR <b id="mrr" data-box="60,440,60,20">$218k</b></div>
      <div id="card" data-drawn data-box="340,420,300,120"><span id="wrap" data-box="350,430,100,20"><span id="inner" data-box="350,430,100,20">Plain</span></span></div>
      <div id="chart" data-pipeup-id="chart" data-box="660,420,300,120"><img id="img" data-box="660,420,300,120"></div>
      <div id="ghost" data-box="0,0,0,0"><p id="inside" data-box="20,560,600,40">Text</p></div>
    </section>
    <div id="big" data-box="0,700,1000,2000"><span id="lost" data-box="10,710,50,20">x</span></div>
    <nav id="nav" data-pipeup-ignore data-box="0,0,1000,40"><a id="nav-link" data-box="10,10,60,20">Product</a></nav>
  </main>`;
});

describe("pickBlock", () => {
  it("picks the obvious thing under the pointer", () => {
    expect(pick("go-text")).toBe("go");
    expect(pick("em")).toBe("title");
    expect(pick("inside")).toBe("inside");
  });

  it("prefers what the author marked", () => {
    expect(pick("mrr")).toBe("tile");
    expect(pick("img")).toBe("chart");
  });

  it("picks a box that draws itself, skipping invisible wrappers", () => {
    expect(pick("inner")).toBe("card");
  });

  it("skips very large containers, the root and ignored areas", () => {
    expect(pick("lost")).toBeNull();
    expect(pickBlock(document.body, document.body, look)).toBeNull();
    expect(pick("nav-link")).toBeNull();
  });
});

describe("parentBlock", () => {
  it("steps out to the next block with a different box", () => {
    expect(parentBlock($("go"), document.body, look)?.id).toBe("hero");
    expect(parentBlock($("img"), document.body, look)).toBeNull();
    expect(parentBlock($("hero"), document.body, look)).toBeNull();
  });
});
