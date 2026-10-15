# Pipeup add-ons

Pipeup on its own needs none of these, and sends nothing anywhere. An add-on is one extra script the page's author chooses; each asks reviewers first. In beta. Making your own? The guide is at https://github.com/pipeup-ai/pipeup/blob/main/docs/ADDONS_GUIDE.md.

Keep add-ons intentional (best effort): pin each script with its `integrity` hash, as each add-on's page shows; put the add-on's id in `data-pipeup-addons` on the `<html>` element (append to an existing list, keep every entry; `none` lets no add-on run; without it every add-on runs); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN and connections only to the hosts the add-on names (don't apply it yourself, a strict one can break a page). This stops stray scripts, not a page that is already compromised.

Add one only when the author asks for that feature, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file: there is nothing to download, run or look up. Keep `data-pipeup-doc` exactly as it is.

Each add-on has a page of its own, and each page has a Markdown copy with what the add-on sends, what it asks, and exactly how to add it.

{{CARDS}}

[Back to the home page as Markdown](index.html.md) · [llms.txt](llms.txt)
