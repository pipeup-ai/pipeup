import type { Location } from "../anchor/locate";
import { nameOf } from "../model/animals";
import type { Comment, Thread } from "../model/types";

export type CopyAs = "ai" | "text";

export interface ExportItem {
  thread: Thread;
  location: Location;
}

export interface ExportMeta {
  title: string;
  url: string;
  exportedAt: Date;
  /** Also the resolved threads (default: open ones only). */
  all?: boolean;
}

// After the threads, so a person reads the comments first.
const AI =
  "For an AI assistant: work through the open comments in order and say what you changed, or why you didn't. Each " +
  "one's last line gives the thread to answer and the element's data-pipeup-id in the page's HTML. Answer in the " +
  "thread with Pipeup (its pipeup-apply skill says how) and mark it addressed; never resolve it, the author does.";

export function formatAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Copy one thread — always the whole thread. */
export function copyThread(item: ExportItem, as: CopyAs, page: string, now: number): string {
  return as === "ai" ? threadMarkdown(item, "## ", now, page) : threadText(item);
}

/** Copy every open thread, in the order given (page or slide order). */
export function copyAll(items: ExportItem[], as: CopyAs, meta: ExportMeta): string {
  const open = meta.all ? items : items.filter((i) => !i.thread.resolved);
  if (as === "text") return open.map(threadText).join("\n");
  const resolved = items.filter((i) => i.thread.resolved).length;
  const n = items.length - resolved;
  const who = people(open);
  // "Tue, 27 Oct 2026 09:40:17 GMT" → "27 Oct 2026, 09:40 UTC"
  const at = meta.exportedAt.toUTCString();
  const head = [
    `# Comments on ${one(meta.title)}`,
    "",
    `${n || "No"} open comment${n === 1 ? "" : "s"}${meta.all && resolved ? ` and ${resolved} resolved` : ""}` +
      `${who ? ` from ${who}` : ""}, copied ${at.slice(5, 16).replace(/^0/, "")}, ${at.slice(17, 22)} UTC.` +
      (meta.all || !resolved
        ? ""
        : ` ${resolved} resolved comment${resolved === 1 ? " is" : "s are"} left out.`),
    "",
    `Page: ${one(meta.url)}`,
    "",
    "",
  ].join("\n");
  const now = meta.exportedAt.getTime();
  const body = open.map((it, i) => threadMarkdown(it, `## ${i + 1}. `, now)).join("\n");
  return head + body + (open.length ? `\n---\n\n${AI}\n` : "");
}

/** A comment's reactions as one line: "👍 2 (Sam, Red Fox) · ❤️ 1 (Lee)"; empty when nobody reacted. */
export function reactionsLine(c: Comment): string {
  return c.reactions
    .map((r) => `${r.emoji} ${r.by.length} (${r.by.map((b) => one(nameOf(b))).join(", ")})`)
    .join(" · ");
}

/** Text from other people or the page, on one line: newlines would break the metadata structure. */
function one(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Everyone in these threads, in the order they first appear: "Sam", "Sam and Lee", "Sam, Ada and 3 others". */
function people(items: ExportItem[]): string {
  const all = [
    ...new Set(items.flatMap(({ thread: t }) => [t.root, ...t.root.replies].map((c) => one(nameOf(c))))),
  ];
  const named = all.length > 3 ? [...all.slice(0, 2), `${all.length - 2} others`] : all;
  return named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}` : (named[0] ?? "");
}

// Where it is, then who said what. What only an agent needs (its state and ids) is the thread's last line.
function threadMarkdown(item: ExportItem, heading: string, now: number, page?: string): string {
  const { thread: t, location: l } = item;
  const lines = [heading + one(l.where), ""];
  if (page) lines.push(`Page: ${one(page)}`, "");
  if (l.quote) lines.push(`On the words "${one(l.quote)}".`, "");
  if (l.pin) lines.push(`Pinned ${one(l.pin)}.`, "");
  lines.push(`**${one(nameOf(t.root))}** (${formatAgo(t.root.at, now)}): ${words(t.root, "  ")}`);
  if (t.root.reactions.length) lines.push(`Reactions: ${reactionsLine(t.root)}`);
  for (const r of t.root.replies) {
    lines.push(`- **${one(nameOf(r))}** (${formatAgo(r.at, now)}): ${words(r, "  ")}`);
    if (r.reactions.length) lines.push(`  - Reactions: ${reactionsLine(r)}`);
  }
  if (t.addressed && !t.resolved)
    lines.push(
      "",
      `**${one(nameOf(t.addressed))}** marked it addressed (${formatAgo(t.addressed.at, now)}): ${one(t.addressed.text)}`,
    );
  // A slide's or section's id names where the element is ("in"), not the element itself ("on").
  const id = l.id ? ` · ${l.within ? "in" : "on"} \`data-pipeup-id="${one(l.id.replace(/`/g, ""))}"\`` : "";
  lines.push(
    "",
    `${t.resolved ? "Resolved" : t.addressed ? "Open, addressed" : "Open"} · thread \`${t.id}\`${id}`,
  );
  return lines.join("\n") + "\n";
}

function threadText(item: ExportItem): string {
  const { thread: t, location: l } = item;
  const lines = [
    one(l.where) + (l.quote ? `, on the text "${one(l.quote)}"` : ""),
    `${one(nameOf(t.root))}: ${words(t.root, "  ")}`,
  ];
  if (t.root.reactions.length) lines.push(`  Reactions: ${reactionsLine(t.root)}`);
  for (const r of t.root.replies) {
    lines.push(`  ${one(nameOf(r))}: ${words(r, "    ")}`);
    if (r.reactions.length) lines.push(`    Reactions: ${reactionsLine(r)}`);
  }
  return lines.join("\n") + "\n";
}

/** A comment's words, with continuation lines indented so they stay inside their list item. */
function words(c: Comment, pad: string): string {
  if (c.deleted) return "(deleted)";
  return c.text.replace(/\r\n|\r|\n/g, "\n" + pad) + (c.edited ? " (edited)" : "");
}
