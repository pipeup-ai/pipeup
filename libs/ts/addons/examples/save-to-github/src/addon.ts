import type { PipeupAddon, Thread } from "pipeup";

/**
 * "Save to GitHub": an example of an add-on a company writes for itself. It is NOT from the Pipeup project. It needs no
 * server and holds no token: one menu row opens GitHub's own "new file" page in a new tab with the review already filled
 * in (the Markdown that Copy as Markdown makes). The reviewer signs in to GitHub as themselves and presses GitHub's commit
 * button (or "propose changes" when they can't write to the repository). It never posts, edits or resolves a comment.
 *
 * The page names the repository: <html data-pipeup-save-to-github="your-org/reviews">, and optionally
 * data-pipeup-save-to-github-branch (main), -folder (reviews) and -host (github.com, or a GitHub Enterprise Server host).
 */

/** The functions this add-on borrows from Pipeup's global (Pipeup is loaded before any add-on; never bundle it). */
interface PipeupGlobal {
  resolveAnchor(a: Thread["anchor"], root: Element, o?: { fuzzy?: boolean }): unknown;
  locate(a: Thread["anchor"], resolved: unknown, root: Element): unknown;
  copyAll(items: { thread: Thread; location: unknown }[], as: "ai" | "text", meta: Meta): string;
  animalName?(key: string): string;
}
interface Meta {
  title: string;
  url: string;
  exportedAt: Date;
}
const core = (): Partial<PipeupGlobal> => (globalThis as { Pipeup?: Partial<PipeupGlobal> }).Pipeup ?? {};

const ATTR = "data-pipeup-save-to-github";
/** What fits in an address GitHub will take (browsers and servers allow more, but not much more than this is safe). */
export const MAX_ADDRESS = 6000;
const SAYS =
  "Opens GitHub (or the GitHub address the page names) in a new tab with this page's open comments filled in as a Markdown file, only after you confirm. You sign in to GitHub and commit it yourself; nothing is sent from here.";
const CSS = `.sgh-p{margin:0 0 10px}.sgh-note{color:var(--pu-faint)}
.sgh-box{margin:0 0 12px;padding:8px 10px;border:1px solid var(--pu-line);border-radius:8px;font-size:12.5px;overflow-wrap:anywhere}
.sgh-in{font:inherit;color:inherit;width:100%;box-sizing:border-box;padding:6px 8px;margin:0 0 10px;border:1px solid var(--pu-line);border-radius:8px;background:none}
.sgh-btns{display:flex;gap:8px;flex-wrap:wrap}
.sgh-btns button{font:inherit;color:inherit;background:none;cursor:pointer;padding:6px 12px;border:1px solid var(--pu-line);border-radius:8px;transition:background-color .2s var(--pu-ease),opacity .2s var(--pu-ease)}
.sgh-btns button:hover,.sgh-btns button:focus-visible{background:var(--pu-hover);outline:none}
.sgh-btns button:disabled{opacity:.5;cursor:default}.sgh-btns .sgh-go{color:var(--pu-accent)}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface Target {
  repo: string;
  branch: string;
  folder: string;
  host: string;
}

/** What the page names, checked: the repository (owner/name), a branch and folder, and the GitHub host. */
export function readTarget(
  get: (name: string) => string | null,
): Target | { demo: true } | { error: string } {
  const raw = get(ATTR)?.trim();
  if (!raw) return { error: "this page names no repository to save to" };
  if (raw === "demo:") return { demo: true };
  return parseTarget(raw, get(`${ATTR}-branch`), get(`${ATTR}-folder`), get(`${ATTR}-host`));
}

export function parseTarget(
  repo: string,
  branch?: string | null,
  folder?: string | null,
  host?: string | null,
): Target | { error: string } {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
    return { error: "the repository this page names isn't owner/name" };
  const b = (branch ?? "").trim() || "main";
  if (!/^[A-Za-z0-9_./-]+$/.test(b) || b.includes(".."))
    return { error: "the branch this page names isn't a branch name" };
  const f = ((folder ?? "").trim() || "reviews").replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9_./-]+$/.test(f) || f.includes(".."))
    return { error: "the folder this page names isn't a folder name" };
  const h = (host ?? "").trim() || "github.com";
  if (!/^[A-Za-z0-9.-]+(:\d+)?$/.test(h))
    return { error: "the GitHub host this page names isn't a host name" };
  return { repo, branch: b, folder: f, host: h };
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Where the file goes: <folder>/<page>/<time>-<who>.md, from the page's name and the time (the reviewer can rename it in GitHub). */
export function filePath(
  folder: string,
  pageUrl: string,
  title: string,
  who: string,
  now = new Date(),
): string {
  let page = "";
  try {
    page = slug(
      new URL(pageUrl).pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/\.[a-z]+$/i, "") ?? "",
    );
  } catch {
    /* an address that doesn't parse: the title stands in */
  }
  page = page || slug(title) || "page";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  return `${folder}/${page}/${stamp}-${slug(who) || "reviewer"}.md`;
}

/** GitHub's own "new file" page, with the file name and (when it fits in an address) the content filled in. */
export function newFileUrl(t: Target, path: string, markdown: string): { url: string; filled: boolean } {
  const base = `https://${t.host}/${t.repo}/new/${encodeURIComponent(t.branch).replace(/%2F/g, "/")}`;
  const full = `${base}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(markdown)}`;
  if (full.length <= MAX_ADDRESS) return { url: full, filled: true };
  return { url: `${base}?filename=${encodeURIComponent(path)}`, filled: false };
}

export function createAddon(): PipeupAddon {
  return {
    id: "save-to-github",
    api: 1,
    version: "0.1.0",
    needs: ["menu", "panel", "styles"],
    network: { when: "after-consent", to: ["github.com"], says: SAYS },
    setup(host) {
      const t = readTarget((n) => document.documentElement.getAttribute(n));
      if ("error" in t) return host.off(t.error);
      const demo = "demo" in t;
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
      const who = (): string => host.document.name || core().animalName?.(host.document.me) || "reviewer";

      const ask = (): void => {
        panel?.close();
        const n = open().length;
        const box = el("div");
        let target: Target | null = demo ? null : (t as Target);
        const repoIn = el("input", "sgh-in");
        repoIn.placeholder = "A repository to try it on (owner/name)";
        repoIn.setAttribute("aria-label", "A repository to try it on");
        const say = el("p", "sgh-p sgh-note");
        const box2 = el("div", "sgh-box");
        const go = el("button", "sgh-go", "Open GitHub");
        const no = el("button", "", "Cancel");
        go.type = no.type = "button";
        const describe = (): void => {
          if (demo) {
            const r = parseTarget(repoIn.value.trim());
            target = "error" in r ? null : r;
          }
          go.disabled = !n || !target;
          if (!target) {
            box2.textContent = "Name a repository above, and this shows the address it would open.";
            return;
          }
          const path = filePath(target.folder, location.href, document.title, who());
          const { url, filled } = newFileUrl(target, path, markdown());
          box2.textContent = `${path} in ${target.repo} (${target.branch}) on ${target.host}${filled ? "" : "\nToo long for an address: the Markdown will be copied for you to paste."}`;
          box2.dataset.url = url;
          box2.dataset.filled = String(filled);
        };
        box.append(
          el(
            "p",
            "sgh-p",
            `This will open GitHub in a new tab with ${n} open comment${n === 1 ? "" : "s"} from this page filled in as a Markdown file:`,
          ),
        );
        if (demo) {
          repoIn.addEventListener("input", describe);
          box.append(repoIn);
        }
        box.append(
          box2,
          el(
            "p",
            "sgh-p sgh-note",
            "You then sign in to GitHub and press its commit button yourself (or propose the change, if you can't write to the repository). Nothing is sent from here, and no token is used.",
          ),
          say,
        );
        describe();
        const btns = el("div", "sgh-btns");
        btns.append(go, no);
        box.append(btns);
        no.onclick = () => panel?.close();
        go.onclick = async () => {
          describe();
          const url = box2.dataset.url;
          if (!url || !target) return;
          if (box2.dataset.filled === "false") {
            try {
              await navigator.clipboard.writeText(markdown());
              say.textContent = "The review is copied. In GitHub's page, paste it into the file.";
            } catch {
              say.textContent =
                "Couldn't copy the review: use Copy as Markdown in Pipeup's menu, then paste it into GitHub's page.";
            }
          } else say.textContent = "Opened GitHub in a new tab.";
          window.open(url, "_blank", "noopener");
          no.textContent = "Close";
        };
        panel = host.openPanel(box, { label: "Save to GitHub", onClose: () => (panel = undefined) });
      };

      const row = host.addMenuItem({
        id: "save",
        icon: ["M12 3v12", "M7 10l5 5 5-5", "M5 20h14"],
        label: () => "Save to GitHub",
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
