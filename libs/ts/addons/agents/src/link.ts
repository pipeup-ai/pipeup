/** The address the link serves under, with its one-run secret: `<html data-pipeup-link="/__pipeup/<secret>">`. */
const BASE = /^\/__pipeup\/[A-Za-z0-9_-]{16,}$/;
const QUIET_MS = 300;

export interface Link {
  /** The page is shown through a link on this computer: the switch exists. */
  readonly enabled: boolean;
  /** The agent the link was started for ("Claude"), or "". */
  readonly agent: string;
  /** The page file on this computer, which the agent's commands name. */
  readonly file: string;
  /** Comments are being shared with the agent right now. */
  on(): boolean;
  /** Turns sharing on (sending everything at once) or off. Rejects in words if the link can't be reached. */
  set(on: boolean): Promise<void>;
  destroy(): void;
}

/** Shares the page's comments with the program running on this computer, only while the person has it switched on. */
export function startLink(o: {
  /** What to send: the comments as they are now. */
  snapshot(): Promise<unknown>;
  /** Hears every change to the comments; returns a function that stops listening. */
  changes(fn: () => void): () => void;
  /** Sharing stopped by itself (the link went away), or was switched on or off: redraw. */
  refresh(): void;
}): Link {
  const html = document.documentElement;
  const base = html.getAttribute("data-pipeup-link") ?? "";
  const enabled = BASE.test(base);
  let on = false;
  let timer = 0;
  let off = (): void => {};

  async function send(): Promise<void> {
    let ok = false;
    try {
      const r = await fetch(`${base}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(await o.snapshot()),
      });
      ok = r.ok;
    } catch {
      // the link isn't there any more
    }
    if (!ok) throw new Error("pipeup: the link to your agent isn't reachable; your comments are safe here");
  }

  const stop = () => {
    window.clearTimeout(timer);
    off();
    off = () => {};
    on = false;
  };

  return {
    enabled,
    agent: html.getAttribute("data-pipeup-link-agent") ?? "",
    file: html.getAttribute("data-pipeup-link-file") ?? "",
    on: () => on,
    set: async (next) => {
      if (!enabled) return;
      if (!next) {
        stop();
        o.refresh();
        return;
      }
      await send();
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
    destroy: stop,
  };
}
