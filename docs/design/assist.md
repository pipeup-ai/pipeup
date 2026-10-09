# Assist: suggested replies from a model on the reviewer's device

Status: **proposal, for review** (2026-10-09). Nothing is built. Mock-ups:
[assist-mockups.html](assist-mockups.html) (open it in a browser). This note follows the
[add-ons design](addons.md): one more optional script, nothing in the core changes for people who don't use it.

## Goal

A reviewer can ask for a suggestion on a comment. A small AI model **running on their own machine** reads the
comment and the part of the page it is about, finds related passages elsewhere in the document, and drafts a
reply for the reviewer to post, edit or dismiss.

Not goals: an assistant that posts on its own, a chat window, summarising a whole document, or anything that
sends comments or page text to a server.

Working name: **Assist** (`@pipeup/assist`). Plain words everywhere: "Suggested replies", "Suggest a reply".
No sparkle icons: the model is shown with a concrete glyph (a chip) and the words "on this device".

## What the reviewer sees

See the mock-ups for each state.

1. **Asked first.** Nothing runs until the reviewer turns it on. A short panel says what it does, which model,
   whether anything must be downloaded (size, source, once), what it costs in memory, and that nothing leaves the
   device. Two variants: the browser already has a model (one click), or a download is needed.
2. **A menu row.** One switch row, "Suggested replies", with the other add-ons' rows. Its status line says
   "Suggestions · on this device". When it can't work, the row says "Not available" and the hover says why.
3. **On a comment.** A quiet pill under a thread: "Suggest a reply". Working: one line saying what it is reading,
   the words streaming in, Stop. Result: a card **only this reviewer sees**, with the draft, "From this page"
   (the related passages, each with Show, which scrolls to it and marks it), and **Post as reply**, **Edit first**,
   **Dismiss**, plus "Written by a small model, so it can be wrong. Check it before you post."
4. **Posted.** A normal reply under the reviewer's own name, with a muted "drafted on this device" note.
5. **Automatic, if wanted.** Off by default. When on, a suggestion is drafted for each new comment, one at a time,
   and a ready one is mentioned on its row in All comments ("Suggestion ready"). Nothing is ever posted
   automatically.
6. **When it can't.** One plain sentence (not enough memory, no graphics support, download refused, or "it stopped
   before it finished: try again"). Comments and replies work as usual.

## Functional requirements

1. Assist is a separate script. A page without it, or a reviewer who has not turned it on, sees no new control,
   loads no model, and uses no extra memory.
2. Before anything is downloaded or run, the reviewer is asked, and told in plain words: which model, its
   maker, the download size and where it comes from (if any), the memory it uses while writing, and that comments
   and the page stay on the device.
3. Comments and page text are never sent anywhere. The only network use is the model download, started only after
   the reviewer agrees, stoppable at any time, and kept for next time.
4. A suggestion considers the comment, the text it is attached to, and related passages elsewhere in the same
   document. It names the passages it relied on, and each can be shown on the page.
5. A suggestion is **private to the reviewer** until they post it. Posting makes a normal reply under their own name.
   Nothing is posted without a click, including in automatic mode.
6. Everything the model writes is shown as text, never as markup, and is marked as written by a model on this
   device. Comment text and page text are untrusted: they can't make the model post, send or change anything,
   because the model can do nothing but write a suggestion.
7. **Small on the machine.** One model at a time; one suggestion at a time; the model is freed after a few minutes
   unused; automatic suggestions wait when battery saver is on, memory is low, or the page is hidden; devices
   below a stated minimum are told so rather than slowed down.
8. The default is a **small model that is already on the machine** (the browser's built-in one). A download is
   only offered where there isn't one, for a small open-weight model from a US-based maker, and the size is
   stated first (see "Models" below).
9. Suggestions work with a mouse, the keyboard and screen readers: the pill, Show, Post, Edit and Dismiss are
   buttons; the streaming text is announced once when it finishes, not word by word.
10. Showing and hiding eases; nothing snaps. With reduced motion things only fade.
11. Mobile: on browsers with no model and no way to run one, Assist says it is not available and does nothing.

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

Assist can use what exists (menu row, status, panel, notices, `host.root` to read the page, the comment
text and anchors). A card under a thread and a quiet pill in a thread need **one new slot**: a thread card and
action in `AddonHost`, typed and versioned like the others. Its cost to the core is to be measured, as every slot
was (add-ons design section 15). Until that exists, the same content can sit in a side panel.

Related passages need no embedding model: the add-on ranks the document's own blocks against the comment and its
quote with plain text matching. That keeps the download to the language model alone.

## Estimates

- Add-on size: about 4 to 6 KB gzip (menu row, consent panel, card, text matching, Prompt API calls, engine
  interface). To be measured.
- Memory: a 1B model uses about 0.9 to 1.2 GB while loaded; Gemini Nano's footprint is Chrome's, shared.

## Decisions I need

| # | Decision | Recommendation |
|---|---|---|
| 1 | Engines | Built-in Prompt API by default, plus the author-supplied engine interface; no WebLLM inside Assist |
| 2 | What "automatic reply" means | A private suggestion card that appears by itself (nothing posted without a click). Not an AI reply posted into the shared thread |
| 3 | Mark posted replies as model-drafted | Yes, a muted note the reviewer can remove; the reply is theirs |
| 4 | New core slot for a card under a thread | Yes, measured; fall back to the side panel if it costs too much |
| 5 | Name | Assist (alternatives: Suggest, Helper) |

## Change log

- 2026-10-09: Proposal with mock-ups.
