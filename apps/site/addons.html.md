# Pipeup add-ons

Pipeup on its own needs none of these, and sends nothing anywhere. An add-on is one extra script the page's author chooses; each asks reviewers first. In beta.

Add one only when the author asks for that feature, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file: there is nothing to download, run or look up. Keep `data-pipeup-doc` exactly as it is.

## Share

Comments reach everyone who has the page.

- **Sends**: sealed comments, to a service the author picks: a PrivateBin or their own mailbox. The service can't read them.
- **Asks first**: nothing is shared until the reviewer chooses to.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.5.1/dist/share.min.js"></script>`, and put the sharing address the author gives you on the `<html>` element as `data-pipeup-share="<address>"`, exactly as written. Ask the author for the address; don't make one up or try it.

## Voice

Dictate a comment instead of typing it.

- **Sends**: nothing of its own. The browser's own speech engine does the listening, and in some browsers it sends the audio to its maker.
- **Asks first**: a short note, then the browser's own microphone prompt.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/voice@0.5.1/dist/voice.min.js"></script>`.

## Live

See who else is on the page, and where.

- **Sends**: presence and comments, browser to browser. Public relays only introduce the reviewers to each other.
- **Asks first**: each reviewer, before anything connects.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/live@0.5.1/dist/live.min.js"></script>`.

[Back to the home page as Markdown](index.html.md) · [llms.txt](llms.txt)
