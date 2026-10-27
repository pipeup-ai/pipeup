# The details

For adding Pipeup yourself, and what it does to your page.

The two lines for your page:

```html
<html data-pipeup-doc="<key>">

<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="{{SRI:pipeup}}" crossorigin="anonymous"></script>
```

The key goes on the `<html>` element (make one with `await Pipeup.newDocumentAttribute()`; the page's Copy makes a fresh one each time), and the script line just before `</body>`.

- **By hand.** Put the two lines on your page; each page needs its own key. Browsers load Pipeup from jsDelivr, pinned by its integrity hash, or from [a copy](https://pipeup-ai.github.io/pipeup/pipeup.min.js) you keep next to the page.
- **What it sends.** Nothing. Comments stay in each reviewer's browser until they send them, so clearing browser data removes the ones not yet sent.
- **What it does to your page.** It adds one element of its own and never restyles or moves your page, including pages a framework renders.
- **Claude Code or Codex.** Run `npx --yes pipeup@0 skills install` once (it asks first), then say "add comments to this page".
- **Licence and version.** Free and open source under the MIT licence, on [GitHub](https://github.com/pipeup-ai/pipeup). Version {{VERSION}} ([what changed](https://github.com/pipeup-ai/pipeup/releases/tag/v{{VERSION}})), one file of about {{SIZE}} compressed, with no dependencies.

[Back to the home page](https://pipeup-ai.github.io/pipeup/index.html.md)
