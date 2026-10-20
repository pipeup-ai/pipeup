import type { AddonHost, SignedOp, Thread } from "pipeup";
import { pageSetting } from "@pipeup/kit";

const KEY = /^[A-Za-z0-9_-]{43}$/;
/** Where a page-loaded replies file leaves what it carries until the add-on takes it. */
const QUEUE = "pipeupReplies";
const WAIT_MS = 4000;
/** How often a visible page looks for new replies. */
const EVERY_MS = 4000;
const AI = /^AI assistant\s*·?\s*/;

/** The agents the author lists: `<html data-pipeup-agents="<key> <key>">`, public keys only. */
export function listedAgents(html?: Element): string[] {
  const list = pageSetting("data-pipeup-agents", html) ?? "";
  return [...new Set(list.split(/[\s,]+/).filter((k) => KEY.test(k)))];
}

/**
 * The replies file next to the page (`report.html` → `report.replies.js`), or the page's own choice. Only
 * a file on the same computer or the same site is ever read.
 */
export function repliesUrl(here: Location = location, html?: Element): string | null {
  const given = pageSetting("data-pipeup-replies", html);
  try {
    const page = here.href.split(/[?#]/)[0]!;
    const url = new URL(
      given ?? (/\/$/.test(page) ? `${page}index.replies.js` : page.replace(/\.[^./]*$/, "") + ".replies.js"),
      here.href,
    );
    const ok = url.protocol === "file:" ? here.protocol === "file:" : url.origin === here.origin;
    if (!ok) console.warn("pipeup: the replies file must be on this site or this computer; ignoring it");
    return ok ? url.href : null;
  } catch {
    return null;
  }
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

/** Brings agents' replies into the document. Nothing is fetched unless an agent is listed. */
export function startReplies(host: AddonHost): Replies {
  const agents = listedAgents();
  let ignored = 0;
  let name = "";
  let live: HTMLScriptElement | null = null;

  /** Takes what a replies file left behind, keeping only signed replies, addressed notes and reactions from listed agents. */
  async function take(): Promise<number> {
    const queue = (globalThis as unknown as Record<string, unknown>)[QUEUE];
    if (!Array.isArray(queue)) return 0;
    const files = queue.splice(0);
    const keep: SignedOp[] = [];
    for (const file of files) {
      const f = file as { format?: unknown; doc?: unknown; ops?: unknown };
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
    return keep.length ? host.merge(keep) : 0;
  }

  function load(): Promise<void> {
    const url = repliesUrl();
    if (!url) return Promise.reject(new Error("pipeup: the replies file can't be read from here"));
    live?.remove();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      live = s;
      // A fresh address each time, so a file that changed is read again, not remembered.
      s.src = `${url}?${Date.now()}`;
      const done = (fail?: string) => {
        window.clearTimeout(timer);
        s.remove();
        if (live === s) live = null;
        if (fail) reject(new Error(`pipeup: ${fail}`));
        else resolve();
      };
      const timer = window.setTimeout(() => done("the replies file didn't answer"), WAIT_MS);
      s.addEventListener("load", () => done());
      s.addEventListener("error", () => done("there is no replies file yet"));
      // Inside Pipeup's own layer, so the page itself is never touched.
      host.overlay().append(s);
    });
  }

  async function check(): Promise<number> {
    if (!agents.length) return 0;
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
  let timer = 0;
  if (agents.length) {
    look();
    // New replies appear by themselves while the page is showing, and at once when it comes back into view.
    timer = window.setInterval(look, EVERY_MS);
    document.addEventListener("visibilitychange", look);
  } else void take();

  return {
    enabled: agents.length > 0,
    ignored: () => ignored,
    who: () => name,
    check,
    tally: (threads) => {
      const open = threads.filter((t) => !t.resolved);
      const said = (t: Thread) => t.root.replies.some((r) => agents.includes(r.author));
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
      live?.remove();
    },
  };
}
