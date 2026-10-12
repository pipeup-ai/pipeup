import type { PipeupDocument } from "../document";
import { isAiName } from "../model/animals";
import type { SignedOp, Thread } from "../model/types";

const KEY = /^[A-Za-z0-9_-]{43}$/;
/** Where a page-loaded replies file leaves what it carries until Pipeup takes it. */
const QUEUE = "pipeupReplies";
const WAIT_MS = 4000;

/** The agents the author lists: `<html data-pipeup-agents="<key> <key>">`, public keys only. */
export function listedAgents(): string[] {
  const list = document.documentElement.getAttribute("data-pipeup-agents") ?? "";
  return [...new Set(list.split(/[\s,]+/).filter((k) => KEY.test(k)))];
}

/**
 * The replies file next to the page (`report.html` → `report.replies.js`), or the page's own choice. Only
 * a file on the same computer or the same site is ever read.
 */
export function repliesUrl(): string | null {
  const html = document.documentElement;
  const given = html.getAttribute("data-pipeup-replies");
  try {
    const here = location.href.split(/[?#]/)[0]!;
    const url = new URL(
      given ?? (/\/$/.test(here) ? `${here}index.replies.js` : here.replace(/\.[^./]*$/, "") + ".replies.js"),
      location.href,
    );
    const ok = url.protocol === "file:" ? location.protocol === "file:" : url.origin === location.origin;
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
  /** The threads an agent has answered, and the ones it marked addressed. */
  tally(threads: readonly Thread[]): { open: number; answered: number; addressed: number };
  destroy(): void;
}

/** Brings agents' replies into the document. Nothing is fetched unless an agent is listed. */
export function startReplies(o: {
  doc: PipeupDocument;
  /** Pipeup's own layer: the file's script runs from here, so the page itself is never touched. */
  layer: HTMLElement;
}): Replies {
  const agents = listedAgents();
  let ignored = 0;
  let name = "";
  let live: HTMLScriptElement | null = null;

  /** Takes what a replies file left behind, keeping only signed replies and addressed notes from listed agents. */
  async function take(): Promise<number> {
    const queue = (globalThis as unknown as Record<string, unknown>)[QUEUE];
    if (!Array.isArray(queue)) return 0;
    const files = queue.splice(0);
    const keep: SignedOp[] = [];
    for (const file of files) {
      const f = file as { format?: unknown; doc?: unknown; ops?: unknown };
      if (f?.format !== "pipeup-replies" || f.doc !== o.doc.id || !Array.isArray(f.ops)) continue;
      for (const op of f.ops as SignedOp[]) {
        const b = op?.body;
        if (b && agents.includes(b.author) && (b.kind === "reply" || b.kind === "addressed")) {
          keep.push(op);
          if (isAiName(b.name)) name = b.name.replace(/^AI assistant\s*·?\s*/, "");
        } else ignored++;
      }
    }
    return keep.length ? o.doc.merge(keep, "agent") : 0;
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
      o.layer.append(s);
    });
  }

  async function check(): Promise<number> {
    if (!agents.length) return 0;
    const before = await take();
    await load();
    return before + (await take());
  }

  // Replies the page itself loaded (a script tag), then the file next to it, quietly.
  if (agents.length) void check().catch(() => {});
  else void take();

  return {
    enabled: agents.length > 0,
    ignored: () => ignored,
    who: () => name,
    check,
    tally: (threads) => {
      const open = threads.filter((t) => !t.resolved);
      const said = (t: Thread) => t.root.replies.some((r) => agents.includes(r.author));
      return {
        open: open.length,
        answered: open.filter(said).length,
        addressed: open.filter((t) => t.addressed).length,
      };
    },
    destroy: () => live?.remove(),
  };
}
