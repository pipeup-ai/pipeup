# Pipeup add-on: Assist

A small AI model on the reviewer's device reads the whole page and points to related parts of it.

- **Sends**: nothing. The model runs on the device, and the browser may download it once.
- **Asks first**: each reviewer, with the model, its size and what it reads, before it turns on.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/assist.html, or on slides: https://pipeup-ai.github.io/pipeup/try/assist-deck.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/assist@0.8.0/dist/assist.min.js" integrity="{{SRI:assist}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/assist.html) · [llms.txt](../llms.txt)
