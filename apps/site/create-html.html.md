# Create comment-enabled HTML

You are making an HTML page to share and you want feedback. Have your AI add Pipeup as it builds the page. Anyone you share it with can comment on it, and their feedback comes back ready for your AI to apply.

1. Install the Pipeup skills once (Claude Code: `/plugin install pipeup --marketplace pipeup-ai/pipeup`; Claude Code and Codex: `npx pipeup skills install`), or add the **Copy prompt** text to your request to your AI, or paste it afterwards. It puts Pipeup in the page: `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.4/dist/pipeup.min.js"></script>` just before `</body>`, `data-pipeup-doc="<key>"` on `<html>` (a key made with `await Pipeup.newDocumentAttribute()`, kept exactly as it is from then on), `data-pipeup-id` on stable blocks, `data-pipeup-label` on charts and images, `data-pipeup-ignore` on navigation and toolbars, and no change to layout.
2. Share the file: email, chat, a drive or a website. It works straight from the file.
3. People comment on the page.
4. Hand their comments to your AI: paste them (Copy as Markdown), or use **Copy a prompt for my agent** so it reads them, makes the changes you approve, and answers each comment in the page. It marks a comment addressed; you close it.

You decide how comments travel. By default they stay in each reviewer's browser until they send them.

[Back to the home page](index.html.md)
