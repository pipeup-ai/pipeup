import { nextTo, onThisComputer, runFile } from "./nearby";

/** The address `pipeup watch` serves under, with its one-run secret: `<html data-pipeup-link="/__pipeup/<secret>">`. */
const WATCH = /^\/__pipeup\/[A-Za-z0-9_-]{16,}$/;
/** A shell link's address, from the link file next to the page: on this computer only, with its one-run secret. */
const SHELL = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}\/[A-Za-z0-9_-]{16,}$/;
/** Where a link file leaves the link's address until the add-on takes it. */
const QUEUE = "pipeupLink";
const QUIET_MS = 300;
/** How often a visible page on this computer looks for a shell link. */
const EVERY_MS = 4000;
/** Waits between tries of one send: a shell link takes one connection at a time, so a busy one is tried again. */
const RETRIES = [150, 300, 600, 1000, 1500];

export interface Link {
  /** The page can share with a link right now: shown through one, or a shell link is running beside it. */
  enabled(): boolean;
  /** The link is a shell link (the script), not `pipeup watch`. */
  shell(): boolean;
  /** The agent the link was started for ("Claude"), or "". */
  readonly agent: string;
  /** The page file on this computer, which the agent's commands name; "" when the page doesn't know it. */
  file(): string;
  /** Comments are being shared with the agent right now. */
  on(): boolean;
  /** This session's key: sent with the comments while sharing is on, and "" otherwise. Replies tagged with it are the link's. */
  session(): string;
  /** Turns sharing on (sending everything at once) or off. Rejects in words if the link can't be reached. */
  set(on: boolean): Promise<void>;
  /** Looks for a shell link now. */
  look(): Promise<void>;
  destroy(): void;
}

/** A new key for one session of sharing: 24 random bytes, base64url. */
function newSession(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The page file on this computer, when the page was opened from one. */
function fileOf(here: Location): string {
  if (here.protocol !== "file:") return "";
  const path = decodeURIComponent(here.pathname);
  return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
}

/** Shares the page's comments with a link on this computer, only while the person has it switched on. */
export function startLink(o: {
  /** What to send: the comments as they are now. */
  snapshot(): Promise<object>;
  /** Hears every change to the comments; returns a function that stops listening. */
  changes(fn: () => void): () => void;
  /** Sharing stopped by itself (the link went away), was switched on or off, or a link appeared or went: redraw. */
  refresh(): void;
  /** The shell link went away while sharing was on. */
  lost?(): void;
  /** Where to run a link file: Pipeup's own layer. Without it, the page looks for no shell link. */
  overlay?: () => HTMLElement;
  /** Finds a shell link's address (for tests); by default, runs the link file next to the page. */
  find?: () => Promise<string | null>;
  here?: Location;
}): Link {
  const here = o.here ?? location;
  const html = document.documentElement;
  const attr = html.getAttribute("data-pipeup-link") ?? "";
  const watch = WATCH.test(attr) ? attr : "";
  let shell = "";
  let on = false;
  let session = "";
  let timer = 0;
  let every = 0;
  let off = (): void => {};
  let queue: Promise<void> = Promise.resolve();

  const base = () => watch || shell;

  async function sendOnce(body: string): Promise<boolean> {
    try {
      const r = await fetch(`${base()}/comments`, {
        method: "POST",
        // A shell link is another address on this computer: plain text keeps it a simple request, with no preflight.
        headers: { "content-type": watch ? "application/json" : "text/plain;charset=utf-8" },
        body,
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  /** One send at a time; a busy link is tried again for a few seconds before it counts as gone. */
  function send(): Promise<void> {
    const run = async () => {
      const body = JSON.stringify({ session, ...(await o.snapshot()) });
      if (await sendOnce(body)) return;
      for (const wait of RETRIES) {
        await sleep(wait);
        if (!base()) break;
        if (await sendOnce(body)) return;
      }
      throw new Error("pipeup: the link to your agent isn't reachable; your comments are safe here");
    };
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  }

  const stop = () => {
    window.clearTimeout(timer);
    off();
    off = () => {};
    on = false;
    session = "";
  };

  const finder =
    o.find ??
    (o.overlay && onThisComputer(here)
      ? async () => {
          const url = nextTo(".link.js", null, here);
          if (!url) return null;
          const g = globalThis as unknown as Record<string, unknown>;
          g[QUEUE] = [];
          try {
            await runFile(url, o.overlay!());
          } catch {
            return null;
          }
          const found = (g[QUEUE] as { format?: unknown; url?: unknown }[]).filter(
            (x) => x?.format === "pipeup-link" && typeof x.url === "string" && SHELL.test(x.url),
          );
          return (found.at(-1)?.url as string | undefined) ?? null;
        }
      : null);

  let looking = false;
  async function look(): Promise<void> {
    if (watch || !finder || looking) return;
    looking = true;
    try {
      const found = (await finder()) ?? "";
      if (found === shell) return;
      const was = on;
      if (on) stop();
      shell = found;
      if (was) o.lost?.();
      o.refresh();
    } finally {
      looking = false;
    }
  }
  const lookNow = () => {
    if (!document.hidden) void look();
  };
  if (!watch && finder) {
    lookNow();
    every = window.setInterval(lookNow, EVERY_MS);
    document.addEventListener("visibilitychange", lookNow);
  }

  return {
    enabled: () => !!base(),
    shell: () => !watch && !!shell,
    agent: html.getAttribute("data-pipeup-link-agent") ?? "",
    file: () => (watch ? (html.getAttribute("data-pipeup-link-file") ?? "") : shell ? fileOf(here) : ""),
    on: () => on,
    session: () => session,
    set: async (next) => {
      if (!base()) return;
      if (!next) {
        stop();
        o.refresh();
        return;
      }
      session = newSession();
      try {
        await send();
      } catch (e) {
        session = "";
        throw e;
      }
      on = true;
      off = o.changes(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          send().catch((e: unknown) => {
            stop();
            o.refresh();
            globalThis.reportError?.(e);
          });
        }, QUIET_MS);
      });
      o.refresh();
    },
    look,
    destroy: () => {
      stop();
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", lookNow);
    },
  };
}
