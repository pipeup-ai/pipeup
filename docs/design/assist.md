# Assist: short replies from a model on the reviewer's device

Status: **first version built** (2026-10-09): `@pipeup/assist` with the three scenarios, the Prompt API engine and an author-supplied engine hook, notes files, checked-thread memory, streaming into the thread, the reserved name and AI ring. Still to come: hiding or removing assistant replies,  custom scenario files, the thread slot for the side panel and rail.
Mock-ups: [assist-mockups.html](assist-mockups.html) (open it in a browser). This note follows the
[add-ons design](addons.md): one more optional script; nothing in the core changes for people who don't use it.

## Goal

Once a reviewer has turned it on, a small AI model **running on their own machine** looks at each comment in the
background and decides whether a reply would help. If it would, it adds a short reply to the thread, written like a
person would write it, streaming in as it is made. If there is more to say, the reply links to it: to the related
passage on the page, or to the author's own Markdown notes.

Not goals: a chat window, summarising a whole document, replies to the assistant's own replies, or anything that
sends comments or page text to a server.

Working name: **Assist** (`@pipeup/assist`). Plain words everywhere ("Assistant replies"). No sparkle icons.
An AI reply is unmistakable: its avatar is a plain white disc with the letters **AI** inside a violet **ring that
glows gently**, and its line reads "AI assistant · on this device".

## What the reviewer sees

See the mock-ups for each state.

1. **Asked first, once.** Nothing runs until the reviewer turns it on. A short panel says what it does, which model,
   whether anything must be downloaded (size, source, once), what it costs in memory, that nothing leaves the device,
   and that its replies appear in the thread for anyone sharing the page. Two variants: the browser already has a
   model (one click), or a download is needed.
2. **A menu row.** One switch row, "Assistant replies", with the other add-ons' rows, shown only while commenting is on
   (the assistant belongs to reviewing; it keeps working when the row is out of sight). The status line says what it
   has done ("checked 3 comments, replied to 1"). When it can't work, the row says "Not available" and why.
3. **Nothing to click.** For each comment the model first decides, quickly, whether a reply is worth adding. Most of
   the time it isn't (a compliment, a question for a person, nothing to add) and nothing appears.
4. **A reply streams in** as a reply in the thread, in the same type as any reply, with the glowing AI ring and
   "AI assistant · on this device". The ring glows a little faster while it writes and slowly once finished. It becomes
   a real reply once finished; nothing half-written is ever left. With reduced motion the ring stays still.
5. **Short, with a way to more.** Two or three short sentences at most. Below it, what it relied on as a few small
   **pills**, never a list of addresses: a numbered pill ("[1] Risks") for a passage on the page or a heading in the
   author's notes, and for a slide a pill with a small slide icon ("[▭] Slide 5"). At most three show. Pressing a
   pill goes there: a passage scrolls into view with one soft swell, a slide is shown, a notes heading opens.
   In a deck the reviewer is on one slide while the answer is often on others, so the assistant reads every slide.
6. **People carry on.** The assistant looks at a thread again only when something new is added to it, replies at most
   three times in one thread, and never to its own replies. A person can remove an
   assistant reply, and can switch assistant replies off for what they see. Replies already added stay when it is
   turned off.
6a. **Reviewed, nothing to add.** A thread it looked at and stayed quiet on carries a quiet line, "Reviewed by AI ·
   nothing to add", with a still ring, so a reviewer can tell silence from "not looked at". While it reads a thread the
   line says "AI assistant is reading this…".
7. **In All comments,** a quiet line on each row says what happened: "AI assistant replied", "AI assistant is
   reading", or "Checked, nothing to add".
8. **When it can't,** one plain sentence (not enough memory, no graphics support, download refused). A failed reply
   adds nothing and it tries again with the next comment. Comments work as usual.

## Functional requirements

1. Assist is a separate script. A page without it, or a reviewer who has not turned it on, sees no new row, loads
   no model, and uses no extra memory.
2. Before anything is downloaded or run, the reviewer is asked, and told in plain words: which model and its maker,
   the download size and source (if any), the memory it uses, what it reads (this page, and the author's notes file
   if one is named), that nothing leaves the device, and that replies are visible to everyone sharing the page.
3. Comments and page text are never sent anywhere. The only network use is the model download (started only after
   the reviewer agrees, stoppable, kept for next time) and, if the author named one, reading a Markdown notes file
   from the page's own site.
4. The assistant **remembers, on this device, which threads it has looked at and how much each held**. It looks at
   a thread again only when something has been added to it (a new reply or an edit), never just because the page was
   reloaded or reopened. For a thread it hasn't looked at, the model first decides whether a reply is worth adding. It
   replies only when it can say something useful: a way to address the comment, or information from the document
   that bears on it. Otherwise it stays silent.
5. A reply is **short**: at most about 280 characters, one to three sentences, plain words, no headings or lists.
   Anything longer is not written out; the reply points to where the detail is.
6. A reply that relies on the page, the slides or the author's notes shows each source as a small reference pill (at
   most three), never a full address. A slide's pill carries a slide icon. Pressing a pill takes the reviewer there
   without losing their place.
7. Replies **stream in** as they are made. Only a finished reply becomes part of the thread, so no partial reply is
   ever stored or shared.
8. A reply is clearly marked as written by a model on the device, with its own name and mark, never under a person's
   name. The assistant adds **at most three replies in a thread**, never more than one per addition, and never replies to
   an assistant reply. It never edits
   or removes anyone's comment.
9. Several devices with Assist on don't pile up replies: a device doesn't reply to a thread when an assistant
   reply to the latest addition already exists, and replies are paced.
10. The model's words are shown as text, never as markup. Comment text and page text are untrusted: they can't
    make the model do anything but write a short reply, and a limit on length and frequency applies whatever they say.
11. **Small on the machine.** One model at a time; one comment at a time; the model is freed after a few minutes
    unused; work waits when battery saver is on, memory is low, or the page is hidden; devices below a stated
    minimum are told so rather than slowed down.
12. The default is a **small model that is already on the machine** (the browser's built-in one). A download is only
    offered where there isn't one, for a small open-weight model from a US-based maker, with the size stated first.
13. The reviewer can pause or turn it off at any time, and can hide assistant replies from their own view.
14. It works with a mouse, the keyboard and screen readers. A streaming reply is announced once when it is finished,
    not word by word. Showing and hiding eases; with reduced motion things only fade.
15. Where no model is available (phones, older browsers), Assist says it is not available and does nothing.

## The prompts

Three reply scenarios to start with, each a short prompt written for a small model: **ambiguity** (ask which of two
readings is meant), **related information** (say what the document says and show where) and **tone** (one
observation and one alternative wording). Everything else gets no reply. The prompts, the two-step flow (decide, then
write), the checks the add-on applies afterwards, and the format for adding your own scenarios later are in
[assist-prompts.md](assist-prompts.md).

## Models: what is real today

Checked against Chrome's own documentation on 2026-10-09; sizes for other models come from third-party guides and
must be re-checked against each model's own page before they are quoted to reviewers.

- **Chrome's built-in model is Gemini Nano, not Gemma.** It is used through the **Prompt API**
  (`LanguageModel.availability()` and `LanguageModel.create()`, with a `monitor` for download progress). It needs
  user activation to start a download, works in top-level windows (not workers), and Chrome documents that no data is
  sent to Google or third parties when it is used. Desktop only (Windows, macOS, Linux, Chromebook Plus), at least
  22 GB of free disk, and either a GPU with more than 4 GB of video memory or a CPU with 16 GB of RAM and 4 cores.
  It is not on phones. The model is shared by all sites, so for most reviewers there is nothing to download.
  ([Chrome: Prompt API](https://developer.chrome.com/docs/ai/prompt-api))
- **WebLLM is a library (from MLC), not a web standard.** It runs open-weight models in the browser on WebGPU and
  caches them in the browser. The standard track for built-in models is the Prompt API above. WebLLM is the usual way
  to run an open model where the browser has none.
- **Small open-weight models from US makers**, approximate 4-bit sizes: Llama 3.2 1B (Meta, about 0.7 GB, the
  practical floor), Gemma (Google; the WebLLM list has Gemma 2 2B at about 1.4 GB, so smaller Gemma sizes need
  checking), SmolLM2 360M (Hugging Face, about 0.2 GB, noticeably weak). Qwen models (Alibaba) are strong at this
  size but are not US-based, so they are not proposed.
  ([WebLLM sizes, third-party guide](https://pinggy.io/blog/run_llm_in_browser_webgpu/))

### The rule that decides the engine question

Add-ons carry **no third-party code, bundled or loaded at run time** (AGENTS.md). WebLLM is third-party code, so
Assist can't include or fetch it. The proposal:

- Assist's built-in engine is the **browser's Prompt API only**. That is zero third-party code and the lightest
  option.
- Assist also accepts **an engine the page's author supplies**: a tiny interface (`available()`, `prompt()`,
  `stop()`) that the author wires to WebLLM, Transformers.js or anything else they choose to load themselves. The
  author owns that code and that download address; Assist only asks the reviewer first and shows what the author
  declared (model, maker, size).

## What the core would need

*Built (2026-10-09, `feat/assist-core`): the reserved name and the AI ring, `host.setThreadNote`, and the exported op helpers (+0.4 KB gzip).*

Assist can use what exists: the menu row, status, panel, notices, `host.root` to read the page, the comment text and
anchors, and `host.merge` to add ops from elsewhere (the same way share and live do).

- **A reply by the assistant, not by a person.** The assistant has **its own signing key**, kept in the add-on's
  settings, and adds its replies as ordinary signed reply ops through `host.merge`. They are shared and exported
  like any reply. It needs no change to the op format. The glowing AI ring needs a small core hook: an author key an
  add-on registers can carry its own name and avatar. The glow is an opacity and scale change on a pseudo-element
  (cheap to draw), and is still with reduced motion. To be measured.
- **Streaming into a thread.** While a reply is being written it is only a local, unsigned preview line at the end
  of the thread: a core slot ("thread note", like the composer note). On completion the preview is replaced by the
  real reply op. Without that slot the preview can sit in the side panel instead.
- **Reference pills.** A reply names what it relied on in reference lines; Pipeup turns them into small pills (an address, `slide:5`, or `quote:<text>` for a passage here), and a pressed pill goes there (built; the app reveals a passage with one soft swell, or shows the slide).

Related passages need no embedding model: Assist ranks the document's own blocks (and the notes file's headings)
against the comment and its quote with plain text matching, so the download is the language model alone.

## Notes files

The author may name one or more Markdown files on the page's own site (for example `data-pipeup-assist-notes="notes.md"`)
with background the assistant may use and link to: a spec, a timeline, a glossary. They are read from the same site
only, after the reviewer has agreed, and the consent panel names them. Headings in them become the "Read" links.

## Estimates

- Add-on size: about 5 to 7 KB gzip (menu row, consent panel, queue and decision step, streaming, text matching,
  signer, Prompt API calls, engine interface). To be measured.
- Memory: a 1B model uses about 0.9 to 1.2 GB while loaded; Gemini Nano's footprint is Chrome's, shared.

## Decisions I need

| # | Decision | Recommendation |
|---|---|---|
| 1 | Engines | Built-in Prompt API by default, plus the author-supplied engine interface; no WebLLM inside Assist |
| 2 | How the assistant appears in a thread | Its own identity and key, replies as real ops (shared, exported), marked "Assistant · on this device" |
| 3 | Two devices both with Assist on | First reply wins: skip an addition that already has an assistant reply, with a short random wait when sharing |
| 3a | Remembering what was checked | Per document, in the add-on's own settings on this device: thread id and how many comments it held at the last look; only growth triggers another look |
| 4 | A thread slot for the streaming preview, and an author name and avatar hook (for the AI ring) | Yes, each measured; fall back to the side panel and a plain "AI" letter avatar |
| 5 | Notes files | One or more Markdown files on the page's own site, named by the author, read only after consent |
| 6 | Which comments it considers | Every comment without an assistant reply that arrives or is already there when it is switched on, newest first, one at a time |
| 7 | Name | Assist (alternatives: Helper) |

## Change log

- 2026-10-09: Proposal with mock-ups.
- 2026-10-09: Threads checked are remembered (looked at again only when something is added); an AI reply is marked
  with a gently glowing ring and "AI assistant", replacing the chip glyph.
- 2026-10-09: Three reply scenarios with draft prompts (assist-prompts.md).
- 2026-10-09: Replies are automatic, short, streamed into the thread and linked to detail, instead of private
  suggestions behind a button; notes files added; the assistant gets its own identity.
- 2026-10-09: First version built (`libs/ts/addons/assist`); decisions 1 to 7 taken as recommended.
