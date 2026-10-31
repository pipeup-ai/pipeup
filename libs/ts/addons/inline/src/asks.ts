import type { Comment, Thread } from "pipeup";

export type Kind = "open" | "agree" | "choice";

/** An ask the author put in the content: its name is the block's data-pipeup-id. */
export interface Ask {
  id: string;
  question: string;
  kind: Kind;
  /** choice: the author's options; agree: Agree and Needs change. */
  options: string[];
  /** choice: Other, which asks for words. */
  other: boolean;
  /** The author needs it answered: it counts in the menu. */
  needed: boolean;
}

export const AGREE = "Agree";
export const CHANGE = "Needs change";
export const OTHER = "Other";
/** How an answer's thread keeps the question it answered (its excerpt): an ask's answers start with it. */
export const ASKED = "Asked: ";

/** The ask an element describes, or why it can't be one (said once, in the console). */
export function readAsk(el: Element): Ask | string {
  const id = el.getAttribute("data-pipeup-id") ?? "";
  const question = (el.getAttribute("data-pipeup-ask") ?? "").replace(/\s+/g, " ").trim();
  const at = `<${el.localName}${id ? ` data-pipeup-id="${id}"` : ""}>`;
  if (!id) return `the ask ${at} needs a data-pipeup-id, its name`;
  if (!question) return `the ask ${at} needs its question in data-pipeup-ask`;
  const given = el.getAttribute("data-pipeup-ask-kind") ?? "open";
  const kind: Kind = given === "agree" || given === "choice" ? given : "open";
  let options: string[] = [];
  if (kind === "agree") options = [AGREE, CHANGE];
  if (kind === "choice") {
    options = [
      ...new Set(
        (el.getAttribute("data-pipeup-ask-options") ?? "")
          .split("|")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    ];
    if (options.length < 2 || options.length > 6)
      return `the ask ${at} needs two to six options in data-pipeup-ask-options, separated by |`;
  }
  return {
    id,
    question,
    kind,
    options,
    other: kind === "choice" && el.hasAttribute("data-pipeup-ask-other"),
    needed: el.hasAttribute("data-pipeup-ask-needed"),
  };
}

/** What an answer says: the option chosen ("" for an open ask) and the reviewer's words. */
export interface Answer {
  choice: string;
  words: string;
}

/** The first line of an answer, as a comment's words: `One`, `Other: words`, `Agree`, `Agree: words`, `Needs change: words`. */
export function formatAnswer(ask: Ask, a: Answer): string {
  const words = a.words.trim();
  if (ask.kind === "open") return words;
  if (ask.kind === "choice" && a.choice !== OTHER) return a.choice;
  return words ? `${a.choice}: ${words}` : a.choice;
}

/** Reads a comment's words as an answer to `ask`, or null when they aren't one. */
export function parseAnswer(ask: Ask, text: string): Answer | null {
  const t = text.trim();
  if (!t) return null;
  if (ask.kind === "open") return { choice: "", words: t };
  const named = [...ask.options, ...(ask.other ? [OTHER] : [])];
  for (const choice of named) {
    // Needs change and Other always carry words; an option the author named is its words alone.
    if (t === choice && choice !== CHANGE && choice !== OTHER) return { choice, words: "" };
    if ((ask.kind === "agree" || choice === OTHER) && t.startsWith(`${choice}:`)) {
      const words = t.slice(choice.length + 1).trim();
      if (words || choice === AGREE) return { choice, words };
    }
  }
  return null;
}

/** Pipeup's name for AI writers (an agent's, or an on-device assistant's): "AI assistant", or that and more words. */
const AI_NAME = "AI assistant";

/** An agent wrote it: one the page lists (`data-pipeup-agents`), or a writer under an AI name. Agents never answer asks. */
export const byAgent = (c: Comment, agents: readonly string[]): boolean =>
  agents.includes(c.author) || c.name === AI_NAME || c.name.startsWith(`${AI_NAME} `);

/**
 * A thread is an answer to `ask`: on its block, kept with the question it answered, its words read as one, and
 * written by a person (an agent's thread there stays a comment, never counted).
 */
export function answerOf(ask: Ask, t: Thread, agents: readonly string[] = []): Answer | null {
  if (
    t.anchor.id !== ask.id ||
    !t.anchor.snapshot.startsWith(ASKED) ||
    t.root.deleted ||
    byAgent(t.root, agents)
  )
    return null;
  return parseAnswer(ask, t.root.text);
}

/** The question an answer was given to, when the ask's words have changed since ("Asked as: …"); else null. */
export function askedAs(ask: Ask, t: Thread): string | null {
  const was = t.anchor.snapshot.slice(ASKED.length);
  return was && was !== ask.question.slice(0, was.length) ? was : null;
}

export interface Tally {
  /** This reviewer's answer, if any: the latest they gave. */
  mine: Thread | null;
  /** Each person's latest answer. */
  answers: { thread: Thread; answer: Answer }[];
  /** How many chose each option (agree: Agree and Needs change), in the ask's order. */
  counts: Map<string, number>;
  /** The threads on the ask's block, answers or not, oldest first. */
  threads: Thread[];
}

/** The ask's answers: each person's latest counts once; replies under an answer are conversation, not answers, and agents' threads are not answers. */
export function tally(
  ask: Ask,
  threads: readonly Thread[],
  me: string,
  agents: readonly string[] = [],
): Tally {
  const on = threads.filter((t) => t.anchor.id === ask.id).sort((a, b) => a.root.at - b.root.at);
  const latest = new Map<string, { thread: Thread; answer: Answer }>();
  for (const thread of on) {
    const answer = answerOf(ask, thread, agents);
    if (answer) latest.set(thread.root.author, { thread, answer });
  }
  const counts = new Map<string, number>();
  for (const o of [...ask.options, ...(ask.other ? [OTHER] : [])]) counts.set(o, 0);
  for (const { answer } of latest.values())
    if (counts.has(answer.choice)) counts.set(answer.choice, counts.get(answer.choice)! + 1);
  return {
    mine: latest.get(me)?.thread ?? null,
    answers: [...latest.values()],
    counts,
    threads: on,
  };
}

/** Everyone who wrote in a thread, latest last. */
export function latestIn(t: Thread): Comment {
  let last = t.root;
  const walk = (c: Comment) => {
    if (!c.deleted && c.at >= last.at) last = c;
    c.replies.forEach(walk);
  };
  t.root.replies.forEach(walk);
  return last;
}
