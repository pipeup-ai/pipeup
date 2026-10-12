import { isAiName, nameOf } from "../model/animals";
import { copyAll, type ExportItem, type ExportMeta } from "./format";

/** One thread as an agent reads it. */
export interface AgentThread {
  /** The id to answer a thread by. */
  id: string;
  state: "open" | "addressed" | "resolved";
  where: string;
  /** The page's `data-pipeup-id` for the block, when it has one. */
  element?: string;
  quote?: string;
  pin?: string;
  addressed?: { note: string; by: string };
  comments: { id: string; by: string; agent: boolean; at: string; text: string }[];
}

export interface AgentComments {
  /** The same Markdown as Copy as Markdown. */
  markdown: string;
  threads: AgentThread[];
}

/** The page's comments as an agent reads them: the Markdown, and the threads as data. */
export function agentComments(items: ExportItem[], meta: ExportMeta): AgentComments {
  const markdown = copyAll(items, "ai", meta);
  const threads = items
    .filter((i) => meta.all || !i.thread.resolved)
    .map(({ thread: t, location: l }): AgentThread => {
      const out: AgentThread = {
        id: t.id,
        state: t.resolved ? "resolved" : t.addressed ? "addressed" : "open",
        where: l.where,
        comments: [t.root, ...t.root.replies].map((c) => ({
          id: c.id,
          by: nameOf(c),
          agent: isAiName(c.name),
          at: new Date(c.at).toISOString(),
          text: c.deleted ? "" : c.text,
        })),
      };
      if (l.id) out.element = l.id;
      if (l.quote) out.quote = l.quote;
      if (l.pin) out.pin = l.pin;
      if (t.addressed && !t.resolved) out.addressed = { note: t.addressed.text, by: nameOf(t.addressed) };
      return out;
    });
  return { markdown, threads };
}
