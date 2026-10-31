# Someone sent you a page to comment on

Comment right on it in your web browser, then send your comments back. No account needed.

1. **Open it in your web browser:** Chrome, Safari, Edge or Firefox. A preview inside email, chat or a drive may not show the comment button.
2. **Turn on commenting:** click the comment button in the bottom-right corner, then Start commenting, or press Shift+Option+C (Shift+Alt+C on Windows and Linux). On a touch screen, tap the comment button, then Start commenting.
3. **Comment:** click anything, or select some words, and type. On a touch screen, tap anything, or press and hold on some words, and type.
4. **Send them back:** click the comment button, choose Copy comments › As Markdown, and paste it into a reply to whoever sent the page.

Your comments stay in this browser until you send them, and nobody else sees them. Clearing your browser's data, or closing a private window, removes them, so send them first.

## No comment button?

Ask whoever sent it for the version with comments built in, or add it to your own copy, one of two ways:

- **Ask an AI to add it**, only if you're allowed to share the file with an AI. The page's **Copy prompt** asks it to add `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>` just before `</body>`, and a `data-pipeup-doc` key on `<html>` if the file has none (kept exactly as it is if it has one), editing only the HTML file and changing nothing else. If it can't change the file on your computer, it gives you the whole new file to download, and tells you to open it in your web browser and check for the comment button in the bottom-right corner.
- **Paste the script line yourself** just before `</body>` in the file: `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>`. Then open the file in your web browser.

[Back to the home page](https://pipeup-ai.github.io/pipeup/index.html.md)
