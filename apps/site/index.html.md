# Pipeup: feedback for any HTML

People comment right on your page: documents, decks or whole sites. No accounts, no servers. Their feedback comes back ready for your AI to act on.

- **One file**, about 37 KB, with no dependencies.
- **Works from disk**: no server needed.
- **Nothing to install, and it stays on your device**: one script goes in your HTML file (or loads from a CDN), and an AI agent can add it. Comments stay in the reviewer's own browser and are never sent to any server; feedback leaves only when the reviewer copies it (Copy as Markdown or Copy as Text) and sends it themselves.
- **Try it on this site**: press Shift+Option+C (Shift+Alt+C on Windows and Linux) and click on anything, or select some words.

## Get started

**Copy prompt** gives you a prompt to paste into Claude, Codex or another coding agent with your HTML file open. It asks the agent to:

1. Add the pinned script tag `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.1/dist/pipeup.min.js"></script>` just before `</body>`, editing only the HTML file (nothing to download or run).
2. Add `data-pipeup-doc="<key>"` to the `<html>` element (a key made with `await Pipeup.newDocumentAttribute()`), and keep it exactly as it is from then on.
3. Mark stable blocks with `data-pipeup-id`, label charts and images with `data-pipeup-label`, and mark navigation and toolbars with `data-pipeup-ignore`.
4. Leave the page's layout and styling alone.

**Install** offers:

- **Claude Code**: a command that installs the skill into `~/.claude/skills/pipeup-integrate/`.
- **Codex**: a command that adds the skill to `AGENTS.md`.
- **Any other agent**: point it at [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt).
- **Script tag** and a **download** of [pipeup.min.js](https://pipeup-ai.github.io/pipeup/pipeup.min.js) for adding it by hand.

## How reviewers comment

- Select words and click the comment icon, or press Shift+Option+C and click any block. Option-click (Alt-click) drops a pin.
- With the keyboard: press Shift+Option+C (Shift+Alt+C), then Tab moves between blocks, ↑ and ↓ step out and back in, Enter comments, Shift+Enter opens a block's comments, Pin pins it, and Esc finishes. Screen readers hear each block's name and words.
- Comments stay attached to what they're about when the page changes.
- Comments are kept in the reviewer's browser. **Copy as Markdown** copies them as Markdown that says exactly where each one is, ready to send to the author or paste into an AI agent; **Copy as Text** gives just the words.

## For agents

- [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt): a short guide.
- [llms-full.txt](https://pipeup-ai.github.io/pipeup/llms-full.txt): the guide and all three skills in one file.
- Skills: [pipeup-integrate](https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md), [pipeup-summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md), [pipeup-apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md).
- Source: [github.com/pipeup-ai/pipeup](https://github.com/pipeup-ai/pipeup).
