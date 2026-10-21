import { describe, expect, it } from "vitest";
import {
  checkOp,
  computeOpId,
  createIdentity,
  signOp,
  type Identity,
  type OpBody,
  type Thread,
} from "pipeup";
import { describe as say, readBlocks, sortEntries } from "../src/paste";

const T1 = "1".repeat(43);
const T2 = "2".repeat(43);
const GONE = "9".repeat(43);
const threads = [{ id: T1 }, { id: T2 }] as unknown as Thread[];

/** What `pipeup reply --print` puts on its signed: line. */
async function signed(who: Identity, thread: string, reply: string, note = "", doc = "doc"): Promise<string> {
  let clock = 1;
  const make = async (fields: Partial<OpBody>) => {
    const body = {
      v: 1,
      id: "",
      doc,
      thread,
      author: who.publicKey,
      name: "AI assistant · Muse",
      clock: clock++,
      at: clock,
      ...fields,
    } as OpBody;
    body.id = await computeOpId(body);
    return signOp(body, who);
  };
  const ops = [await make({ kind: "reply", target: thread, text: reply })];
  if (note) ops.push(await make({ kind: "addressed", text: note }));
  return Buffer.from(JSON.stringify(ops)).toString("base64url");
}

describe("reading replies blocks", () => {
  it("finds every block in a chat message, with each entry's agent, words and note", () => {
    const pasted = [
      "I've moved the chart. Paste this:",
      "```pipeup-replies",
      "agent: Muse",
      `thread: ${T1}`,
      "reply: Moved the rates chart",
      "  to the top of Markets.",
      "addressed: Moved in today's edition",
      "",
      `thread: ${T2}`,
      "reply: Year on year.",
      "```",
      "And another:",
      "```pipeup-replies",
      `thread: ${GONE}`,
      "reply: For a comment that's gone",
      "```",
    ].join("\r\n");
    expect(readBlocks(pasted)).toEqual([
      {
        agent: "Muse",
        thread: T1,
        reply: "Moved the rates chart\nto the top of Markets.",
        addressed: "Moved in today's edition",
        signed: "",
      },
      { agent: "Muse", thread: T2, reply: "Year on year.", addressed: "", signed: "" },
      { agent: "Agent", thread: GONE, reply: "For a comment that's gone", addressed: "", signed: "" },
    ]);
  });

  it("finds nothing in an answer without a block, or an entry without words", () => {
    expect(readBlocks("Sure! 1. The rates chart…")).toEqual([]);
    expect(readBlocks(`\`\`\`pipeup-replies\nthread: ${T1}\n\`\`\``)).toEqual([]);
  });
});

describe("sorting pasted replies", () => {
  it("counts a listed agent's signed reply as its own, and says why others show as pasted", async () => {
    const muse = await createIdentity();
    const other = await createIdentity();
    const good = await signed(muse, T1, "Moved the rates chart.", "Moved");
    const block = (thread: string, reply: string, sig: string, note = "") =>
      `thread: ${thread}\nreply: ${reply}\n${note ? `addressed: ${note}\n` : ""}${sig ? `signed: ${sig}\n` : ""}`;
    const pasted = [
      "```pipeup-replies",
      "agent: Muse",
      block(T1, "Moved the rates chart.", good, "Moved"),
      block(T1, "Moved the rates chart, and more.", good, "Moved"),
      block(T2, "Year on year.", await signed(other, T2, "Year on year.")),
      block(T2, "Year on year.", await signed(muse, T2, "Year on year.", "", "another-doc")),
      block(T2, "Unsigned.", ""),
      block(GONE, "Gone.", ""),
      "```",
    ].join("\n");
    const sorted = await sortEntries(readBlocks(pasted), {
      doc: "doc",
      threads,
      listed: [muse.publicKey],
      check: checkOp,
    });
    expect(sorted.map((s) => (s.kind === "unsigned" ? `unsigned:${s.why}` : s.kind))).toEqual([
      "signed",
      "unsigned:changed",
      "unsigned:unlisted",
      "unsigned:changed",
      "unsigned:none",
      "gone",
    ]);
    const { lines, adds } = say(sorted);
    expect(adds).toBe(5);
    expect(lines).toEqual([
      "1 reply signed by Muse, whom this page lists",
      "1 reply from Muse is not signed, so it will show as pasted by you",
      "2 replies from Muse were changed after they were signed, so they will show as pasted by you",
      "1 reply from Muse is signed with a key this page doesn't list, so it will show as pasted by you",
      "2 of them say the comment is addressed",
      "1 reply is for a comment that's no longer here, so it will be left out",
    ]);
  });
});
