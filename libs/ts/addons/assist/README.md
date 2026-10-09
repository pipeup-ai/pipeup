# @pipeup/assist

Short replies to comments, from a small AI model **running on the reviewer's own device**. Once a reviewer turns it
on, it looks at each comment in the background and decides whether a reply would help. When it would, it adds a
short reply to the thread, written like a person would write it and streaming in as it is made, marked as an AI's
with a gently glowing ring. Most comments get no reply. Design: [docs/design/assist.md](../../../docs/design/assist.md).

It uses **the model your browser already has** (Chrome's built-in model, through the Prompt API). Pipeup downloads
and runs no model of its own, and carries no third-party code.

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/assist/dist/assist.min.js"></script>
```

Or load the combined file, `pipeup+assist.min.js`. With a bundler:

```js
import { mount, use } from "pipeup";
import assist from "@pipeup/assist";

use(assist());
mount();
```

## What it sends, and to whom

Comments and the page are read **on this device and never sent anywhere**. The only network use is a model download
by the browser, started only after the reviewer agrees, and (if the author names one) reading a Markdown notes file
from the page's own site.

The first time, the reviewer is asked in plain words: which model, whether anything must be downloaded and how big,
what it reads, and that its replies appear in the thread for everyone sharing the page.

## What it does

- **Where it is.** One switch row, "Assistant replies", in the comment control's menu, shown only while commenting is
  on. Once turned on it keeps working when comment mode is off.
- **Decides first.** One short call chooses one of three jobs, or none: **ambiguity** (ask which of two readings is
  meant), **related information** (say what the document says elsewhere, and where) and **tone** (one observation and
  one alternative wording). Anything else gets no reply. The prompts are in
  [assist-prompts.md](../../../docs/design/assist-prompts.md).
- **Short.** At most 280 characters, one to three plain sentences. The add-on cuts, strips formatting, and drops a
  reply that apologises, repeats the comment, or contains a number the document never mentioned.
- **Marked and its own.** Replies are signed by the assistant's own key under the name "AI assistant (on this
  device)", never a person's. Pipeup draws them with the AI ring. They are ordinary replies: shared and exported like
  any other.
- **Once per addition.** It remembers, on this device, which threads it has looked at and how much each held. A
  thread is looked at again only when something is added to it, at most three replies in a thread, never to its
  own replies.
- **Small on the machine.** One comment at a time; the model is freed after 5 minutes unused; it waits while the page
  is hidden or the battery is low, and says "Not available" on devices with too little memory.

## Notes files

The page's author may name Markdown files on the same site for it to read and link to:

```html
<html data-pipeup-doc="…" data-pipeup-assist-notes="notes.md timeline.md"></html>
```

A reply that relied on a section shows it as a small pill ("[1] notes.md › Timeline"); a slide it relied on is a pill with a slide icon ("Slide 5"). At most three, never a bare address. Pressing a pill goes there.

## Your own model

A page can supply its own engine (WebLLM, Transformers.js, anything) before Pipeup starts. Assist ships none of that
code; it only asks the reviewer first, using what your engine declares.

```js
window.pipeupAssistEngine = {
  info: {
    name: "Llama 3.2 1B",
    maker: "Meta",
    download: "0.7 GB, once",
    memory: "about 1 GB while it writes",
  },
  availability: async () => "ready", // or "download" or "none"
  create: async ({ onProgress, signal }) => ({
    prompt: async (text, { schema, signal }) => "…", // the whole answer
    async *stream(text, { signal }) {
      yield "…";
    }, // the answer in pieces
    destroy() {},
  }),
};
```

## Not yet

Hiding assistant replies from your own view and removing one are still to come.
