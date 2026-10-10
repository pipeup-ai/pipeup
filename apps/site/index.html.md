# Pipeup: feedback for any HTML

People comment right on an HTML page, and send their comments back. No accounts, no servers. Their feedback comes back ready for your AI to act on.

- **One file**, about 37 KB, with no dependencies.
- **Works from disk**: no server needed.
- **Nothing to install, and it stays on your device**: one script goes in your HTML file (or loads from a CDN), and an AI agent can add it. Comments stay in the reviewer's own browser and are never sent to any server; feedback leaves only when the reviewer copies it (Copy as Markdown or Copy as Text) and sends it themselves.
- **Try it on this site**: press Shift+Option+C (Shift+Alt+C on Windows and Linux) and click on anything, or select some words.

On the home page, the first screen shows Pipeup on a document, slides, a website and with the keyboard, and two buttons: **1. Add comments to an HTML** and **2. Create comment-enabled HTML**. Each scrolls to its walkthrough below.

## 1. Add comments to an HTML (someone sent you an HTML file)

You want to read it and give feedback.

1. Open the file in your browser. If you see a small round comment button at the bottom right, skip to step 3.
2. No button? Paste the **Copy prompt** text into an AI assistant (Claude, ChatGPT, Codex) along with the file. It adds Pipeup to your copy: the pinned script tag `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js"></script>` just before `</body>`, a `data-pipeup-doc` attribute on `<html>` (kept exactly as it is if the file already has one), and no change to the page's layout. It edits only the HTML file.
3. Comment: select words and click the comment icon, or press Shift+Option+C (Shift+Alt+C) and click any block. With the keyboard: Tab moves between blocks, Enter comments, Esc finishes.
4. Send it back: **Copy as Markdown** copies every comment with exactly where it is. Paste it in a message or email to whoever sent the file.

Comments stay in your browser until you copy and send them.

## 2. Create comment-enabled HTML (you are making a page to share)

You want feedback on it.

1. Add the **Copy prompt** text to your request to your AI, or paste it afterwards. It puts Pipeup in the page: the script tag above, `data-pipeup-doc="<key>"` on `<html>` (a key made with `await Pipeup.newDocumentAttribute()`, kept exactly as it is from then on), `data-pipeup-id` on stable blocks, `data-pipeup-label` on charts and images, `data-pipeup-ignore` on navigation and toolbars, and no change to layout.
2. Share the file: email, chat, a drive or a website. It works straight from the file.
3. People comment on the page.
4. Paste their comments (Copy as Markdown) into your AI: each one says where it is, so your AI applies it without guessing.

You decide how comments travel. By default they stay in each reviewer's browser until they send them.

[Try it on a page](https://pipeup-ai.github.io/pipeup/try/document.html)

## For agents

- [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt): a short guide.
- [llms-full.txt](https://pipeup-ai.github.io/pipeup/llms-full.txt): the guide and all three skills in one file.
- Skills: [pipeup-integrate](https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md), [pipeup-summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md), [pipeup-apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md).
- Install the skill: Claude Code: `mkdir -p ~/.claude/skills/pipeup-integrate && curl -fsSL https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md -o ~/.claude/skills/pipeup-integrate/SKILL.md`. Codex: `curl -fsSL https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md >> AGENTS.md`.
- Add-ons: [addons.html](https://pipeup-ai.github.io/pipeup/addons.html).
- Source: [github.com/pipeup-ai/pipeup](https://github.com/pipeup-ai/pipeup).
