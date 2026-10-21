# @pipeup/agents

Lets an AI agent read and answer a page's comments. It shows the replies an agent writes into the **replies file**
next to the page, is the page's side of the **live link** (`pipeup watch`, or the shell link), and offers **Copy for my agent**
and **Paste my agent's replies**. Pages that don't have an agent don't need it. Spec: [FUNCTIONAL_SPEC §15d](../../../../docs/FUNCTIONAL_SPEC.md);
design: [docs/design/agents-addon.md](../../../../docs/design/agents-addon.md).

What stays in Pipeup itself: the page's comments for an agent (`Pipeup.comments()`), Copy comments › As Markdown, the
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

## The shell link: the live link without Node

Two short scripts in this package's `dist` do the live link's job with only what the computer came with:
`pipeup-link.sh` (bash, `nc` and `openssl`, on macOS and Linux) and `pipeup-link.ps1` (PowerShell, on Windows). Copy
for my agent names the one for the person's kind of computer, pinned to this release with its SHA-256.

```sh
curl -fsSLO https://cdn.jsdelivr.net/npm/@pipeup/agents@<version>/dist/pipeup-link.sh
bash pipeup-link.sh lisbon.html &                        # leaves lisbon.link.js next to the page
bash pipeup-link.sh comments lisbon.html                 # once Share with my agent is on
bash pipeup-link.sh reply lisbon.html < replies.md       # a pipeup-replies block, as you'd paste it
```

It runs beside whatever already shows the page (a `localhost` preview, or the file) and never changes it. A page on
this computer with this add-on finds the link file within a few seconds and offers **Share with my agent**, off until the
person turns it on. The page then sends its comments, and a new key for that session; replies the script tags with that
key appear by themselves, as pasted by the person, and any others wait until the person looks at them. Stopping the
script (Ctrl-C or `kill`) removes the link file, and the switch goes.

On Windows: `powershell -ExecutionPolicy Bypass -File pipeup-link.ps1 lisbon.html` (the bypass is for that run only).

## What it sends, and to whom

It reads a replies file next to the page (on this computer or this site). When a link is running on this computer
(`pipeup watch`, or the shell link), and only after you switch **Share with my agent** on, it sends this page's comments
to that link. Nothing leaves this computer.

## What an agent may do

Reply, and mark a thread addressed. Never resolve, reopen, edit or delete: the person closes threads. Replies are
signed by the agent's own key (`pipeup agent`), and a page accepts replies only from the agents its author lists.

## A page that lists an agent but doesn't load this add-on

Pipeup says so once in the browser console and the replies don't show. Nothing else changes.
