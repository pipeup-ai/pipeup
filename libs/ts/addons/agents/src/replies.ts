import type { AddonHost, SignedOp, Thread } from "pipeup";
import { nextTo, runFile } from "./nearby";

const KEY = /^[A-Za-z0-9_-]{43}$/;
/** Where a page-loaded replies file leaves what it carries until the add-on takes it. */
const QUEUE = "pipeupReplies";
/** How often a visible page looks for new replies. */
const EVERY_MS = 4000;
const AI = /^AI assistant\s*·?\s*/;

/** The agents the author lists: `<html data-pipeup-agents="<key> <key>">`, public keys only. */
export function listedAgents(html: Element = document.documentElement): string[] {
  const list = html.getAttribute("data-pipeup-agents") ?? "";
  return [...new Set(list.split(/[\s,]+/).filter((k) => KEY.test(k)))];
}

/** The replies file next to the page (`report.html` → `report.replies.js`), or the page's own choice. */
export function repliesUrl(
  here: Location = location,
  html: Element = document.documentElement,
): string | null {
  return nextTo(".replies.js", html.getAttribute("data-pipeup-replies"), here);
}

/** A replies block a shell link left in the replies file, with the tag it made from this session's key ("" for none). */
export interface Block {
  text: string;
  tag: string;
}

export interface Replies {
  /** The author listed at least one agent: the page is ready for one. */
  readonly enabled: boolean;
  /** How many replies were set aside because their writer isn't listed, or they aren't replies. */
  ignored(): number;
  /** The name an agent signs with ("Claude"), once one has answered; "" before. */
  who(): string;
  /** Looks for replies now. Resolves to how many new ones came in; rejects in words if the file can't be read. */
  check(): Promise<number>;
  /** The threads an agent has answered, and the ones it marked addressed; and replies for threads this page doesn't have. */
  tally(threads: readonly Thread[]): { open: number; answered: number; addressed: number; stray: number };
  destroy(): void;
}

/**
 * Brings agents' replies into the document. Nothing is fetched unless an agent is listed or a link is running. Replies
 * blocks a shell link left go to `blocks`, which decides what to do with them.
 */
export function startReplies(
  host: AddonHost,
  o: { linked?: () => boolean; blocks?: (found: Block[]) => void } = {},
): Replies {
  const agents = listedAgents();
  const linked = () => agents.length > 0 || !!o.linked?.();
  let ignored = 0;
  let name = "";

  /** Takes what a replies file left behind, keeping only signed replies, addressed notes and reactions from listed agents. */
  async function take(): Promise<number> {
    const queue = (globalThis as unknown as Record<string, unknown>)[QUEUE];
    if (!Array.isArray(queue)) return 0;
    const files = queue.splice(0);
    const keep: SignedOp[] = [];
    const blocks: Block[] = [];
    for (const file of files) {
      const f = file as { format?: unknown; doc?: unknown; ops?: unknown; text?: unknown; tag?: unknown };
      if (f?.format === "pipeup-replies-block" && typeof f.text === "string") {
        blocks.push({ text: f.text, tag: typeof f.tag === "string" ? f.tag : "" });
        continue;
      }
      if (f?.format !== "pipeup-replies" || f.doc !== host.document.id || !Array.isArray(f.ops)) continue;
      for (const op of f.ops as SignedOp[]) {
        const b = op?.body;
        if (
          b &&
          agents.includes(b.author) &&
          (b.kind === "reply" || b.kind === "addressed" || b.kind === "react" || b.kind === "unreact")
        ) {
          keep.push(op);
          if (b.name === "AI assistant" || b.name.startsWith("AI assistant ")) name = b.name.replace(AI, "");
        } else ignored++;
      }
    }
    if (blocks.length) o.blocks?.(blocks);
    return keep.length ? host.merge(keep) : 0;
  }

  function load(): Promise<void> {
    const url = repliesUrl();
    if (!url) return Promise.reject(new Error("pipeup: the replies file can't be read from here"));
    return runFile(url, host.overlay()).catch((e: unknown) => {
      throw new Error(
        e instanceof Error && /didn't answer/.test(e.message)
          ? "pipeup: the replies file didn't answer"
          : "pipeup: there is no replies file yet",
      );
    });
  }

  async function check(): Promise<number> {
    if (!linked()) return take();
    const before = await take();
    await load();
    return before + (await take());
  }

  // Replies the page itself loaded (a script tag), then the file next to it, quietly.
  let looking = false;
  const look = () => {
    if (looking || document.hidden) return;
    looking = true;
    void check()
      .catch(() => {})
      .finally(() => (looking = false));
  };
  // New replies appear by themselves while the page is showing, and at once when it comes back into view; with no
  // agent listed and no link running, only what the page itself loaded is taken.
  const timer = window.setInterval(look, EVERY_MS);
  document.addEventListener("visibilitychange", look);
  look();

  return {
    enabled: agents.length > 0,
    ignored: () => ignored,
    who: () => name,
    check,
    tally: (threads) => {
      const open = threads.filter((t) => !t.resolved);
      // A listed agent's own replies, and the ones a reviewer pasted for an agent.
      const said = (t: Thread) =>
        t.root.replies.some((r) => agents.includes(r.author) || r.name.startsWith("AI assistant · "));
      const here = new Set(threads.map((t) => t.id));
      const stray = new Set(
        host.document
          .ops()
          .filter((x) => agents.includes(x.body.author) && !here.has(x.body.thread))
          .map((x) => x.body.thread),
      ).size;
      return {
        stray,
        open: open.length,
        answered: open.filter(said).length,
        addressed: open.filter((t) => t.addressed).length,
      };
    },
    destroy: () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    },
  };
}
