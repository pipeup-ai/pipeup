# Pipeup add-on: Agents

Lets an AI agent answer comments: it shows the replies the agent wrote into a replies file next to the page, and is the page's side of the live link that `npx --yes pipeup@0 watch` starts. Add it when you list an agent with `data-pipeup-agents`.

- **Sends**: nothing, until you switch **Share with my agent** on (only on a page shown with `pipeup watch`); then this page's comments go to the program on your own computer. Nothing leaves the computer.
- **Asks first**: you, with a switch that is off every time the page loads.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/agents@0.9.0/dist/agents.min.js" integrity="{{SRI:agents}}" crossorigin="anonymous"></script>`. `npx --yes pipeup@0 watch page.html` adds it for the page it shows, without changing the file.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/agents.html) · [llms.txt](../llms.txt)
