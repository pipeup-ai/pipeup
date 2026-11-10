# Private typing in the extension

Status: **proposed** (2026-11-10), for review. Functional requirement: [EXTENSION_SPEC.md](../EXTENSION_SPEC.md) §5
("What the reviewer types into Pipeup on a page can't be seen by the page"). Targets `next`, on the extension branch.

## The problem

In the extension, Pipeup's UI is in a closed shadow root, so the page's scripts can't read a comment box or its words.
But every key event, `beforeinput` and `input` (with its `data`), `paste` and composition event is a DOM event in the
page's document: it is dispatched from the box up through `<pipeup-root>` to `document` and `window`, and a page's
listener on `window` (capture) runs before any of Pipeup's. Measured on 2026-11-10: typing "secret" into a comment box
with `mount({ closed: true })`, a page listener heard `keydown`, `keypress`, `beforeinput`, `input` and `keyup` for
each letter, with `key` and `data`. It can't read the box's value, but it doesn't need to.

Nothing in the page's own document can stop this: the page's capture listener on `window` runs first, and stopping the
event earlier (a `document_start` listener) would also stop Pipeup's own handlers.

## The approach

Events don't cross from one document into another. In the extension, the text box of each composer (new comment,
reply, edit) is a small **frame of the extension's own page** (`typing.html`, `chrome-extension://…`), drawn where the
`<textarea>` is today, inside Pipeup's closed shadow root. Keys pressed there are dispatched in the extension's
document; the page sees the frame get and lose the focus, and nothing else.

- **One seam in the core:** `mount({ field })`, a host's factory for the composer's text box. Without it (every page
  with Pipeup built in) the composer keeps its `<textarea>`, unchanged. With it, `composer()` asks the host for a
  `Field`: an element to put in the line, and the text box's interface — `value`, `selectionStart`/`End`,
  `setRangeText`, `focus`, `blur`, a caret rectangle (for the @mention list), and events. Everything that reads
  `.rbox textarea` today goes through the composer instead (`app.ts`, `launcher.ts`, `thread-view.ts`, `addons.ts`).
- **The frame** holds one `<textarea>` styled from Pipeup's tokens (the look and colours are sent to it), and reports
  its height so the line grows as today. Keys Pipeup acts on (Enter, Shift+Enter, Esc, ⌘/Ctrl+Z after Esc, Space-hold
  in comment mode, the arrows and Enter while the @mention list is open, Tab out) are handled by sending them to the
  composer as **events that never leave the shadow root** (`composed: false`), so Pipeup's handlers run and the page
  hears nothing.
- **The channel:** a `MessageChannel` per frame. The content script makes it and hands one port to the frame with
  `frame.contentWindow.postMessage(…, extensionOrigin, [port])`; after that, words and keys go only over the port.
  Nothing uses `window.postMessage` to the page.
- **A frame only for Pipeup:** `typing.html` is a web-accessible resource (it has to be, to be framed in a page), so a
  page could frame it too. The frame answers only a port that brings a one-time token the content script put in
  `chrome.storage.session` (readable by content scripts with `setAccessLevel`), and shows nothing until it has one; a
  page can't make a working box out of it. `use_dynamic_url` in Chromium keeps its address from identifying the
  extension.
- **Add-ons in the box:** Emoji inserts through `setRangeText`; Voice's dictation writes through the composer's
  `dictate()`; both already go through the composer, not the `<textarea>`. The microphone is asked for by the page's
  document today (Voice runs in the content script), so dictated words are typed into the frame by the composer, not
  heard by the page; the audio itself is the browser's (unchanged).
- **Focus:** `focus()` moves focus into the frame (`frame.focus()`, then the textarea inside). Pipeup's focus checks
  (`activeElement` is a textarea in the layer) learn that the field's frame counts as a text box.

## What doesn't change

How it looks and works: the same box, placeholder, Cancel and Send, growing with the words, @mentions, Emoji, Voice,
Enter, Esc, undo, spelling, input methods, right-to-left words. Pages with Pipeup built in: no frame, no change.

## Risks and how they are checked

| Risk | Check |
|---|---|
| A key Pipeup acts on is missed, or reaches the page | A test types in every composer and asserts the page's `window` capture listeners hear no `key*`, `*input`, `paste` or `composition*` event; one test per key Pipeup acts on |
| Focus and Tab order break (Tab into, out of, Shift+Tab) | The existing focus and keyboard tests, run in the extension build too |
| The @mention list is placed wrongly (caret position from another document) | A test opens the list after `@` at the start, middle and end of a line |
| Input methods (Japanese, Chinese), dictation, spelling | Hand checklist steps per browser |
| Safari: a frame of the extension in a page | The hand checklist in Safari; `safari-web-extension://` frames are allowed for web-accessible pages |
| Size: the core grows | The seam is small (a factory and the composer reading through it); budget checked by `npm run check` |
| A page frames `typing.html` itself | A test frames it from the page and finds it inert |

## Not in this change

The page can still see that someone is typing (the frame has the focus) and when Pipeup's box opens. Comments written
in the side panel or the toolbar panel never touched the page and are unchanged.

## Change log

- 2026-11-10 — Proposed, after measuring that a page hears every key typed into a comment box in the extension.
