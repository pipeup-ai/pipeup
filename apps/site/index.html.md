# Pipeup: feedback for any HTML

People comment right on your page: documents, decks or whole sites. No accounts, no servers. Comments stay in each person's browser until they send them to you.

The home page shows Pipeup on a document, slides, a website and with the keyboard, beside four steps:

1. **Copy the prompt** (the Copy prompt button). One copy per page: each copy carries a key of its own. What it says: [What your AI does](https://pipeup-ai.github.io/pipeup/prompt.html.md).
2. **Paste it into your AI** with your HTML file: Claude, ChatGPT or any chat. Save the file it gives back.
3. **Send that file** with your AI's note. People comment in their browser and send them back. How reviewing works: [the reviewer help page](https://pipeup-ai.github.io/pipeup/add-comments.html.md).
4. **Paste their comments into your AI.** It makes the changes.

Try it on this page: press Shift+Option+C (Shift+Alt+C on Windows and Linux) and click anything. On a touch screen, tap the comment button in the bottom-right corner, choose Start commenting, then tap anything.

Adding it yourself? The script tag, licence and size: [The details](https://pipeup-ai.github.io/pipeup/details.html.md).

[Try it on a page](https://pipeup-ai.github.io/pipeup/try/document.html)

## For agents

- [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt): a short guide.
- [llms-full.txt](https://pipeup-ai.github.io/pipeup/llms-full.txt): the guide and all three skills in one file.
- Skills: [pipeup-integrate](https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md), [pipeup-summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md), [pipeup-apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md), [pipeup-send-to-git-setup](https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md) (a company saving reviews into its own Git).
- Install the skills once: Claude Code `/plugin install pipeup --marketplace pipeup-ai/pipeup`, or `npx --yes pipeup@0 skills install` for Claude Code and Codex (it says what it writes and asks first). Without an install, paste the prompt.
- Making your own add-on: [guide](https://pipeup-ai.github.io/pipeup/addons-guide.html.md). Add one safely: pin it with its integrity hash, list it in `data-pipeup-addons` on `<html>`, and tell the author about a Content-Security-Policy (best effort).
- Add-ons: [addons.html](https://pipeup-ai.github.io/pipeup/addons.html), a card for each add-on; each has its own page and Markdown copy, listed in [addons.html.md](https://pipeup-ai.github.io/pipeup/addons.html.md).
- Source: [github.com/pipeup-ai/pipeup](https://github.com/pipeup-ai/pipeup).
