# Pipeup add-on: Share

Comments reach everyone who has the page.

- **Sends**: sealed comments, to a service the author picks: a PrivateBin or their own mailbox (see below). The service can't read them.
- **Asks first**: nothing is shared until the reviewer chooses to.
- **Try it**: on your own computer, with a local demo and its own sharing service (no online try page, so nothing goes to a public service).
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.9.0/dist/share.min.js" integrity="{{SRI:share}}" crossorigin="anonymous"></script>`, and put the sharing address the author gives you on the `<html>` element as `data-pipeup-share="<address>"`, exactly as written. Ask the author for the address; don't make one up or try it.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/share.html) · [llms.txt](../llms.txt)
