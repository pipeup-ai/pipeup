import type { PipeupAddon, Thread } from "pipeup";

/**
 * "Send to Git": an example of an add-on a company writes for itself. It is NOT from the Pipeup project, and nothing
 * in it is published under the Pipeup names. It adds one menu row that sends the review, as the same AI-ready Markdown
 * that Copy as Markdown makes, to a service the company runs; that service files it in Git. The add-on never holds a
 * Git password or token, never writes to the page, and never posts, edits or resolves a comment for anyone.
 *
 * The page names the service: <html data-pipeup-send-to-git-url="https://reviews.example.com/reviews">.
 * The request and answer are written down in the README ("The contract").
 */

/** The functions this add-on borrows from Pipeup's global (Pipeup is loaded before any add-on; never bundle it). */
interface PipeupGlobal {
  resolveAnchor(a: Thread["anchor"], root: Element, o?: { fuzzy?: boolean }): unknown;
  locate(a: Thread["anchor"], resolved: unknown, root: Element): unknown;
  copyAll(items: { thread: Thread; location: unknown }[], as: "ai" | "text", meta: Meta): string;
}
interface Meta {
  title: string;
  url: string;
  exportedAt: Date;
}
const core = (): Partial<PipeupGlobal> => (globalThis as { Pipeup?: Partial<PipeupGlobal> }).Pipeup ?? {};

const ATTR = "data-pipeup-send-to-git-url";
const CREDENTIALS = "data-pipeup-send-to-git-credentials";
const SAYS =
  "Sends this page's open comments, as one Markdown file, to the address the page names, only after you confirm. Nothing else is sent.";
const CSS = `.stg-p{margin:0 0 10px}.stg-note{color:var(--pu-faint)}
.stg-box{margin:0 0 12px;padding:8px 10px;border:1px solid var(--pu-line);border-radius:8px;font-size:12.5px;overflow-wrap:anywhere}
.stg-pre{margin:0 0 12px;max-height:150px;overflow:auto;padding:8px 10px;border:1px solid var(--pu-line);border-radius:8px;font:11.5px/1.45 ui-monospace,monospace;white-space:pre-wrap}
.stg-btns{display:flex;gap:8px;flex-wrap:wrap}
.stg-btns button{font:inherit;color:inherit;background:none;cursor:pointer;padding:6px 12px;border:1px solid var(--pu-line);border-radius:8px;transition:background-color .2s var(--pu-ease),opacity .2s var(--pu-ease)}
.stg-btns button:hover,.stg-btns button:focus-visible{background:var(--pu-hover);outline:none}
.stg-btns button:disabled{opacity:.5;cursor:default}.stg-btns .stg-go{color:var(--pu-accent)}
.stg-ok{color:var(--pu-accent)}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** The address the page names, if it is one we may send to: secure, or this computer; or "demo:" to only show it. */
export function target(raw: string | null): { kind: "demo" } | { kind: "url"; url: URL } | { error: string } {
  if (!raw) return { error: "this page names no address to send to" };
  if (raw.trim() === "demo:") return { kind: "demo" };
  let url: URL;
  try {
    url = new URL(raw, location.href);
  } catch {
    return { error: "the address this page names isn't a web address" };
  }
  const here = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && here))
    return { error: "the address this page names isn't secure (https)" };
  return { kind: "url", url };
}

export function createAddon(): PipeupAddon {
  return {
    id: "send-to-git",
    api: 1,
    version: "0.1.0",
    needs: ["menu", "panel", "styles"],
    network: { when: "page-configured", to: ["page"], says: SAYS },
    setup(host) {
      const t = target(document.documentElement.getAttribute(ATTR));
      if ("error" in t) return host.off(t.error);
      const offStyles = host.addStyles(CSS);
      let panel: { close(): void } | undefined;
      const open = () => host.document.threads().filter((x) => !x.resolved);

      /** The review as the AI-ready Markdown Pipeup already writes, from the threads and where they are. */
      const markdown = (): string => {
        const c = core();
        if (!c.copyAll || !c.locate || !c.resolveAnchor)
          throw new Error("Pipeup isn't ready to write the review");
        const items = open().map((thread) => ({
          thread,
          location: c.locate!(thread.anchor, c.resolveAnchor!(thread.anchor, host.root), host.root),
        }));
        return c.copyAll(items, "ai", { title: document.title, url: location.href, exportedAt: new Date() });
      };

      const ask = (): void => {
        panel?.close();
        const n = open().length;
        const box = el("div");
        const where =
          t.kind === "demo" ? "a demonstration (nothing leaves your browser)" : t.url.origin + t.url.pathname;
        box.append(
          el(
            "p",
            "stg-p",
            `This will send ${n} open comment${n === 1 ? "" : "s"} from this page, as one Markdown file, to:`,
          ),
          el("div", "stg-box", where),
          el(
            "p",
            "stg-p stg-note",
            "Only what you see in Copy as Markdown is sent. It never posts, changes or resolves a comment.",
          ),
        );
        const say = el("p", "stg-p");
        say.hidden = true;
        const pre = el("pre", "stg-pre");
        pre.hidden = true;
        const go = el("button", "stg-go", "Send");
        const no = el("button", "", "Cancel");
        go.type = no.type = "button";
        if (!n) go.disabled = true;
        const btns = el("div", "stg-btns");
        btns.append(go, no);
        box.append(say, pre, btns);
        no.onclick = () => panel?.close();
        go.onclick = async () => {
          go.disabled = true;
          say.hidden = false;
          say.className = "stg-p stg-note";
          say.textContent = "Sending…";
          try {
            const body = {
              title: document.title,
              url: location.href,
              exportedAt: new Date().toISOString(),
              openThreads: n,
              markdown: markdown(),
            };
            if (t.kind === "demo") {
              pre.hidden = false;
              pre.textContent = JSON.stringify(
                {
                  ...body,
                  markdown: body.markdown.slice(0, 700) + (body.markdown.length > 700 ? "\n…" : ""),
                },
                null,
                2,
              );
              say.textContent =
                "Demonstration: this is exactly what would be sent. Nothing left your browser.";
              no.textContent = "Close";
              return;
            }
            const res = await fetch(t.url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
              credentials:
                document.documentElement.getAttribute(CREDENTIALS) === "include" ? "include" : "same-origin",
              signal: host.signal,
            });
            const out = (await res.json().catch(() => ({}))) as {
              path?: string;
              commit?: string;
              pr?: string;
              error?: string;
            };
            if (!res.ok) throw new Error(out.error || explain(res.status));
            say.className = "stg-p stg-ok";
            say.textContent = `Saved ${out.path ?? "the review"}${out.commit ? `, commit ${out.commit.slice(0, 7)}` : ""}${out.pr ? `, pull request ${out.pr}` : ""}.`;
            no.textContent = "Close";
            host.notify(`Sent ${n} comment${n === 1 ? "" : "s"} to Git`);
          } catch (e) {
            say.className = "stg-p";
            say.textContent = `That didn't work, so nothing was saved: ${e instanceof Error ? e.message : String(e)}`;
            go.disabled = false;
          }
        };
        panel = host.openPanel(box, { label: "Send to Git", onClose: () => (panel = undefined) });
      };

      const row = host.addMenuItem({
        id: "send",
        icon: ["M7 4v10a4 4 0 0 0 4 4h6", "M7 4a2 2 0 1 0 0 .01", "M17 18a2 2 0 1 0 0 .01"],
        label: () => "Send to Git",
        hint: () => SAYS,
        count: () => (open().length ? String(open().length) : ""),
        select: ask,
      });
      const off = host.document.onChange(() => row.update());
      return () => {
        off();
        panel?.close();
        offStyles();
      };
    },
  };
}

function explain(status: number): string {
  if (status === 401 || status === 403) return "you are not signed in to the service";
  if (status === 413) return "the review is too large for the service";
  if (status === 429) return "the service asked you to wait a moment";
  return `the service answered ${status}`;
}
