# Pipeup add-on: Identity

Lets reviewers keep who they are across browsers and computers: **My identity** in the menu makes a recovery code or file, uses one on another computer, and shares a way to be reached.

- **Sends**: nothing. The recovery code stays on the reviewer's device unless they copy it or save it as a file themselves.
- **Needs**: nothing on the page. Without it, Pipeup works as before, and a reviewer who already has a portable identity keeps writing as it.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/identity@0.8.1/dist/identity.min.js" integrity="{{SRI:identity}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/identity.html) · [llms.txt](../llms.txt)
