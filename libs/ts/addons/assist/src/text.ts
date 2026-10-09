/** Everything the add-on checks about the model's words, and the document's words it hands the model. */
import type { Scenario } from "./prompts";

export const MAX_REPLY = 280;

const FIRST_WORD = /^\W*(ambiguity|related|tone|none)\b/i;
/** The model's one-word answer to "which kind of reply?", else none. */
export function scenarioOf(answer: string): Scenario | "none" {
  const m = FIRST_WORD.exec(answer.trim().replace(/^["'`]+/, ""));
  return (m?.[1]?.toLowerCase() as Scenario | "none" | undefined) ?? "none";
}

/** The passage numbers a "Used: 1, 2" line names. */
export function usedOf(raw: string): number[] {
  const m = /(?:^|\n)\s*used:\s*([\d,\s]+)/i.exec(raw);
  return m ? [...new Set((m[1] ?? "").match(/\d+/g)?.map(Number) ?? [])] : [];
}

/** The reply part of an answer: no "Reply:" lead, no "Used:" line, no formatting, plain spaces. */
export function replyPart(raw: string): string {
  return raw
    .split(/\n\s*used:/i)[0]!
    .replace(/^\s*(reply|answer)\s*:\s*/i, "")
    .replace(/^\s*[-*>\d.]+\s+/gm, "")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const REFUSALS = /^(as an ai|i'?m sorry|sorry|i apologi[sz]e|i cannot|i can'?t|none\b)/i;
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * A finished reply, or null when it shouldn't be posted: too long to cut cleanly, an apology or refusal, a repeat of
 * the comment, or a number the supplied text never mentioned (a cheap check against made-up facts).
 */
export function clean(raw: string, comment: string, supplied: string): string | null {
  let text = replyPart(raw);
  if (!text || REFUSALS.test(text)) return null;
  if (text.length > MAX_REPLY) {
    const cut = text.slice(0, MAX_REPLY);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    if (end < 40) return null;
    text = cut.slice(0, end + 1);
  }
  if (norm(text) === norm(comment)) return null;
  const known = norm(supplied);
  for (const n of text.match(/\d[\d.,]*\d|\d/g) ?? []) if (!known.includes(norm(n))) return null;
  return text;
}

/** A passage of the page (or of a notes file) the model may use and the add-on can point at. */
export interface Passage {
  label: string;
  text: string;
  /** A notes file's heading link; page passages have none. */
  url?: string;
  el?: Element;
  slide?: string;
}

const STOP = new Set(
  "the and for are but not you all can had her was one our out has have this that with from they will would there their what about which when your into more than then them these some could other only over also just like been were being does did how why who its any may new each very much such those most should".split(
    " ",
  ),
);
const words = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9%]{3,}/g) ?? []).filter((w) => !STOP.has(w));

/** The `n` passages that share the most (rarer) words with `query`, best first. Nothing in common: none. */
export function rank(passages: readonly Passage[], query: string, n = 3): Passage[] {
  const q = new Set(words(query));
  if (!q.size) return [];
  const docs = passages.map((p) => words(`${p.label} ${p.text}`));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const scored = passages.map((p, i) => {
    const tf = new Map<string, number>();
    for (const w of docs[i]!) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of q) {
      const f = tf.get(w);
      if (f) score += (f / (f + 1.2)) * Math.log(1 + passages.length / (df.get(w) ?? 1));
    }
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.p);
}

/** A markdown file's sections: its headings with the text under them, linkable. */
export function sections(markdown: string, file: string, base: string): Passage[] {
  const out: Passage[] = [];
  let head = "";
  let body: string[] = [];
  const flush = () => {
    const text = body.join(" ").replace(/\s+/g, " ").trim();
    if (head && text)
      out.push({
        label: `${file} › ${head}`,
        text: text.slice(0, 400),
        url: `${base}#${head
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .trim()
          .replace(/\s+/g, "-")}`,
      });
  };
  for (const line of markdown.split("\n")) {
    const h = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (h) {
      flush();
      head = h[1]!;
      body = [];
    } else body.push(line.replace(/[`*_>#-]+/g, " "));
  }
  flush();
  return out;
}
