/** Pure helpers for the command line: rewriting the page, and saying things in words. */

const HTML_TAG = /<html\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;

const attr = (name: string) => new RegExp(`(\\s)${name}(\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>"']+)`, "i");

/** The value of an attribute on the `<html>` tag, or null. */
export function readAttribute(html: string, name: string): string | null {
  const tag = HTML_TAG.exec(html)?.[0];
  const m = tag && attr(name).exec(tag);
  if (!m) return null;
  return m[3]!
    .replace(/^["']|["']$/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * Sets an attribute on the `<html>` tag, changing nothing else: not a space, not a line ending. An existing attribute
 * keeps its quotes; a new one goes just before the tag's `>`.
 */
export function setAttribute(html: string, name: string, value: string): string {
  const m = HTML_TAG.exec(html);
  if (!m) throw new Error("the page has no <html> tag to put it on");
  const tag = m[0];
  const escaped = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const old = attr(name).exec(tag);
  let next: string;
  if (old) {
    const q = old[3]![0] === "'" ? "'" : '"';
    const v = q === "'" ? value.replace(/&/g, "&amp;").replace(/'/g, "&#39;") : escaped;
    next =
      tag.slice(0, old.index) +
      `${old[1]}${name}${old[2]}${q}${v}${q}` +
      tag.slice(old.index + old[0].length);
  } else {
    const at = tag.length - 1; // before ">"
    next = `${tag.slice(0, at)} ${name}="${escaped}"${tag.slice(at)}`;
  }
  return html.slice(0, m.index) + next + html.slice(m.index + tag.length);
}

const DAY = 86_400_000;

export const dateWords = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** "1 week", "3 days": how long in plain units, rounded. */
export function spanWords(ms: number): string {
  const n = (x: number, unit: string) => `${x} ${unit}${x === 1 ? "" : "s"}`;
  if (ms < 3_600_000) return n(Math.max(1, Math.round(ms / 60_000)), "minute");
  if (ms < 2 * DAY) return n(Math.round(ms / 3_600_000), "hour");
  if (ms < 6.5 * DAY) return n(Math.round(ms / DAY), "day");
  if (ms < 60 * DAY) return n(Math.round(ms / (7 * DAY)), "week");
  if (ms < 730 * DAY) return n(Math.round(ms / (30 * DAY)), "month");
  return n(Math.round(ms / (365 * DAY)), "year");
}

/** How long a service keeps the shared copy, in words: "paste.example.org keeps this shared copy for 1 week, until 14 October 2026." */
export function keepWords(host: string, ttlMs: number | null, now = Date.now()): string {
  if (ttlMs === null) return `${host} keeps this shared copy until it is deleted.`;
  return `${host} keeps this shared copy for ${spanWords(ttlMs)}, until ${dateWords(now + ttlMs)}.`;
}

export interface Args {
  command: string | undefined;
  file: string | undefined;
  flags: Map<string, string | true>;
}

const WITH_VALUE = new Set(["server", "from", "key"]);

/** `share <command> <file> --flag value`. Unknown flags are an error, so a typo never silently does less. */
export function parseArgs(argv: readonly string[]): Args {
  const flags = new Map<string, string | true>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h") flags.set("help", true);
    else if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
      if (WITH_VALUE.has(name)) {
        const v = inline ?? argv[++i];
        if (v === undefined || v.startsWith("--")) throw new UsageError(`--${name} needs a value`);
        flags.set(name, v);
      } else if (["mailbox", "new-doc", "help"].includes(name)) flags.set(name, true);
      else throw new UsageError(`I don't know the option --${name}`);
    } else rest.push(a);
  }
  return { command: rest[0], file: rest[1], flags };
}

/** The person asked for something the tool can't do as written. Exit code 2. */
export class UsageError extends Error {}
