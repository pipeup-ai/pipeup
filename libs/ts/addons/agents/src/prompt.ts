export interface PromptMeta {
  title: string;
  url: string;
  /** Where replies go (the replies file's address), or null when the page can't have one. */
  replies: string | null;
  /** The author has listed an agent for this page. */
  listed: boolean;
  /** The page file on this computer when a live link is running, else "". */
  file?: string;
}

/** The short instruction the menu copies for an agent: where the comments are, how to answer, what never to do. */
export function agentPrompt(m: PromptMeta): string {
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  return [
    `Act on the review comments on this page, which uses Pipeup: ${one(m.title)} (${one(m.url)}).`,
    "",
    m.file
      ? `1. Read the comments: \`npx pipeup comments ${m.file}\` (add --all for resolved ones). If it says nothing is shared, ask me to switch on Share with my agent.`
      : "1. Read the comments. Open the page in a browser and run `await Pipeup.comments()`, then read `.markdown`. " +
        "If you can't run the page, ask me to paste its comments (Copy comments › As Markdown).",
    "2. Work through the open threads in order. For each, make the change I approved, or say why you didn't. " +
      "Ask me before changing anything I haven't approved, and answer a question with an answer.",
    m.replies
      ? `3. Answer in each thread: \`npx pipeup reply --page ${m.file || "<the page's file>"} --thread <Thread id> "what you changed and where" --addressed "short note"\`. ` +
        `That writes ${one(m.replies)}.` +
        (m.listed
          ? ""
          : " The page doesn't list your key yet: run `npx pipeup agent --name <your name>` and tell me the attribute to add.")
      : "3. Tell me what you would reply in each thread, in words I can paste.",
    "4. Only mark a thread addressed. Never resolve, reopen, edit or delete: I close threads. Keep your key out of the page and its folder, and never answer as me.",
    "",
    "Guide: https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md",
  ].join("\n");
}
