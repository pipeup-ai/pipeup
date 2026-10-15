# Pipeup add-on: Emoji

The full set of emoji for reactions: search, the groups phones use, recently used and a skin tone. Pipeup alone offers a quick row of six.

- **Sends**: nothing. The emoji are part of the script.
- **Asks first**: nothing to ask; it only adds a More button to the reaction row.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/emoji@0.8.0-beta.1/dist/emoji.min.js" integrity="{{SRI:emoji}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/emoji.html) · [llms.txt](../llms.txt)
