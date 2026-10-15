# Pipeup add-on: Live

See who else is on the page, and where.

- **Sends**: presence and comments, browser to browser. Public relays only introduce the reviewers to each other.
- **Asks first**: each reviewer, before anything connects.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/live.html (open it in two browsers)
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/live@0.8.0-beta.3/dist/live.min.js" integrity="{{SRI:live}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/live.html) · [llms.txt](../llms.txt)
