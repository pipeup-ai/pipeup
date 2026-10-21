export interface PromptMeta {
  title: string;
  url: string;
  /** The page's document id (never its key), so an agent can sign replies for this page without its file. */
  doc: string;
  /** The page's open comments, as Pipeup's Markdown for agents (each thread with its id). */
  comments: string;
  /** How many open comments it carries, and how many resolved ones it left out. */
  open: number;
  resolved: number;
  /** The edition the page names, and how many open comments on earlier editions were left out; "" and 0 for none. */
  edition?: string;
  earlier?: number;
  /** The replies file's address, when the page can have one. */
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

const one = (s: string) => s.replace(/\s+/g, " ").trim();

/** Copy for my agent: the open comments, where they live, and how to answer them, in one paste. */
export function agentPrompt(m: PromptMeta): string {
  const { cli, fallback } = agentCommand(m.version);
  // A pre-release's guide is the pre-release site's.
  const site = `https://pipeup-ai.github.io/pipeup/${m.version?.includes("-") ? "next/" : ""}`;
  const { page, served } = pageToAnswer(m.url, m.file);
  const arg = served ? `<the HTML file your site serves at ${page}>` : page;
  const print = `\`${cli} reply --print --doc ${m.doc} --thread <thread id> "what you changed and where" --addressed "short note"\``;
  return [
    `Please act on my review comments on ${one(m.title)} (${one(m.url)}). The page uses Pipeup.`,
    "The comments were left in my browser. They are not in the page's file, so don't look for them there. Everything you need is below.",
    "",
    `## ${m.open} open comment${m.open === 1 ? "" : "s"}${m.edition ? ` on the ${m.edition} edition` : ""}`,
    "",
    m.comments.trim(),
    ...(m.resolved || m.earlier
      ? [
          "",
          `(${[
            m.resolved ? `${m.resolved} resolved comment${m.resolved === 1 ? "" : "s"}` : "",
            m.earlier ? `${m.earlier} open comment${m.earlier === 1 ? "" : "s"} on earlier editions` : "",
          ]
            .filter(Boolean)
            .join(" and ")} left out.)`,
        ]
      : []),
    "",
    "## How to answer",
    "",
    "- For each thread, make the change I approved, or say why you didn't. Answer a question with an answer. Ask me before changing anything I haven't approved.",
    "- Reply in one block I can paste back into the page with Paste my agent's replies, and tell me what you changed and where. Don't say the page was updated unless you updated it.",
    "",
    "```pipeup-replies",
    "agent: <your name>",
    "thread: <thread id>",
    "reply: what you changed and where",
    "addressed: short note, only if you made the change",
    "```",
    "",
    m.listed
      ? `- This page lists an agent's key. If it's yours, sign the block so it shows as yours, not as pasted by me: ${print} prints each reply signed with the key you keep (in ~/.pipeup/agent.json). Without your key, send the same block unsigned.`
      : `- If you keep a Pipeup key between sessions, sign the block with ${print}, and ask me whether to list you on the page (\`${cli} agent\` prints the line to add). If you can't keep a key, don't ask to be listed: the plain block works.`,
    ...(m.file
      ? [
          `- You're on this computer, with a live link running: \`${cli} comments ${m.file}\` reads the comments and \`${cli} reply --page ${arg} --thread <thread id> "…" --addressed "…"\` answers in the page by itself.`,
        ]
      : m.replies
        ? [
            `- If you can write next to the page on this computer, \`${cli} reply --page ${arg} --thread <thread id> "…" --addressed "…"\` writes ${one(placeOf(m.replies))}, and your replies appear by themselves. Pass the HTML file that runs Pipeup, not a file it shows.`,
          ]
        : []),
    ...((m.file || m.replies) && !m.listed
      ? [
          `- The page doesn't list you yet. Ask me first; after my yes, run \`${cli} agent --name <your name> --page ${arg} --yes\`.`,
        ]
      : []),
    ...(fallback
      ? [
          `- If npm refuses ${cli.split(" ").at(-1)}, use ${fallback.split(" ").at(-1)}: it answers these commands the same way.`,
        ]
      : []),
    "- Only mark a thread addressed. Never resolve, reopen, edit or delete: I close threads. Never answer as me, and keep your key out of the page and its folder.",
    "",
    `Guide: ${site}skills/pipeup-apply/SKILL.md`,
  ].join("\n");
}

/** What Copy that request copies, when a paste had no replies block in it. */
export const askForBlock = (): string =>
  [
    "Please send your replies again in one block I can paste into the page, like this:",
    "",
    "```pipeup-replies",
    "agent: <your name>",
    "thread: <thread id>",
    "reply: what you changed and where",
    "addressed: short note, only if you made the change",
    "```",
  ].join("\n");
