# Pipeup: feedback for any HTML

People comment right on your page: documents, decks or whole sites. No accounts, no servers. Each person's comments stay in their own browser until they send them to you.

The home page shows Pipeup on a document, slides, a website and with the keyboard, beside four steps that take you from your HTML file to your reviewers and back:

1. **Copy the prompt** (the Copy prompt button). One copy per page: each copy carries a key of its own.
2. **Paste it into your AI** with your HTML file: Claude, ChatGPT or any chat. Save the new file it gives back.
3. **Send that file** with the note your AI writes. People open it in a web browser, comment, and send you their comments. How reviewing works: [add-comments.html](https://pipeup-ai.github.io/pipeup/add-comments.html.md).
4. **Paste their comments into your AI.** It makes the changes and gives you the file again.

Try it on this page: press Shift+Option+C (Shift+Alt+C on Windows and Linux) and click on anything. On a touch screen, tap the comment button in the bottom-right corner, choose Start commenting, then tap anything.

## What your AI does

The prompt asks your AI to add one line to your HTML file, and a key that keeps this page's comments apart from your other pages. The key isn't tied to an account: it travels with the page, so anyone who has the page has it. Nothing else on the page changes, and there is nothing to install. If your AI is making the page, add the prompt to your request.

The prompt, in short (the page shows it in full, with the key its copy carries):

1. Add `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>` just before `</body>`, editing only the HTML file.
2. Add `data-pipeup-doc="<key>"` to `<html>` (a key made with `await Pipeup.newDocumentAttribute()`) and keep it exactly as it is from then on. The key is for this one page: every other page needs a key of its own, or their comments mix.
3. Mark stable blocks with `data-pipeup-id`, label charts and images with `data-pipeup-label`, mark navigation with `data-pipeup-ignore`, and don't change the page's layout.
4. When it's done: if it can't change the file on your computer, give you the whole new file to download and remind you to share that one, not the one you had; tell you to open it in your web browser and check for the comment button in the bottom-right corner; and give you the note for reviewers, word for word.
5. Later, apply each comment you paste, say what it changed, and give you the whole file again.

Your AI gives you back the new file to save, and a note to send with it. **Open the new file in your web browser before you send it:** a comment button in the bottom-right corner means it worked.

If your AI didn't write the note, send this one:

> You can comment right on this page. Open the file in a web browser such as Chrome, Safari, Edge or Firefox; a preview inside email, chat or a drive may not show the comments. Click the comment button in the bottom-right corner and choose Start commenting, then click anything, or select some words, and type. On a phone, tap instead of click. When you're done, click the comment button again, choose Copy comments › As Markdown and paste it into a reply to me. Your comments stay in your browser until you send them. Help: https://pipeup-ai.github.io/pipeup/add-comments.html

Each person sends you their own comments, and nobody sees anyone else's. Paste them into the same chat and your AI makes the changes. Gathering everyone's comments in one place needs a service to hold them: see [Share](https://pipeup-ai.github.io/pipeup/addons/share.html.md).

## The details

What Pipeup sends, what it does to your page, and how to add it without an AI.

- **Adding it by hand.** Put these two lines on your page: `data-pipeup-doc="<key>"` on the `<html>` element, and `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>` just before `</body>`. The script line alone starts Pipeup; the key keeps the page's comments with it when the file is moved or renamed, and each page needs its own. Readers' browsers load the file from jsDelivr, pinned to this version by its integrity hash, or you can keep [a copy of pipeup.min.js](https://pipeup-ai.github.io/pipeup/pipeup.min.js) next to your page.
- **What it sends.** Nothing. Comments stay in each reviewer's browser and leave only when they copy and send them. Clearing browser data, or closing a private window, removes comments not yet sent. Add-ons that send anything say what, and to whom, on their own pages ([add-ons](https://pipeup-ai.github.io/pipeup/addons.html.md)).
- **What it does to your page.** It adds one element of its own, with everything it draws inside it, and never restyles or moves your page. It works on pages a framework renders and keeps up when a single-page app changes route.
- **Using Claude Code or Codex?** Install the skills once and "add comments to this page" is enough: `npx --yes pipeup@0 skills install` says what it will write and asks first; `npx --yes pipeup@0 skills remove` takes them out. Claude Code can also use `/plugin install pipeup --marketplace pipeup-ai/pipeup`.
- **Licence and version.** Free and open source under the MIT licence; source and releases are on [GitHub](https://github.com/pipeup-ai/pipeup). Version {{VERSION}} ([what changed](https://github.com/pipeup-ai/pipeup/releases/tag/v{{VERSION}})): one file of about {{SIZE}} compressed, with no dependencies.

[Try it on a page](https://pipeup-ai.github.io/pipeup/try/document.html)

## For agents

- [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt): a short guide.
- [llms-full.txt](https://pipeup-ai.github.io/pipeup/llms-full.txt): the guide and all three skills in one file.
- Skills: [pipeup-integrate](https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md), [pipeup-summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md), [pipeup-apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md), [pipeup-send-to-git-setup](https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md) (a company saving reviews into its own Git).
- Install the skills once: Claude Code `/plugin install pipeup --marketplace pipeup-ai/pipeup`, or `npx --yes pipeup@0 skills install` for Claude Code and Codex (it says what it writes and asks first). Without an install, paste the prompt.
- Making your own add-on: [guide](https://pipeup-ai.github.io/pipeup/addons-guide.html.md). Add one safely: pin it with its integrity hash, list it in `data-pipeup-addons` on `<html>`, and tell the author about a Content-Security-Policy (best effort).
- Add-ons: [addons.html](https://pipeup-ai.github.io/pipeup/addons.html), a card for each add-on; each has its own page and Markdown copy, listed in [addons.html.md](https://pipeup-ai.github.io/pipeup/addons.html.md).
- Source: [github.com/pipeup-ai/pipeup](https://github.com/pipeup-ai/pipeup).
