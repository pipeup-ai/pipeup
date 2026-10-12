// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { copyAll, type ExportItem } from "../src/export/format";
import { agentPrompt } from "../src/export/prompt";
import { foldThreads } from "../src/model/fold";
import { isWellFormed } from "../src/model/ops";
import type { OpBody, SignedOp } from "../src/model/types";
import { listedAgents, repliesUrl } from "../src/ui/replies";

const A = "A".repeat(43);
const B = "B".repeat(43);
const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };
const id = (n: string) => n.padEnd(43, "_");
let clock = 0;

function op(kind: OpBody["kind"], over: Partial<OpBody>): SignedOp {
  clock += 1;
  return {
    sig: "",
    body: {
      v: 1,
      id: id(`op${clock}`),
      kind,
      doc: "d",
      thread: id("t1"),
      author: A,
      name: "Amy",
      clock,
      at: clock,
      ...over,
    },
  };
}
const create = () => op("create", { id: id("t1"), thread: id("t1"), text: "root", anchor: ANCHOR });
const addressed = (text = "addressed in r2") =>
  op("addressed", { author: B, name: "AI assistant · Claude", text });

describe("addressed", () => {
  it("is a note on an open thread, not a resolve", () => {
    const [t] = foldThreads([create(), addressed()]);
    expect(t?.resolved).toBe(false);
    expect(t?.addressed).toMatchObject({ text: "addressed in r2", name: "AI assistant · Claude" });
  });

  it("is cleared when a person reopens the thread", () => {
    const [t] = foldThreads([create(), addressed(), op("resolve", {}), op("reopen", {})]);
    expect(t?.resolved).toBe(false);
    expect(t?.addressed).toBeUndefined();
  });

  it("needs words, and is ignored for a thread that isn't there", () => {
    expect(isWellFormed(addressed())).toBe(true);
    expect(isWellFormed({ ...addressed(), body: { ...addressed().body, text: undefined } })).toBe(false);
    expect(foldThreads([addressed()])).toEqual([]);
  });
});

describe("copy for AI with addressed threads", () => {
  const item = (over = {}): ExportItem => {
    const [thread] = foldThreads([create(), addressed()]);
    return { thread: { ...thread!, ...over }, location: { where: "Intro" } as ExportItem["location"] };
  };
  const meta = { title: "T", url: "u", exportedAt: new Date(5) };

  it("says a thread is addressed, with the note, and tells the agent never to resolve", () => {
    const md = copyAll([item()], "ai", meta);
    expect(md).toContain("· open, addressed");
    expect(md).toContain("- **Addressed:** addressed in r2 (AI assistant · Claude");
    expect(md).toContain("never resolve it");
  });

  it("can include resolved threads when asked", () => {
    const done = item({ resolved: true });
    expect(copyAll([done], "ai", meta)).toContain("**Open threads:** 0");
    expect(copyAll([done], "ai", { ...meta, all: true })).toContain("· resolved");
  });
});

describe("the prompt for an agent", () => {
  const meta = {
    title: "Brief",
    url: "file:///a/brief.html",
    replies: "file:///a/brief.replies.js",
    listed: true,
  };

  it("says where to read, where to answer and what never to do", () => {
    const p = agentPrompt(meta);
    expect(p).toContain("Pipeup.comments()");
    expect(p).toContain("brief.replies.js");
    expect(p).toContain("Never resolve, reopen, edit or delete");
  });

  it("tells an agent whose key isn't listed how to get it listed, and carries no key", () => {
    const p = agentPrompt({ ...meta, listed: false });
    expect(p).toContain("pipeup agent");
    expect(p).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});

describe("a page's list of agents and its replies file", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-pipeup-agents");
    document.documentElement.removeAttribute("data-pipeup-replies");
  });

  it("lists public keys only, once each", () => {
    document.documentElement.setAttribute("data-pipeup-agents", `${A}, nonsense ${A} ${B}`);
    expect(listedAgents()).toEqual([A, B]);
  });

  it("finds no agents when the attribute is absent", () => {
    expect(listedAgents()).toEqual([]);
  });

  it("reads only a file on this site", () => {
    document.documentElement.setAttribute("data-pipeup-replies", "https://elsewhere.test/r.js");
    expect(repliesUrl()).toBeNull();
    document.documentElement.setAttribute("data-pipeup-replies", "notes.replies.js");
    expect(repliesUrl()).toMatch(/notes\.replies\.js$/);
  });
});
