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

const INSTRUCTION =
  "Each thread says where it is: the slide or section, the element (its data-pipeup-id attribute in the HTML), " +
  "and the exact quoted text or pin position. Work through the open threads in order, and for each one say what " +
  "you changed or why you did not. Answer in the thread (the Pipeup skill says how) and mark it addressed; " +
  "never resolve it, the author does.";

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
  return as === "ai" ? threadMarkdown(item, "## Comment thread", now, page) : threadText(item);
}

/** Copy every open thread, in the order given (page or slide order). */
export function copyAll(items: ExportItem[], as: CopyAs, meta: ExportMeta): string {
  const open = meta.all ? items : items.filter((i) => !i.thread.resolved);
  if (as === "text") return open.map(threadText).join("\n");
  const left = meta.all ? 0 : items.length - open.length;
  const head = [
    `# Review comments: ${one(meta.title)}`,
    "",
    `- **Page:** ${one(meta.url)}`,
    `- **Exported:** ${meta.exportedAt.toISOString()}`,
    `- **Open threads:** ${items.length - items.filter((i) => i.thread.resolved).length}${left ? ` (${left} resolved, not included)` : meta.all ? " (resolved ones included)" : ""}`,
    "",
    INSTRUCTION,
    "",
    "",
  ].join("\n");
  const now = meta.exportedAt.getTime();
  return head + open.map((it, i) => threadMarkdown(it, `## Thread ${i + 1}`, now)).join("\n");
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

function threadMarkdown(item: ExportItem, heading: string, now: number, page?: string): string {
  const { thread: t, location: l } = item;
  const n = t.root.replies.length;
  const lines = [`${heading} · ${t.resolved ? "resolved" : t.addressed ? "open, addressed" : "open"}`];
  lines.push(`- **Thread:** ${t.id}`);
  if (page) lines.push(`- **Page:** ${one(page)}`);
  lines.push(`- **Where:** ${one(l.where)}`);
  if (l.id) {
    const id = one(l.id.replace(/`/g, ""));
    lines.push(`- **Element:** \`[data-pipeup-id="${id}"]\`${l.element ? ` (${one(l.element)})` : ""}`);
  }
  if (l.quote) lines.push(`- **Quoted text:** "${one(l.quote)}"`);
  if (l.pin) lines.push(`- **Pin:** ${one(l.pin)}`);
  if (t.addressed && !t.resolved)
    lines.push(
      `- **Addressed:** ${one(t.addressed.text)} (${one(nameOf(t.addressed))}, ${formatAgo(t.addressed.at, now)})`,
    );
  lines.push(
    `- **Started by:** ${one(nameOf(t.root))}, ${formatAgo(t.root.at, now)}${n ? ` · ${n} ${n === 1 ? "reply" : "replies"}` : ""}`,
    "",
    `**${one(nameOf(t.root))}** (${formatAgo(t.root.at, now)}): ${words(t.root, "  ")}`,
  );
  if (t.root.reactions.length) lines.push(`Reactions: ${reactionsLine(t.root)}`);
  for (const r of t.root.replies) {
    lines.push(
      `- **${one(nameOf(r))}** (${formatAgo(r.at, now)}): ${words(r, "  ")} <!-- comment:${r.id} -->`,
    );
    if (r.reactions.length) lines.push(`  - Reactions: ${reactionsLine(r)}`);
  }
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
