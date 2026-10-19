export interface PromptMeta {
  title: string;
  url: string;
  /** Where replies go (the replies file's address), or null when the page can't have one. */
  replies: string | null;
  /** The author has listed an agent for this page. */
  listed: boolean;
  /** The page file on this computer when a live link is running, else "". */
  file?: string;
  /** The version of Pipeup the page runs: its commands ask for any release of its major version (a pre-release, itself). */
  version?: string;
}

/**
 * The command an agent runs: it never stops to ask (an agent can't answer), and asks npm for any release of the page's
 * major version, not only its exact one, since some computers accept only packages a few days old and every release
 * from 0.6 answers these commands the same way. A pre-release page names its own pre-release.
 */
export function agentCommand(version?: string): { cli: string; fallback: string | null } {
  if (!version) return { cli: "npx --yes pipeup@0", fallback: null };
  const major = version.split(".")[0] ?? "0";
  const any = `npx --yes pipeup@${major}`;
  return version.includes("-")
    ? { cli: `npx --yes pipeup@${version}`, fallback: any }
    : { cli: any, fallback: null };
}

/**
 * The page to answer on, as the reply command wants it: the HTML file that runs Pipeup, never a file it shows (a viewer
 * at viewer.html?file=notes.md is viewer.html). Opened from this computer, its full path; served from a site, the
 * address it is served at.
 */
export function pageToAnswer(url: string, file = ""): { page: string; served: boolean } {
  if (file) return { page: file, served: false };
  try {
    const u = new URL(url);
    let path = decodeURIComponent(u.pathname);
    if (path.endsWith("/")) path += "index.html";
    if (u.protocol === "file:")
      return { page: /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path, served: false };
    return { page: path, served: true };
  } catch {
    return { page: "<the page's HTML file>", served: false };
  }
}

/** Where the replies go, as a person or an agent would write it: a path on this computer, else the address. */
const placeOf = (replies: string) => {
  try {
    const u = new URL(replies);
    return u.protocol === "file:" ? decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:\/)/, "$1") : u.href;
  } catch {
    return replies;
  }
};

/** The short instruction the menu copies for an agent: where the comments are, how to answer, what never to do. */
export function agentPrompt(m: PromptMeta): string {
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  const { cli, fallback } = agentCommand(m.version);
  // A pre-release's guide is the pre-release site's.
  const site = `https://pipeup-ai.github.io/pipeup/${m.version?.includes("-") ? "next/" : ""}`;
  const { page, served } = pageToAnswer(m.url, m.file);
  const arg = served ? `<the HTML file your site serves at ${page}>` : page;
  return [
    `Act on the review comments on this page, which uses Pipeup: ${one(m.title)} (${one(m.url)}).`,
    "",
    m.file
      ? `1. Read the comments: \`${cli} comments ${m.file}\` (add --all for resolved ones). If it says nothing is shared, ask me to switch on Share with my agent.`
      : "1. Read the comments. Open the page in a browser and run `await Pipeup.comments()`, then read `.markdown`. " +
        "If you can't run the page, ask me to paste its comments (Copy comments › As Markdown).",
    "2. Work through the open threads in order. For each, make the change I approved, or say why you didn't. " +
      "Ask me before changing anything I haven't approved, and answer a question with an answer.",
    m.replies
      ? `3. Answer in each thread: \`${cli} reply --page ${arg} --thread <Thread id> "what you changed and where" --addressed "short note"\`. ` +
        "Pass that file, the one that runs Pipeup, not a file it shows. " +
        `It writes ${one(placeOf(m.replies))}, which the page reads by itself.` +
        (m.listed
          ? ""
          : ` The page doesn't list you yet. Ask me first; after my yes, run \`${cli} agent --name <your name> --page ${arg} --yes\`.`) +
        (fallback
          ? ` If npm refuses ${cli.split(" ").at(-1)}, use ${fallback.split(" ").at(-1)}: it answers these commands the same way.`
          : "")
      : "3. Tell me what you would reply in each thread, in words I can paste.",
    "4. Only mark a thread addressed. Never resolve, reopen, edit or delete: I close threads. Keep your key out of the page and its folder, and never answer as me.",
    "",
    `Guide: ${site}skills/pipeup-apply/SKILL.md`,
  ].join("\n");
}
