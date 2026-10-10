# Add comments to an HTML

Someone sent you an HTML file and you want to give feedback. Comment on it right in your browser. If it doesn't have comments built in yet, your AI assistant can add them in a minute.

1. Open the file in your browser. If you see a small round comment button at the bottom right, skip to step 3.
2. No button? Paste the **Copy prompt** text into an AI assistant (Claude, ChatGPT, Codex) along with the file. It adds Pipeup to your copy: the pinned script tag `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js"></script>` just before `</body>`, a `data-pipeup-doc` attribute on `<html>` (kept exactly as it is if the file already has one), and no change to the page's layout. It edits only the HTML file.
3. Comment: select words and click the comment icon, or press Shift+Option+C (Shift+Alt+C) and click any block.
4. Send it back: **Copy as Markdown** copies every comment with exactly where it is. Paste it in a message or email to whoever sent the file.

Comments stay in your browser until you copy and send them.

[Back to the home page](index.html.md)
