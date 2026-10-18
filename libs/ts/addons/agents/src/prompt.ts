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
  /** The replies file's address, when the page can have one. */
  replies: string | null;
  /** The author has listed an agent for this page. */
  listed: boolean;
  /** The page file on this computer when a live link is running, else "". */
  file?: string;
  /** The version of Pipeup the page runs: its commands name it, so `npx` fetches that one, not npm's stable release. */
  version?: string;
}

const one = (s: string) => s.replace(/\s+/g, " ").trim();

/** Copy for my agent: the open comments, where they live, and how to answer them, in one paste. */
export function agentPrompt(m: PromptMeta): string {
  const cli = m.version ? `npx pipeup@${m.version}` : "npx pipeup";
  // A pre-release's guide is the pre-release site's.
  const site = `https://pipeup-ai.github.io/pipeup/${m.version?.includes("-") ? "next/" : ""}`;
  const print = `\`${cli} reply --print --doc ${m.doc} --thread <thread id> "what you changed and where" --addressed "short note"\``;
  return [
    `Please act on my review comments on ${one(m.title)} (${one(m.url)}). The page uses Pipeup.`,
    "The comments were left in my browser. They are not in the page's file, so don't look for them there. Everything you need is below.",
    "",
    `## ${m.open} open comment${m.open === 1 ? "" : "s"}`,
    "",
    m.comments.trim(),
    ...(m.resolved ? ["", `(${m.resolved} resolved comment${m.resolved === 1 ? "" : "s"} left out.)`] : []),
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
      : `- If you keep a Pipeup key between sessions, sign the block with ${print}, and tell me the line to add so the page lists you (\`${cli} agent\` prints it). If you can't keep a key, don't ask to be listed: the plain block works.`,
    ...(m.file
      ? [
          `- You're on this computer, with a live link running: \`${cli} comments ${m.file}\` reads the comments and \`${cli} reply --page ${m.file} --thread <thread id> "…" --addressed "…"\` answers in the page by itself.`,
        ]
      : m.replies
        ? [
            `- If you can write next to the page on this computer, \`${cli} reply --page <the page's file> --thread <thread id> "…" --addressed "…"\` writes ${one(m.replies)} and your replies appear by themselves.`,
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
