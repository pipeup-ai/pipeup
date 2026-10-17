# Pipeup add-on: GitHub

Offers to tell people on GitHub when a comment mentions them: a menu row opens a new issue on your repository with their @name and the words filled in.

- **Sends**: nothing by itself. Pressing the row opens github.com with the issue filled in; you submit it there.
- **Needs**: `data-pipeup-github-repo="owner/repo"` on the page, and optionally `data-pipeup-github-people="octocat hubot"`.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/github@0.8.0-beta.4/dist/github.min.js" integrity="{{SRI:github}}" crossorigin="anonymous"></script>`.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN, and connections only where the add-on sends. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/github.html) · [llms.txt](../llms.txt)
