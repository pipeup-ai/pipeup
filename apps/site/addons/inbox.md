# Pipeup add-on: Inbox

Tells people they were mentioned, even on pages they haven't opened: a note, sealed so only they can read it, left at an inbox service you name.

- **Sends**: only after each reviewer switches **Mentions by inbox** on: a sealed note for each person they mention, and a check of their own inbox, at your inbox service. The service sees that a note arrived, its size and when, and a network address, never who it is from or what it says.
- **Needs**: `data-pipeup-inbox="https://…"` on the page, and an inbox service: the reference mailbox server, `npx @pipeup/mailbox`.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/inbox@0.8.0-beta.2/dist/inbox.min.js" integrity="{{SRI:inbox}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/inbox.html) · [llms.txt](../llms.txt)
