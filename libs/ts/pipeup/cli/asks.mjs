// The asks a page puts in its content (spec §11b, the inline add-on), with each reviewer's latest answer, for
// `pipeup read`. Read from the page's markup and the comments, as the add-on reads them: an answer is a comment on the
// ask's block, kept with the question it answered ("Asked: …"), whose words fit the ask's kind.

const ASKED = "Asked: ";
const AGREE = "Agree";
const CHANGE = "Needs change";
const OTHER = "Other";

const unescape = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** A tag's attributes, by name (lower case); a bare attribute is "". */
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/\s([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))
    out[m[1].toLowerCase()] = unescape(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

/** The page's asks, in page order: { id, question, kind, options, other, needed }. */
export function asksIn(html) {
  const asks = [];
  for (const m of html.matchAll(/<[a-z][a-z0-9-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const a = attrs(m[0]);
    if (!("data-pipeup-ask" in a)) continue;
    const id = a["data-pipeup-id"] ?? "";
    const question = a["data-pipeup-ask"].replace(/\s+/g, " ").trim();
    if (!id || !question) continue;
    const given = a["data-pipeup-ask-kind"];
    const kind = given === "agree" || given === "choice" ? given : "open";
    const options =
      kind === "agree"
        ? [AGREE, CHANGE]
        : kind === "choice"
          ? [
              ...new Set(
                (a["data-pipeup-ask-options"] ?? "")
                  .split("|")
                  .map((o) => o.trim())
                  .filter(Boolean),
              ),
            ]
          : [];
    if (kind === "choice" && (options.length < 2 || options.length > 6)) continue;
    asks.push({
      id,
      question,
      kind,
      options,
      other: kind === "choice" && "data-pipeup-ask-other" in a,
      needed: "data-pipeup-ask-needed" in a,
    });
  }
  return asks;
}

/** A comment's words as an answer to `ask` ({ choice, words }), or null. */
export function parseAnswer(ask, text) {
  const t = text.trim();
  if (!t) return null;
  if (ask.kind === "open") return { choice: "", words: t };
  for (const choice of [...ask.options, ...(ask.other ? [OTHER] : [])]) {
    if (t === choice && choice !== CHANGE && choice !== OTHER) return { choice, words: "" };
    if ((ask.kind === "agree" || choice === OTHER) && t.startsWith(`${choice}:`)) {
      const words = t.slice(choice.length + 1).trim();
      if (words || choice === AGREE) return { choice, words };
    }
  }
  return null;
}

/** Pipeup's name for AI writers: "AI assistant", or that and more words. */
const AI_NAME = "AI assistant";

/**
 * Each ask with every reviewer's latest answer (and the question it answered, when the words have changed since).
 * Agents never answer asks: a thread there by an agent the page lists (`agents`), or under an AI name, isn't counted.
 */
export function asksWithAnswers(html, threads, agents = []) {
  return asksIn(html).map((ask) => {
    const latest = new Map();
    for (const t of [...threads].sort((a, b) => a.root.at - b.root.at)) {
      if (t.anchor.id !== ask.id || t.root.deleted || !t.anchor.snapshot?.startsWith(ASKED)) continue;
      const name = t.root.name ?? "";
      if (agents.includes(t.root.author) || name === AI_NAME || name.startsWith(`${AI_NAME} `)) continue;
      const answer = parseAnswer(ask, t.root.text);
      if (!answer) continue;
      const was = t.anchor.snapshot.slice(ASKED.length);
      latest.set(t.root.author, {
        thread: t.id,
        name: t.root.name,
        author: t.root.author,
        ...answer,
        text: t.root.text,
        at: new Date(t.root.at).toISOString(),
        edited: t.root.edited,
        replies: t.root.replies.length,
        ...(was && was !== ask.question.slice(0, was.length) ? { askedAs: was } : {}),
      });
    }
    return { ...ask, answers: [...latest.values()] };
  });
}

/** The asks as Markdown, after the comments: each question, its kind, and who answered what. */
export function asksMarkdown(asks, nameOf) {
  if (!asks.length) return "";
  const lines = ["", "## Asks", ""];
  for (const a of asks) {
    const kind =
      a.kind === "choice"
        ? `choice: ${[...a.options, ...(a.other ? [OTHER] : [])].join(", ")}`
        : a.kind === "agree"
          ? "agree or needs change"
          : "open";
    lines.push(`### "${a.question}"`, "", `- Name: \`${a.id}\` · ${kind}${a.needed ? " · needed" : ""}`);
    if (!a.answers.length) lines.push("- No answers yet.");
    for (const r of a.answers)
      lines.push(
        `- ${r.name || nameOf(r.author)}: ${r.text.split("\n")[0]}${r.edited ? " (changed)" : ""}${r.askedAs ? ` (asked as: "${r.askedAs}")` : ""} — thread ${r.thread}`,
      );
    lines.push("");
  }
  return lines.join("\n");
}
