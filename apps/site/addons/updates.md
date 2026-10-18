# Pipeup add-on: Updates

Tells you, on your own computer, when a newer Pipeup or a security fix is out.

- **Sends**: one request a day for the project's signed update list, only on your own computer (a file, localhost, or where you ask). GitHub Pages sees your network address; reviewers' browsers never ask.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/updates@0.8.0/dist/updates.min.js" integrity="{{SRI:updates}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/updates.html) · [llms.txt](../llms.txt)
