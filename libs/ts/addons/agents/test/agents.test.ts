// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddonHost, SignedOp, Thread } from "pipeup";
import { startLink } from "../src/link";
import { agentPrompt } from "../src/prompt";
import { listedAgents, repliesUrl, startReplies } from "../src/replies";

const A = "A".repeat(43);
const B = "B".repeat(43);
const id = (n: string) => n.padEnd(43, "_");

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

  it("points an agent at the link's commands when a link is running", () => {
    expect(agentPrompt({ ...meta, file: "/a/brief.html" })).toContain("npx pipeup comments /a/brief.html");
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

const op = (kind: string, author: string, name: string, thread = id("t1")): SignedOp =>
  ({
    sig: "",
    body: {
      v: 1,
      id: id(`o${Math.random()}`),
      kind,
      doc: "d",
      thread,
      author,
      name,
      clock: 1,
      at: 1,
      text: "x",
    },
  }) as unknown as SignedOp;

const fakeHost = (merged: SignedOp[][]) =>
  ({
    document: { id: "d", ops: () => [], threads: () => [] },
    merge: async (ops: SignedOp[]) => (merged.push(ops), ops.length),
    overlay: () => document.createElement("div"),
  }) as unknown as AddonHost;

describe("the replies the page takes", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-pipeup-agents");
    delete (globalThis as Record<string, unknown>).pipeupReplies;
  });

  it("keeps replies and addressed notes from listed agents, counts the rest, and learns the agent's name", async () => {
    document.documentElement.setAttribute("data-pipeup-agents", A);
    (globalThis as Record<string, unknown>).pipeupReplies = [
      {
        format: "pipeup-replies",
        doc: "d",
        ops: [
          op("reply", A, "AI assistant · Claude"),
          op("addressed", A, "AI assistant · Claude"),
          op("reply", B, "AI assistant · Sneaky"),
          op("react", A, "AI assistant · Claude"),
          op("resolve", A, "AI assistant · Claude"),
        ],
      },
      { format: "pipeup-replies", doc: "another-doc", ops: [op("reply", A, "AI assistant · Claude")] },
    ];
    const merged: SignedOp[][] = [];
    const replies = startReplies(fakeHost(merged));
    // A listed agent is looked for at once; the queue is drained by the first look.
    await vi.waitFor(() => expect(merged.length).toBe(1));
    expect(merged[0]!.map((o) => o.body.kind)).toEqual(["reply", "addressed", "react"]);
    expect(replies.ignored()).toBe(2);
    expect(replies.who()).toBe("Claude");
    replies.destroy();
  });

  it("does nothing, and looks for nothing, when no agent is listed", async () => {
    const replies = startReplies(fakeHost([]));
    expect(replies.enabled).toBe(false);
    expect(await replies.check()).toBe(0);
    replies.destroy();
  });

  it("tallies the threads an agent answered and its replies for threads this page doesn't have", () => {
    document.documentElement.setAttribute("data-pipeup-agents", A);
    const host = {
      ...fakeHost([]),
      document: {
        id: "d",
        threads: () => [],
        ops: () => [op("reply", A, "AI assistant · Claude", id("gone"))],
      },
    } as unknown as AddonHost;
    const replies = startReplies(host);
    const t = (idv: string, byAgent: boolean, over = {}): Thread =>
      ({
        id: idv,
        resolved: false,
        root: { replies: byAgent ? [{ author: A }] : [] },
        ...over,
      }) as unknown as Thread;
    const tally = replies.tally([
      t("a", true, { addressed: { text: "ok" } }),
      t("b", false),
      t("c", true, { resolved: true }),
    ]);
    expect(tally).toEqual({ open: 2, answered: 1, addressed: 1, stray: 1 });
    replies.destroy();
  });
});

describe("the live link", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-pipeup-link");
    vi.unstubAllGlobals();
  });

  it("is absent unless the page is shown through a link, and then sends nothing until switched on", async () => {
    const off = startLink({ snapshot: async () => ({}), changes: () => () => {}, refresh() {} });
    expect(off.enabled).toBe(false);
    document.documentElement.setAttribute("data-pipeup-link", "/__pipeup/abcdefghijklmnop");
    const fetched: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => (fetched.push(url), { ok: true }));
    const link = startLink({ snapshot: async () => ({ v: 1 }), changes: () => () => {}, refresh() {} });
    expect(link.enabled).toBe(true);
    expect(link.on()).toBe(false);
    expect(fetched).toEqual([]);
    await link.set(true);
    expect(fetched).toEqual(["/__pipeup/abcdefghijklmnop/comments"]);
    expect(link.on()).toBe(true);
    await link.set(false);
    expect(link.on()).toBe(false);
  });

  it("says in words when the link can't be reached, and stays off", async () => {
    document.documentElement.setAttribute("data-pipeup-link", "/__pipeup/abcdefghijklmnop");
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    const link = startLink({ snapshot: async () => ({}), changes: () => () => {}, refresh() {} });
    await expect(link.set(true)).rejects.toThrow(/isn't reachable/);
    expect(link.on()).toBe(false);
  });

  it("ignores an address that isn't a link's", () => {
    document.documentElement.setAttribute(
      "data-pipeup-link",
      "https://elsewhere.test/__pipeup/abcdefghijklmnop",
    );
    expect(startLink({ snapshot: async () => ({}), changes: () => () => {}, refresh() {} }).enabled).toBe(
      false,
    );
  });
});
