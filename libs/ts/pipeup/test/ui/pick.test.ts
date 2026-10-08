// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { blockTree, childBlocks, isBlock, parentBlock, pickBlock, row, type Look } from "../../src/ui/pick";

/**
 * Boxes come from data-box="left,top,width,height"; data-drawn marks elements with a background or border,
 * data-grouped ones laid out as flex or grid.
 */
const look: Look = {
  box: (el) => {
    const [left = 0, top = 0, width = 0, height = 0] = (el.getAttribute("data-box") ?? "0,0,0,0")
      .split(",")
      .map(Number);
    return { left, top, width, height };
  },
  drawn: (el) => el.hasAttribute("data-drawn"),
  grouped: (el) => el.hasAttribute("data-grouped"),
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

describe("pickBlock: sections, lists, roles and groups", () => {
  beforeEach(() => {
    document.body.innerHTML = `
    <div id="page" data-box="0,0,1000,3000">
      <section id="sec" data-box="0,0,800,300"><div id="sec-text" data-box="10,10,300,20">Words</div></section>
      <ul id="list" data-box="0,320,400,200"><div id="list-gap" data-box="0,320,400,10"></div></ul>
      <div id="rolebox" data-box="0,540,400,60"><span id="fake" role="button" data-box="10,550,80,30"><i id="fake-i" data-box="12,552,20,20"></i></span></div>
      <div id="row" data-grouped data-box="0,620,600,40"><span id="a" data-box="0,620,100,40"></span><span id="b" data-box="120,620,100,40"></span></div>
      <div id="one" data-grouped data-box="0,680,600,40"><span id="only" data-box="0,680,100,40"></span></div>
      <button id="btn" data-box="0,740,200,40"><span id="btn-in" data-grouped data-box="4,744,190,32"><i id="ic" data-box="8,750,16,16"></i><i id="tx" data-box="30,750,100,16"></i></span></button>
      <section id="huge" data-box="0,800,1000,700"><div id="huge-text" data-box="10,810,100,20">x</div></section>
      <dl id="terms" data-box="0,1600,400,80"><dt id="term" data-box="0,1600,400,20">Term</dt><dd id="def" data-box="0,1620,400,20">Meaning</dd></dl>
    </div>`;
  });

  it("picks sections, lists and terms", () => {
    expect(pick("sec-text")).toBe("sec");
    expect(pick("list-gap")).toBe("list");
    expect(pick("term")).toBe("term");
    expect(pick("def")).toBe("def");
  });

  it("picks an element with an accessible role", () => {
    expect(pick("fake-i")).toBe("fake");
  });

  it("picks a flex or grid box only when it groups several things", () => {
    expect(pick("a")).toBe("row");
    expect(pick("only")).toBeNull();
  });

  it("never picks a control's own inner layout", () => {
    expect(pick("ic")).toBe("btn");
  });

  it("still skips a section covering most of the window", () => {
    expect(pick("huge-text")).toBeNull();
  });
});

describe("parentBlock", () => {
  it("steps out to the next block with a different box", () => {
    expect(parentBlock($("go"), document.body, look)?.id).toBe("hero");
    expect(parentBlock($("img"), document.body, look)?.id).toBe("tiles");
    expect(parentBlock($("hero"), document.body, look)).toBeNull();
  });
});

const ids = (blocks: readonly { el: Element }[]) => blocks.map((b) => b.el.id);

describe("isBlock", () => {
  it("is the rule pickBlock stops at", () => {
    expect(
      ["hero", "title", "go", "tiles", "tile", "card", "chart", "img", "inside"].every((id) =>
        isBlock($(id), look),
      ),
    ).toBe(true);
    expect(["main", "em", "go-text", "mrr", "wrap", "ghost", "big"].some((id) => isBlock($(id), look))).toBe(
      false,
    );
  });
});

describe("blockTree", () => {
  it("lists every block in page order with its level; marked wrappers win, ignored areas are left out", () => {
    const tree = blockTree(document.body, look);
    expect(ids(tree)).toEqual(["hero", "title", "go", "tiles", "tile", "card", "chart", "inside"]);
    expect(tree.map((b) => b.level)).toEqual([1, 0, 0, 1, 0, 0, 0, 0]);
    expect(tree.map((b) => b.up?.el.id ?? null)).toEqual([
      null,
      "hero",
      "hero",
      null,
      "tiles",
      "tiles",
      "tiles",
      "tiles",
    ]);
  });

  it("folds a same-size wrapper into the block inside it, as parentBlock skips it", () => {
    document.body.innerHTML = `
    <section id="s" data-box="0,0,800,300">
      <div id="card" data-drawn data-box="0,0,400,100"><p id="cp" data-box="0,0,400,100">Same box</p></div>
      <div id="m" data-pipeup-id="m" data-box="0,120,400,100"><p id="mp" data-box="0,120,400,100">Marked</p></div>
      <li id="li" data-box="0,240,400,40"><a id="la" data-box="10,250,50,20">Link</a></li>
    </section>`;
    const tree = blockTree(document.body, look);
    expect(ids(tree)).toEqual(["s", "cp", "m", "li", "la"]);
    expect(tree.map((b) => b.level)).toEqual([2, 0, 0, 1, 0]);
    expect(parentBlock($("cp"), document.body, look)?.id).toBe("s");
    expect(pickBlock($("mp"), document.body, look)?.id).toBe("m");
    expect(ids(blockTree(document.body, look, (el) => el.id !== "li"))).toEqual(["s", "cp", "m"]);
  });
});

describe("blockTree: only what a reviewer would click", () => {
  /** data-display, data-position, data-clips and data-off stand for the computed styles pageLook reads. */
  const flowLook: Look = {
    ...look,
    flow: (el) => ({
      display: el.getAttribute("data-display") ?? "block",
      position: el.getAttribute("data-position") ?? "static",
      clips: el.hasAttribute("data-clips"),
      off: el.hasAttribute("data-off"),
    }),
  };

  it("skips the parts inside a link or button, keys and words inside a line of text, and tiny decorations", () => {
    document.body.innerHTML = `
    <header id="top" data-box="0,0,800,60">
      <a id="logo" data-box="10,10,140,40"><svg id="mark" data-box="10,10,40,40"></svg><span id="name" data-drawn data-box="60,10,90,40">Name</span></a>
      <i id="dot" data-drawn data-box="200,20,10,10"></i>
      <a id="x" data-box="300,20,16,16">x</a>
    </header>
    <p id="tip2" data-box="0,200,600,40"><span id="row" data-display="inline-flex" data-box="0,200,300,24"><span id="grp" data-display="flex" data-grouped data-box="40,200,70,24"><kbd id="k3" data-display="grid" data-drawn data-box="40,200,30,24">Shift</kbd><kbd id="k4" data-display="grid" data-drawn data-box="74,200,30,24">C</kbd></span></span></p>
    <p id="tip" data-box="0,80,600,40">Press <span id="keys" data-display="inline-flex" data-grouped data-box="40,90,70,22"><kbd id="k1" data-display="grid" data-drawn data-box="40,90,22,22">A</kbd><kbd id="k2" data-display="grid" data-drawn data-box="64,90,22,22">B</kbd></span> to start <img id="pic" data-display="inline" data-box="200,80,40,40"></p>
    <div id="hidden" aria-hidden="true" data-drawn data-box="0,140,400,40"><p id="hp" data-box="0,140,400,40">Hidden</p></div>`;
    expect(ids(blockTree(document.body, flowLook))).toEqual(["top", "logo", "x", "tip2", "tip", "pic"]);
  });

  it("leaves out what is clipped out of sight or takes no pointer, and keeps what the author marked", () => {
    document.body.innerHTML = `
    <div id="show" data-pipeup-id="show" data-clips data-drawn data-box="0,0,400,200">
      <div id="track" data-off data-grouped data-box="0,0,1200,200">
        <p id="s1" data-off data-box="0,0,400,200">One</p><p id="s2" data-off data-box="400,0,400,200">Two</p>
      </div>
    </div>
    <div id="win" data-clips data-drawn data-box="0,300,400,200">
      <p id="seen" data-box="0,300,400,100">Seen</p><p id="gone" data-box="500,300,400,100">Gone</p>
    </div>
    <span id="badge" data-pipeup-id="badge" data-display="inline" data-box="0,600,20,20">!</span>`;
    expect(ids(blockTree(document.body, flowLook))).toEqual(["show", "win", "seen", "badge"]);
  });

  it("keeps blocks inside plain inline wrappers, tall inline-block cards, and fixed boxes a clipper doesn't clip", () => {
    document.body.innerHTML = `
    <app-card id="host" data-display="inline" data-box="0,0,600,200">
      <div id="body" data-drawn data-box="0,0,600,200"><p id="hp" data-box="10,10,400,40">Inside a component</p></div>
    </app-card>
    <div id="cards" data-box="0,220,800,200">
      <div id="c1" data-display="inline-block" data-drawn data-box="0,220,200,160">Card</div>
      <code id="c2" data-display="inline" data-drawn data-box="220,220,200,80">wrapped code</code>
    </div>
    <footer id="foot" data-clips data-box="0,2000,800,100">
      <button id="fab" data-position="fixed" data-box="700,700,60,40">Feedback</button>
    </footer>`;
    expect(ids(blockTree(document.body, flowLook))).toEqual(["body", "hp", "c1", "foot", "fab"]);
  });
});

describe("row and childBlocks", () => {
  beforeEach(() => {
    document.body.innerHTML = `
    <section id="s" data-box="0,0,800,300">
      <h2 id="h" data-box="0,0,400,30">Heading</h2>
      <div id="card" data-drawn data-box="0,40,400,100"><p id="cp" data-box="10,50,300,20">One</p><p id="cq" data-box="10,80,300,20">Two</p></div>
      <li id="li" data-box="0,240,400,40"><a id="la" data-box="10,250,50,20">Link</a></li>
    </section>
    <p id="after" data-box="0,320,400,20">After</p>`;
  });

  it("covers the page at every level, each leaf exactly once", () => {
    const tree = blockTree(document.body, look);
    expect(ids(row(tree, 0))).toEqual(["h", "cp", "cq", "la", "after"]);
    expect(ids(row(tree, 1))).toEqual(["h", "card", "li", "after"]);
    expect(ids(row(tree, 2))).toEqual(["s", "after"]);
    for (const k of [0, 1, 2, 3]) {
      const covered = tree
        .filter((b) => b.level === 0)
        .map((leaf) => row(tree, k).filter((b) => b.el.contains(leaf.el)).length);
      expect(covered.every((n) => n === 1)).toBe(true);
    }
  });

  it("finds the blocks directly inside a block", () => {
    const tree = blockTree(document.body, look);
    expect(
      ids(
        childBlocks(
          tree,
          tree.find((b) => b.el.id === "s")!,
        ),
      ),
    ).toEqual(["h", "card", "li"]);
    expect(
      ids(
        childBlocks(
          tree,
          tree.find((b) => b.el.id === "cp")!,
        ),
      ),
    ).toEqual([]);
  });
});
