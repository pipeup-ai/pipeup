# Pipeup add-ons

Pipeup on its own needs none of these, and sends nothing anywhere. An add-on is one extra script the page's author chooses; each asks reviewers first. In beta. Making your own? The guide is at https://github.com/pipeup-ai/pipeup/blob/main/docs/ADDONS_GUIDE.md.

Add one only when the author asks for that feature, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file: there is nothing to download, run or look up. Keep `data-pipeup-doc` exactly as it is.

## Share

Comments reach everyone who has the page.

- **Sends**: sealed comments, to a service the author picks: a PrivateBin or their own mailbox (see below). The service can't read them.
- **Asks first**: nothing is shared until the reviewer chooses to.
- **Try it**: on your own computer, with a local demo and its own sharing service (no online try page, so nothing goes to a public service).
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.5.3/dist/share.min.js"></script>`, and put the sharing address the author gives you on the `<html>` element as `data-pipeup-share="<address>"`, exactly as written. Ask the author for the address; don't make one up or try it.

## Voice

Dictate a comment instead of typing it.

- **Sends**: nothing of its own. The browser's own speech engine does the listening, and in some browsers it sends the audio to its maker.
- **Asks first**: a short note, then the browser's own microphone prompt.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/voice.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/voice@0.5.3/dist/voice.min.js"></script>`.

## Live

See who else is on the page, and where.

- **Sends**: presence and comments, browser to browser. Public relays only introduce the reviewers to each other.
- **Asks first**: each reviewer, before anything connects.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/live.html (open it in two browsers)
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/live@0.5.3/dist/live.min.js"></script>`.

## Assist

A small AI model on the reviewer's device reads the whole page and points to related parts of it.

- **Sends**: nothing. The model runs on the device, and the browser may download it once.
- **Asks first**: each reviewer, with the model, its size and what it reads, before it turns on.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/assist.html, or on slides: https://pipeup-ai.github.io/pipeup/try/assist-deck.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/assist@0.5.3/dist/assist.min.js"></script>`.

## Your own mailbox

A small server the author runs for Share, so even sealed comments stay inside their organisation. It is not a page script: nothing is added to the HTML for it, and the author gives you its address for `data-pipeup-share`.

- **Sends**: sealed comments, to a server the author runs. It holds ciphertext and never sees the key.
- **Needs**: Node 22 or newer, and an HTTPS proxy in front of it. Pipeup doesn't run a mailbox for anyone.
- **Run it**: `CREATE_TOKEN="$(openssl rand -base64 24)" DATA_DIR=./pipeup-mailbox npx @pipeup/mailbox`. Guide: https://github.com/pipeup-ai/pipeup/tree/main/services/mailbox#readme

[Back to the home page as Markdown](index.html.md) · [llms.txt](llms.txt)
