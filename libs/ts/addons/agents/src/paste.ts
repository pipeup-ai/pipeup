import type { SignedOp, Thread } from "pipeup";

/** One reply an agent gave in a replies block. */
export interface Entry {
  agent: string;
  thread: string;
  reply: string;
  addressed: string;
  /** The agent's own signed ops for this entry, as `pipeup reply --print` writes them; "" when unsigned. */
  signed: string;
}

/** Why a pasted reply can't count as the agent's own. */
export type Unsigned = "none" | "unlisted" | "changed";

export type Sorted =
  | { kind: "signed"; entry: Entry; ops: SignedOp[]; author: string }
  | { kind: "unsigned"; entry: Entry; why: Unsigned }
  | { kind: "gone"; entry: Entry };

const FENCE = /```[ \t]*pipeup-replies[^\n]*\n([\s\S]*?)(?:\n[ \t]*```|$)/g;
const FIELD = /^[ \t]*(agent|thread|reply|addressed|signed)[ \t]*:[ \t]?(.*)$/i;
const DEFAULT_AGENT = "Agent";

/** Reads every replies block in what was pasted. Text outside the blocks is ignored. */
export function readBlocks(pasted: string): Entry[] {
  const out: Entry[] = [];
  for (const [, block] of pasted.replace(/\r\n?/g, "\n").matchAll(FENCE)) {
    let agent = DEFAULT_AGENT;
    let at: Entry | null = null;
    let field: keyof Entry | null = null;
    for (const line of block!.split("\n")) {
      const m = FIELD.exec(line);
      if (m) {
        const key = m[1]!.toLowerCase() as keyof Entry;
        const value = m[2]!.trim();
        if (key === "agent") {
          agent = value || DEFAULT_AGENT;
          field = null;
        } else if (key === "thread") {
          at = { agent, thread: value, reply: "", addressed: "", signed: "" };
          out.push(at);
          field = null;
        } else if (at) {
          at[key] = value;
          field = key;
        }
      } else if (at && field && field !== "signed" && line.trim()) {
        // A line that isn't a field carries on the one above it.
        at[field] = `${at[field]}\n${line.trim()}`;
      } else if (at && field === "signed") at.signed += line.trim();
    }
  }
  return out.filter((e) => e.thread && e.reply);
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

function decode(signed: string): unknown {
  try {
    const b64 = signed.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * Sorts pasted entries: for a comment that's no longer here; signed by an agent the page lists (its ops are checked
 * and carry this page, this thread and the same words); or unsigned, with why.
 */
export async function sortEntries(
  entries: readonly Entry[],
  o: {
    doc: string;
    threads: readonly Thread[];
    listed: readonly string[];
    check: (op: unknown) => Promise<boolean>;
  },
): Promise<Sorted[]> {
  const here = new Set(o.threads.map((t) => t.id));
  const out: Sorted[] = [];
  for (const entry of entries) {
    if (!here.has(entry.thread)) {
      out.push({ kind: "gone", entry });
      continue;
    }
    if (!entry.signed) {
      out.push({ kind: "unsigned", entry, why: "none" });
      continue;
    }
    const ops = decode(entry.signed);
    const list = Array.isArray(ops) ? (ops as SignedOp[]) : [];
    const reply = list.find((x) => x?.body?.kind === "reply");
    const note = list.find((x) => x?.body?.kind === "addressed");
    const author = reply?.body.author ?? "";
    const fits =
      !!reply &&
      list.length === (note ? 2 : 1) &&
      list.every((x) => x.body.doc === o.doc && x.body.thread === entry.thread && x.body.author === author) &&
      same(reply.body.text ?? "", entry.reply) &&
      (note ? same(note.body.text ?? "", entry.addressed) : !entry.addressed) &&
      (await Promise.all(list.map(o.check))).every(Boolean);
    if (!fits) out.push({ kind: "unsigned", entry, why: "changed" });
    else if (!o.listed.includes(author)) out.push({ kind: "unsigned", entry, why: "unlisted" });
    else out.push({ kind: "signed", entry, ops: list, author });
  }
  return out;
}

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const names = (xs: readonly string[]) => {
  const u = [...new Set(xs)];
  return u.length <= 1 ? (u[0] ?? "") : `${u.slice(0, -1).join(", ")} and ${u.at(-1)}`;
};

/** What was found, in words, one line each; and how many replies Add will add. */
export function describe(sorted: readonly Sorted[]): { lines: string[]; adds: number } {
  const signed = sorted.filter((s) => s.kind === "signed");
  const unsigned = sorted.filter((s): s is Extract<Sorted, { kind: "unsigned" }> => s.kind === "unsigned");
  const gone = sorted.filter((s) => s.kind === "gone");
  const adds = signed.length + unsigned.length;
  const lines: string[] = [];
  if (signed.length)
    lines.push(
      `${n(signed.length, "reply", "replies")} signed by ${names(signed.map((s) => s.entry.agent))}, whom this page lists`,
    );
  const why = (w: Unsigned, one: boolean) =>
    w === "none"
      ? `${one ? "is" : "are"} not signed`
      : w === "unlisted"
        ? `${one ? "is" : "are"} signed with a key this page doesn't list`
        : one
          ? "was changed after it was signed"
          : "were changed after they were signed";
  for (const w of ["none", "changed", "unlisted"] as const) {
    const these = unsigned.filter((s) => s.why === w);
    if (!these.length) continue;
    const who = names(these.map((s) => s.entry.agent));
    const one = these.length === 1;
    lines.push(
      `${n(these.length, "reply", "replies")} from ${who} ${why(w, one)}, so ${one ? "it" : "they"} will show as pasted by you`,
    );
  }
  const addressed = [...signed, ...unsigned].filter((s) => s.entry.addressed).length;
  if (addressed)
    lines.push(`${addressed} of them ${addressed === 1 ? "says" : "say"} the comment is addressed`);
  if (gone.length)
    lines.push(
      `${n(gone.length, "reply is", "replies are")} for a comment that's no longer here, so ${gone.length === 1 ? "it" : "they"} will be left out`,
    );
  return { lines, adds };
}
