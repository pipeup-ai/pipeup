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

/** The reply says little the passage didn't already say: most of its content words are the passage's own. */
export function restates(reply: string, passage: string): boolean {
  const known = new Set(words(passage));
  const mine = words(reply);
  return mine.length > 0 && mine.filter((w) => known.has(w)).length / mine.length >= 0.4;
}

/** A passage of the page (or of a notes file) the model may use and the add-on can point at. */
export interface Passage {
  label: string;
  text: string;
  /** A notes file's heading link; page passages have none. */
  url?: string;
  el?: Element;
  slide?: string;
  /** What the first reading made of it (a gist and key facts): ranked on, never shown. */
  extra?: string;
  /** A short fingerprint of its words, so a section already read is not read again. */
  hash?: string;
}

/** Sections are read in parts this long, so each fits a small model. */
export const SECTION = 1500;

/** A short fingerprint of some text (FNV-1a), in base 36. */
export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Text cut into parts of at most `max` characters, at sentence ends where it can. Nothing is dropped. */
export function parts(text: string, max = SECTION): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const cut = rest.slice(0, max);
    const end = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("? "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf(" · "),
    );
    const at = end > max / 2 ? end + 1 : Math.max(cut.lastIndexOf(" "), max / 2);
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** The gist and facts a section was read as: "Gist: ...\nFacts: ...", leniently, at most 300 characters. */
export function gistOf(raw: string): string {
  return raw
    .replace(/[*_`#]+/g, "")
    .replace(/\b(gist|facts)\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * The sentence a model copied out of a section, when it really is in the section and says something (not NONE,
 * not longer than a sentence should be); else null. This is what stops a made-up "quote" becoming a reply.
 */
export function foundIn(section: string, answer: string): string | null {
  const first = answer
    .trim()
    .split(/\n/)[0]!
    .replace(/^\W*(sentence\s*:\s*)?["'“”]*/i, "")
    .replace(/["'“”]+$/, "")
    .trim();
  if (first.length < 12 || first.length > 300 || /^none\b/i.test(first)) return null;
  return norm(section).includes(norm(first)) ? first : null;
}

const STOP = new Set(
  "the and for are but not you all can had her was one our out has have this that with from they will would there their what about which when your into more than then them these some could other only over also just like been were being does did how why who its any may new each very much such those most should".split(
    " ",
  ),
);
/** A word without its common endings, so "churns", "churned" and "churning" meet. */
const stem = (w: string): string => (/^[a-z]{5,}$/.test(w) ? w.replace(/(ing|ed|es|s)$/, "") : w);
const words = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z]{3,}|[a-z]*\d[a-z0-9%]*/g) ?? []).filter((w) => !STOP.has(w)).map(stem);

/** The `n` passages that share the most (rarer) words with `query`, best first. Nothing in common: none. */
export function rank(passages: readonly Passage[], query: string, n = 8): Passage[] {
  const q = new Set(words(query));
  if (!q.size) return [];
  const docs = passages.map((p) => words(`${p.label} ${p.extra ?? ""} ${p.text}`));
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
        text,
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
