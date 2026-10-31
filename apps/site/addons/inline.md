# Pipeup add-on: Inline

Lets the author ask reviewers questions right in the content: agree, a choice of options, or an answer in their own words. Reviewers answer where the question is, without comment mode, and every answer is an ordinary signed Pipeup comment (it shows in All comments, takes replies, and is copied, read by agents and sent like any other). A block can also show its comments in place, under it. Add it when the author wants to ask reviewers questions in the page.

- **Sends**: nothing. Answers are comments, kept and sent the way the page's other comments are.
- **Asks first**: nothing; there is nothing to allow.
- **Others' answers**: each reviewer sees how others answered only after answering.
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/inline@0.8.2/dist/inline.min.js" integrity="{{SRI:inline}}" crossorigin="anonymous"></script>`.
- **Ask a question**: on the question's element, add `data-pipeup-id` (a short stable name, kept when the words change), `data-pipeup-ask` (the question) and `data-pipeup-ask-kind`: `agree`, `choice` (with `data-pipeup-ask-options="One|Two"`, two to six options; `data-pipeup-ask-other` adds Other), or leave it out for an answer in words. `data-pipeup-ask-needed` counts the question in Pipeup's menu. Keep the question in the element's own words too, so someone without the add-on still sees it. `data-pipeup-inline` on a block shows its comments under it instead of in the margin.
- **Agents**: `npx --yes pipeup@0 read page.html` lists each question with every reviewer's latest answer. An agent may reply to an answer, as to any comment, but never answers a question itself.

Pin the script with its `integrity` hash as shown; add the add-on's id to `data-pipeup-addons` on the `<html>` element (append to an existing list and keep every entry); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN. Add an add-on only when the author asks for it, tell them in plain words what it sends and to whom. Edit only the HTML file, and keep `data-pipeup-doc` exactly as it is.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/inline.html) · [llms.txt](../llms.txt)
