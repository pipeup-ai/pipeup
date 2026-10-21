import { describe, expect, it } from "vitest";
import { PipeupDocument } from "../src/document";
import { loadOrCreateProfile, MemoryStore } from "../src/storage/store";
import { agentName, isPasted } from "../src/model/animals";
import { checkOp } from "../src/model/ops";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

async function reviewer(name: string) {
  const store = new MemoryStore();
  const profile = await loadOrCreateProfile(store, name);
  return PipeupDocument.open({ doc: "doc", key: null, store, identity: profile.identity, name });
}

describe("an agent's reply the reviewer pasted", () => {
  it("is written by the reviewer under the agent's name, and can mark the thread addressed", async () => {
    const sam = await reviewer("Sam");
    const t = await sam.comment(ANCHOR, "Put the rates chart first");
    await sam.paste(t, "Muse", "Moved it to the top of Markets", "Moved in today's edition");
    const [thread] = sam.threads();
    const reply = thread!.root.replies[0]!;
    expect(reply).toMatchObject({
      author: sam.me,
      name: "AI assistant · Muse",
      text: "Moved it to the top of Markets",
    });
    expect(thread!.addressed).toMatchObject({ author: sam.me, text: "Moved in today's edition" });
    expect(thread!.resolved).toBe(false);
    // Signed by Sam, so anyone can check who put it there.
    for (const op of sam.ops()) expect(await checkOp(op)).toBe(true);
    // Sam's own comments keep Sam's name.
    expect(thread!.root.name).toBe("Sam");
  });

  it("doesn't rename a reviewer who hasn't added a name: their comments keep their animal", async () => {
    const lee = await reviewer("");
    const t = await lee.comment(ANCHOR, "x");
    await lee.paste(t, "Muse", "Done.");
    const [thread] = lee.threads();
    expect(thread!.root.name).toBe("");
    expect(thread!.root.replies[0]!.name).toBe("AI assistant · Muse");
  });

  it("needs words and a thread that's here", async () => {
    const sam = await reviewer("Sam");
    const t = await sam.comment(ANCHOR, "x");
    await expect(sam.paste(t, "Muse", "  ")).rejects.toThrow(/needs some words/);
    await expect(sam.paste("T".repeat(43), "Muse", "hi")).rejects.toThrow(/no thread/);
  });
});

describe("pasted, or the agent's own", () => {
  const listed = ["L".repeat(43)];
  it("is pasted when named for an agent but written by a key the page doesn't list", () => {
    expect(isPasted({ author: "S".repeat(43), name: "AI assistant · Muse" }, listed)).toBe(true);
    expect(isPasted({ author: listed[0]!, name: "AI assistant · Muse" }, listed)).toBe(false);
  });
  it("leaves people's comments and the on-device assistant alone", () => {
    expect(isPasted({ author: "S".repeat(43), name: "Sam" }, listed)).toBe(false);
    expect(isPasted({ author: "S".repeat(43), name: "AI assistant (on this device)" }, listed)).toBe(false);
  });
  it("names an agent on one line, and calls a nameless one Agent", () => {
    expect(agentName(" Muse\n bot ")).toBe("AI assistant · Muse bot");
    expect(agentName("")).toBe("AI assistant · Agent");
  });
});

describe("checking a change", () => {
  it("refuses one whose words were changed after it was signed, and one that isn't a change", async () => {
    const sam = await reviewer("Sam");
    await sam.comment(ANCHOR, "x");
    const op = sam.ops()[0]!;
    expect(await checkOp(op)).toBe(true);
    expect(await checkOp({ ...op, body: { ...op.body, text: "y" } })).toBe(false);
    expect(await checkOp({ nope: 1 })).toBe(false);
  });
});
