# The newcomer's second pass

Status: **built** (2026-11-23), on top of [One menu, built for the job](one-menu.md). Functional requirements:
[FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §4a, §5, §7 and [EXTENSION_SPEC.md](../EXTENSION_SPEC.md) §3, §4a, §5
(change logs, 2026-11-23). Visual spec: [newcomer-pass.html](newcomer-pass.html) (the build's own screens, the six
changes drawn, the words each removes). Targets `next` (1.1.0).

## The problem

The one menu did its job. What a newcomer then met was mostly on the page itself: a hint with four instructions, three
of them for experts and one naming a button the extension hides; a comment box asking to "add others with @" before
there was anyone to add; a reply box to yourself the moment Return was pressed; the same reassurance twice with
different verbs; a "Send to my agent" row for people with no agent; and a settings page that read like a manual.

## What was built

**In the library** (`libs/ts/pipeup`), for every host:

- **The hint** (`src/ui/app.ts`, `hintOnce`). Comment mode started with the mouse says, the first time in a browser,
  "Click anything to comment · This button or Esc when you're done"; where the page keeps Pipeup's control off
  (`data-pipeup-control="off"`, as the extension does) it is "Click anything to comment · Esc when you're done". Three
  more are said once each, in the same place and for the same time (`HINT_MS`), the first time each would have helped:
  "Tab moves between blocks" after the first key pressed on the page in comment mode (not Esc, Space or a modifier
  alone; said after the key's own work, since the cursor's landing puts the showing hint away); "Hold Space to use the
  page" after the first click on a link, button or field in comment mode (after the box has opened on it); "Option-click
  (Alt-click) to pin" the first time a thread is opened in comment mode (opened outside comment mode, Option-click does
  nothing, so the hint waits). Which have been said is kept as `pipeup:hint:<kind>` in the same place as the other
  per-browser flags (`prefs`, the page's localStorage or the host's own), through one `once(key)` helper that the touch
  hint's `pipeup:held` now shares; with no storage, once per visit. The
  keyboard's hint (`KEYS_HINT`, when comment mode starts from the shortcut) and the touch hint are as they were. The
  comment-mode view asks for a hint through `ctx.hint(kind)`.
- **A new comment closes once sent** (`sent()` in `app.ts`). The draft and the open thread are cleared, the threads
  are re-resolved so the marker shows, and nothing opens: no thread, no reply box, no host `open` event, and the next
  block isn't lit. With the block cursor in use, focus goes back to it on the same block; otherwise to the Comment
  control, as after Cancel. The `sent` flag on the UI state and `open()`'s second argument are gone with the behaviour.
  In the column, the new thread appears where its box was and glides to a card's place, so nothing jumps
  (`column.ts`, `from`).
- **"Comment" and "Reply"** (`draft-view.ts`, `thread-view.ts`): the placeholder is the one word until `people()` has
  someone (another writer on the page, an agent the page lists, or people the host supplied with `setPeople`), then
  "Comment or add others with @" / "Reply or add others with @". Read when the box or the thread's reply line is made.

**In the extension** (`apps/extension`):

- **Off** (`popup.html`): the sentence is "Click anything on the page to comment on it." Where comments stay is said
  once, after the first comment (`start.js`): "Saved in this browser. Press Pipeup in the toolbar to copy, save or send
  them."
- **Send to my agent** (`popup.html`, `popup.js`): until a send has reached an agent (`agentUsed`), the row is under
  More as "Send to an AI agent on this computer · Set up once", and opens to the one command as before (the same
  press tries the send, so a computer set up since is found). Once set up, "Send to my agent" sits in the top level
  after Save as a file; its hint is the agent that last answered (`agentName`, kept when replies come back) or "on
  this computer". Not offered in Safari, as before.
- **Settings** (`comments.html`, `comments.js`): about a hundred words. Comments you've made first; Keyboard, one line
  per shortcut; Pipeup on pages, the two settings with one sentence each; then Add-ons and Send to an AI agent on this
  computer, each behind one line that opens in place (the agent line says Not set up, Set up, or the agent's name).
  The two commands agents run (`pipeup browser read` / `reply`) are no longer on the page: they are the agent's, not
  the reviewer's.

**Size.** The bundle is 16 bytes under its 67 KB gzip budget (`scripts/size.mjs`): the four hint strings and the
once-only logic are paid for by the hint string that went, the `sent` state that went, and the shared `once` helper.
The next change to the library will need room.

**Tests.** `libs/ts/pipeup/e2e/newcomer.spec.ts` covers the hint on the first visit and never again, the hint with the
control off, Space and pin said once, the placeholders before and after someone can be added, and a comment closing
once sent. Thirteen existing tests that expected the thread to open after Return, or the old words, were brought in
line. The extension's Chromium and Firefox tests cover the off sentence, the agent row under More and in the top level
(with the agent's name), and the settings line. The Safari UI test's selectors are unchanged (the box's placeholder
still begins with "Comment").

## Not in this change

- The hint's words on a touch screen (unchanged: "Tap what you want to comment on").
- A reply line's placeholder changing while a thread stays open and someone else's first comment arrives: it updates
  when the thread is next drawn.
- The store screenshots are regenerated by `npm run store-art` (the off state and the settings page changed).

## Change log

- 2026-11-23 — Built from the agreed spec (PR 150); this note.
