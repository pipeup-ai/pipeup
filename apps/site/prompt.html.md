# What your AI does

The prompt asks it to add Pipeup to your HTML file and change nothing else. There is nothing to install.

- It adds one script line, and a key that keeps this page's comments apart from your other pages.
- It gives you back the whole file. **Open it in your web browser:** a comment button in the bottom-right corner means it worked.
- It writes a note for your reviewers. If it didn't, send this one:

  > You can comment right on this page. Open the file in a web browser such as Chrome, Safari, Edge or Firefox; a preview inside email, chat or a drive may not show the comments. Click the comment button in the bottom-right corner and choose Start commenting, then click anything, or select some words, and type. On a phone, tap instead of click. When you're done, click the comment button again, choose Copy comments › As Markdown and paste it into a reply to me. Your comments stay in your browser until you send them. Help: https://pipeup-ai.github.io/pipeup/add-comments.html

- When you paste the comments people send you, it makes the changes and gives you the file again.

Each person sends you their own comments. To gather everyone's in one place, see [Share](https://pipeup-ai.github.io/pipeup/addons/share.html.md).

## The prompt

The page shows it in full, with the key its copy carries; the home page's **Copy prompt** copies the same words. In short, it asks the AI to:

1. Add `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.9.0/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>` just before `</body>`, editing only the HTML file.
2. Add `data-pipeup-doc="<key>"` to `<html>` (a key made with `await Pipeup.newDocumentAttribute()`) and keep it exactly as it is from then on. The key is for this one page: every other page needs a key of its own, or their comments mix.
3. Mark stable blocks with `data-pipeup-id`, label charts and images with `data-pipeup-label`, mark navigation with `data-pipeup-ignore`, and not change the page's layout.
4. Add the [agents add-on](https://pipeup-ai.github.io/pipeup/addons/agents.html.md) (an AI agent answering comments in the page) or the [inline add-on](https://pipeup-ai.github.io/pipeup/addons/inline.html.md) (questions asked right in the content) only if you ask; if you asked for neither, say in one line that both exist.
5. When it's done: if it can't change the file on your computer, give you the whole new file to download and remind you to share that one, not the one you had; tell you to open it in your web browser and check for the comment button in the bottom-right corner; and give you the note for reviewers, word for word.
6. Later, apply each comment you paste, say what it changed, and give you the whole file again.

[Back to the home page](https://pipeup-ai.github.io/pipeup/index.html.md)
