# Pipeup add-on: Voice

Dictate a comment instead of typing it.

- **Sends**: nothing of its own. The browser's own speech engine does the listening, and in some browsers it sends the audio to its maker.
- **Asks first**: a short note, then the browser's own microphone prompt.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/voice.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/voice@0.8.0-beta.5/dist/voice.min.js" integrity="{{SRI:voice}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/voice.html) · [llms.txt](../llms.txt)
