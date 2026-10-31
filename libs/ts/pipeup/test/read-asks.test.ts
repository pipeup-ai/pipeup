import { describe, expect, it } from "vitest";
import { asksIn, asksMarkdown, asksWithAnswers } from "../cli/asks.mjs";
import type { Comment, Thread } from "../src/model/types";

const PAGE = `<main>
  <div data-pipeup-id="q-journeys" data-pipeup-ask="Is &ldquo;Go through every comment&rdquo; one journey or two?"
       data-pipeup-ask-kind="choice" data-pipeup-ask-options="One|Two" data-pipeup-ask-other data-pipeup-ask-needed>
    <p>Fallback</p>
  </div>
  <section data-pipeup-id='FR-012' data-pipeup-ask='Agree with this requirement?' data-pipeup-ask-kind=agree></section>
  <div data-pipeup-ask="No name"></div>
  <figure data-pipeup-id="hero" data-pipeup-inline></figure>
</main>`;

const comment = (author: string, name: string, text: string, at: number, edited = false): Comment => ({
  id: `${author}-${at}`,
  author,
  name,
  text,
  at,
  edited,
  deleted: false,
  replies: [],
  reactions: [],
});
const thread = (id: string, root: Comment, snapshot: string): Thread => ({
  id: root.id,
  anchor: { id, path: "", fingerprint: "", snapshot },
  root,
  resolved: false,
});

describe("pipeup read's asks", () => {
  it("are read from the page's markup, named ones only", () => {
    expect(asksIn(PAGE)).toEqual([
      {
        id: "q-journeys",
        question: "Is &ldquo;Go through every comment&rdquo; one journey or two?",
        kind: "choice",
        options: ["One", "Two"],
        other: true,
        needed: true,
      },
      {
        id: "FR-012",
        question: "Agree with this requirement?",
        kind: "agree",
        options: ["Agree", "Needs change"],
        other: false,
        needed: false,
      },
    ]);
  });

  it("list each reviewer's latest answer, and say when it answered earlier words", () => {
    const html = PAGE.replace("&ldquo;", "“").replace("&rdquo;", "”");
    const q = "Asked: Is “Go through every comment” one journey or two?";
    const asks = asksWithAnswers(html, [
      thread("q-journeys", comment("k1", "Ada", "Two", 1), q),
      thread("q-journeys", comment("k1", "Ada", "One", 3, true), q),
      thread("q-journeys", comment("k2", "Sam", "Other: both", 2), "Asked: One flow or two?"),
      thread("q-journeys", comment("k3", "Lee", "Not an answer", 4), q),
      thread("q-journeys", comment("k4", "Lee", "One", 5), "Fallback"),
      thread(
        "FR-012",
        comment("k2", "Sam", "Agree: keep it short", 6),
        "Asked: Agree with this requirement?",
      ),
    ]);
    expect(asks[0]!.answers.map((a) => [a.name, a.choice, a.words, a.askedAs ?? null])).toEqual([
      ["Ada", "One", "", null],
      ["Sam", "Other", "both", "One flow or two?"],
    ]);
    expect(asks[1]!.answers.map((a) => a.text)).toEqual(["Agree: keep it short"]);
    const md = asksMarkdown(asks, () => "Someone");
    expect(md).toContain('### "Is “Go through every comment” one journey or two?"');
    expect(md).toContain("- Name: `q-journeys` · choice: One, Two, Other · needed");
    expect(md).toContain("- Ada: One (changed) — thread k1-3");
    expect(md).toContain('- Sam: Other: both (asked as: "One flow or two?") — thread k2-2');
    expect(md).toContain("- Name: `FR-012` · agree or needs change");
    expect(asksMarkdown([], () => "")).toBe("");
  });
});
