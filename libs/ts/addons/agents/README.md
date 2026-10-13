# @pipeup/agents

Lets an AI agent read and answer a page's comments. It shows the replies an agent writes into the **replies file**
next to the page, is the page's side of the **live link** that `pipeup watch` starts, and offers **Copy a prompt for
my agent**. Pages that don't have an agent don't need it. Spec: [FUNCTIONAL_SPEC §15d](../../../../docs/FUNCTIONAL_SPEC.md);
design: [docs/design/agents-addon.md](../../../../docs/design/agents-addon.md).

What stays in Pipeup itself: the page's comments for an agent (`Pipeup.comments()`), Copy as Markdown, the
**addressed** note with Resolve and Still not right, and the AI marking on a reply.

## Add it

```html
<html data-pipeup-doc="…" data-pipeup-agents="<the agent's public key>">
  <script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@pipeup/agents/dist/agents.min.js"></script>
</html>
```

Or load the combined file, `pipeup+agents.min.js`. With a bundler:

```js
import { mount, use } from "pipeup";
import agents from "@pipeup/agents";

use(agents());
mount();
```

`pipeup watch <page.html>` adds it for the page it shows, so the live link needs no edit to the page.

## What it sends, and to whom

It reads a replies file next to the page (on this computer or this site). When the page is shown through
`pipeup watch`, and only after you switch **Share with my agent** on, it sends this page's comments to the program
running on this computer. Nothing leaves this computer.

## What an agent may do

Reply, and mark a thread addressed. Never resolve, reopen, edit or delete: the person closes threads. Replies are
signed by the agent's own key (`pipeup agent`), and a page accepts replies only from the agents its author lists.

## A page that lists an agent but doesn't load this add-on

Pipeup says so once in the browser console and the replies don't show. Nothing else changes.
