// @vitest-environment jsdom
import type { Comment, Thread } from "pipeup";
import { describe, expect, it } from "vitest";
import { askedAs, formatAnswer, parseAnswer, readAsk, tally, type Ask } from "../src/asks";

const ask = (attrs: Record<string, string>): Ask | string => {
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return readAsk(el);
};
const choice = ask({
  "data-pipeup-id": "q",
  "data-pipeup-ask": "One  journey\n or two?",
  "data-pipeup-ask-kind": "choice",
  "data-pipeup-ask-options": "One|Two",
  "data-pipeup-ask-other": "",
}) as Ask;
const agree = ask({
  "data-pipeup-id": "fr",
  "data-pipeup-ask": "Agree?",
  "data-pipeup-ask-kind": "agree",
}) as Ask;
const open = ask({
  "data-pipeup-id": "o",
  "data-pipeup-ask": "Name it?",
  "data-pipeup-ask-needed": "",
}) as Ask;

const comment = (author: string, text: string, at: number, more: Partial<Comment> = {}): Comment => ({
  id: `${author}-${at}`,
  author,
  name: author,
  text,
  at,
  edited: false,
  deleted: false,
  replies: [],
  reactions: [],
  ...more,
});
const thread = (id: string, root: Comment, snapshot = `Asked: ${choice.question}`): Thread => ({
  id: root.id,
  anchor: { id, path: "", fingerprint: "", snapshot },
  root,
  resolved: false,
});

describe("reading an ask", () => {
  it("takes its name, question, kind, options, Other and needed from the markup", () => {
    expect(choice).toEqual({
      id: "q",
      question: "One journey or two?",
      kind: "choice",
      options: ["One", "Two"],
      other: true,
      needed: false,
    });
    expect(agree).toMatchObject({ kind: "agree", options: ["Agree", "Needs change"], other: false });
    expect(open).toMatchObject({ kind: "open", options: [], needed: true });
    expect(
      ask({ "data-pipeup-id": "x", "data-pipeup-ask": "?", "data-pipeup-ask-kind": "nope" }),
    ).toMatchObject({
      kind: "open",
    });
  });

  it("says why an element can't be an ask", () => {
    expect(ask({ "data-pipeup-ask": "Why?" })).toMatch(/needs a data-pipeup-id/);
    expect(ask({ "data-pipeup-id": "x", "data-pipeup-ask": " " })).toMatch(/needs its question/);
    expect(
      ask({
        "data-pipeup-id": "x",
        "data-pipeup-ask": "?",
        "data-pipeup-ask-kind": "choice",
        "data-pipeup-ask-options": "A",
      }),
    ).toMatch(/two to six options/);
    expect(
      ask({
        "data-pipeup-id": "x",
        "data-pipeup-ask": "?",
        "data-pipeup-ask-kind": "choice",
        "data-pipeup-ask-options": "A|B|C|D|E|F|G",
      }),
    ).toMatch(/two to six options/);
  });
});

describe("an answer's words", () => {
  it("are written and read back for each kind", () => {
    const cases: [Ask, string, string, string][] = [
      [choice, "One", "", "One"],
      [choice, "Other", "Three, really", "Other: Three, really"],
      [agree, "Agree", "", "Agree"],
      [agree, "Agree", "but keep it short", "Agree: but keep it short"],
      [agree, "Needs change", "split it", "Needs change: split it"],
      [open, "", "Asks", "Asks"],
    ];
    for (const [a, c, w, text] of cases) {
      expect(formatAnswer(a, { choice: c, words: w })).toBe(text);
      expect(parseAnswer(a, text)).toEqual({ choice: c, words: w });
    }
  });

  it("aren't an answer when they don't fit the ask", () => {
    expect(parseAnswer(choice, "Three")).toBeNull();
    expect(parseAnswer(choice, "Other")).toBeNull();
    expect(parseAnswer(choice, "One: and more")).toBeNull();
    expect(parseAnswer(agree, "Needs change")).toBeNull();
    expect(parseAnswer(agree, "Needs change:  ")).toBeNull();
    expect(parseAnswer(agree, "Sure")).toBeNull();
    expect(parseAnswer(open, "  ")).toBeNull();
  });
});

describe("counting", () => {
  it("counts each person's latest answer once, others' and mine, with merged comments", () => {
    const threads = [
      thread("q", comment("ada", "Two", 1)),
      thread("q", comment("ada", "One", 5)),
      thread("q", comment("lee", "Other: both", 2)),
      thread("q", comment("me", "Two", 3, { replies: [comment("lee", "One", 4)] })),
      // A comment made in comment mode on the ask's block: shown with its threads, never counted.
      thread("q", comment("sam", "One", 6), "Is it one journey or two? Comment on this."),
      thread("other", comment("sam", "One", 7)),
    ];
    const t = tally(choice, threads, "me");
    expect(t.mine?.root.text).toBe("Two");
    expect([...t.counts]).toEqual([
      ["One", 1],
      ["Two", 1],
      ["Other", 1],
    ]);
    expect(t.answers).toHaveLength(3);
    expect(t.threads).toHaveLength(5);
    expect(tally(choice, threads, "nobody").mine).toBeNull();
  });

  it("never counts an agent's thread as an answer: one the page lists, or one under an AI name", () => {
    const threads = [
      thread("q", comment("bot", "One", 1)),
      thread("q", comment("k9", "One", 2, { name: "AI assistant" })),
      thread("q", comment("k8", "One", 3, { name: "AI assistant (Claude)" })),
      thread("q", comment("ada", "Two", 4)),
    ];
    const t = tally(choice, threads, "bot", ["bot"]);
    expect(t.mine).toBeNull();
    expect(t.answers.map((a) => a.thread.root.author)).toEqual(["ada"]);
    expect(t.counts.get("One")).toBe(0);
    // Still on the block, as comments.
    expect(t.threads).toHaveLength(4);
    // A key the page doesn't list, with a person's name, is a person.
    expect(tally(choice, threads, "me").answers).toHaveLength(2);
  });

  it("leaves out a deleted answer", () => {
    const t = tally(choice, [thread("q", comment("me", "One", 1, { deleted: true }))], "me");
    expect(t.mine).toBeNull();
  });

  it("says what an answer to earlier words answered", () => {
    expect(askedAs(choice, thread("q", comment("ada", "One", 1)))).toBeNull();
    expect(askedAs(choice, thread("q", comment("ada", "One", 1), "Asked: One flow or two?"))).toBe(
      "One flow or two?",
    );
  });
});
