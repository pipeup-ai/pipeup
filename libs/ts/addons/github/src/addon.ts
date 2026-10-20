import type { AddonHost, ItemHandle, PipeupAddon, SignedOp } from "pipeup";
import { pageSetting } from "@pipeup/kit";

const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const NAME = /^[A-Za-z0-9-]{1,39}$/;
const MARK = [
  "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z",
  "M9.6 9.8a.6.6 0 1 1-1.2 0a.6.6 0 1 1 1.2 0M15.6 9.8a.6.6 0 1 1-1.2 0a.6.6 0 1 1 1.2 0",
  "M8.6 14.2c1.9 2.1 4.9 2.1 6.8 0",
];

/** What this add-on borrows from the core's global. */
interface Core {
  setPeople(list: { ref: string; name: string }[]): void;
}
const core = (): Partial<Core> => (globalThis as { Pipeup?: Partial<Core> }).Pipeup ?? {};

/** The GitHub names the page's author listed: `data-pipeup-github-people="octocat hubot"`. */
const listed = (): string[] =>
  (pageSetting("data-pipeup-github-people") ?? "").split(/[\s,]+/).filter((n) => NAME.test(n));

/** Where the issue goes: `data-pipeup-github-repo="owner/repo"`, or "" when the page has none. */
export const repoOf = (html?: Element): string => {
  const v = pageSetting("data-pipeup-github-repo", html) ?? "";
  return REPO.test(v) ? v : "";
};

/** The GitHub name a mention points at: a supplied `gh:name` person, or a writer who shared `gh:name` as how to reach them. */
export function githubName(ref: string, contacts: ReadonlyMap<string, string>): string | null {
  const direct = /^gh:(.+)$/.exec(ref)?.[1];
  const via = /^gh:(.+)$/.exec(contacts.get(ref) ?? "")?.[1];
  const name = direct ?? via ?? null;
  return name && NAME.test(name) ? name : null;
}

/** The new-issue address for the people mentioned, with their @names and the comment's words and page. */
export function issueUrl(
  repo: string,
  names: readonly string[],
  who: string,
  text: string,
  title: string,
  page: string,
): string {
  const body = `${names.map((n) => `@${n}`).join(" ")}\n\n${who} mentioned you in a comment on "${title}":\n\n> ${text.replace(/\n/g, "\n> ")}\n\n${page}`;
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(`${who} mentioned you on ${title}`)}&body=${encodeURIComponent(body)}`;
}

export function createAddon(): PipeupAddon {
  return {
    id: "github",
    api: 1,
    version: "0.6.0",
    needs: ["menu", "notify"],
    network: {
      when: "after-consent",
      to: ["github.com"],
      says: "Only when you press Mention on GitHub: your browser opens GitHub's new-issue page with the person's @name and the comment's words filled in; nothing is sent until you submit it there.",
    },
    setup(host: AddonHost) {
      const repo = repoOf();
      if (!repo) return host.off('the page names no repository (data-pipeup-github-repo="owner/repo")');
      core().setPeople?.(listed().map((n) => ({ ref: `gh:${n}`, name: n })));
      /** Names waiting to be told, with the words that mentioned them. */
      let pending: { names: string[]; text: string } | null = null;
      let row: ItemHandle | null = null;
      const show = () => {
        row?.remove();
        row = null;
        if (!pending) return;
        const { names, text } = pending;
        row = host.addMenuItem({
          id: "mention",
          icon: MARK,
          label: () => `Mention ${names.map((n) => `@${n}`).join(" ")} on GitHub`,
          hint: () =>
            "Opens GitHub's new-issue page with their name and your words filled in; nothing is sent until you submit it",
          select: () => {
            window.open(
              issueUrl(repo, names, host.document.name || "Someone", text, document.title, location.href),
              "_blank",
              "noopener,noreferrer",
            );
            pending = null;
            show();
          },
        });
        host.notify(`Mention ${names.map((n) => `@${n}`).join(" ")} on GitHub? It's in the menu.`);
      };
      const off = host.document.onChange((_threads, added: readonly SignedOp[], source) => {
        if (source !== "local") return;
        for (const { body } of added) {
          if (
            body.author !== host.document.me ||
            !body.mentions?.length ||
            (body.kind !== "create" && body.kind !== "reply")
          )
            continue;
          const names = [
            ...new Set(
              body.mentions
                .map((m) => githubName(m.ref, host.document.contacts()))
                .filter((n): n is string => !!n),
            ),
          ];
          if (names.length) {
            pending = { names, text: body.text ?? "" };
            show();
          }
        }
      });
      return () => {
        off();
        row?.remove();
      };
    },
  };
}
