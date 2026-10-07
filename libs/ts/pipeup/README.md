# pipeup

Comments and feedback right on any HTML page: documents, slide decks and whole sites.

> **Alpha (0.4.0-beta.1).** The API and the stored comment format may change before 1.0; pin an exact version.
> Website and Try pages: https://pipeup-ai.github.io/pipeup/ · Source: https://github.com/pipeup-ai/pipeup

Pipeup: signed comment operations, threads with one-level replies, anchors that survive page changes,
local storage, sealed feedback files, copy for AI, and the UI: comments in a column beside documents or as
bubbles, comment mode for blocks and pins on any page, and an opt-in reserved gutter. It is one file
(at most 32 KB gzip) so it works from `file://` with nothing else to load.

Nobody has to give a name. Each reviewer is an animal in a colour ("Red Fox": 5 animals, 10 colours),
picked from their identity so it is the same on every page, shown as a squircle avatar (the animal drawn in its
colour on a tint of it) at the top right of their comments; once they add a name (beside the comment box, or the
identity row at the top of the menu) the avatar shows their initial in the same colours. Copy for AI names unnamed reviewers by
their colour and animal.

As a classic script (also works from `file://`), it mounts itself on pages that carry a document id:

```html
<html data-pipeup-doc="<id>:<key>">
  ...
  <script src="https://cdn.jsdelivr.net/npm/pipeup@0.4.0-beta.1/dist/pipeup.min.js" integrity="sha384-…" crossorigin="anonymous" defer></script>
```

Each release's notes on GitHub give the `integrity` value
(`node scripts/sri.mjs` prints it for a local build). Make a document key with
`await Pipeup.newDocumentAttribute()` and keep it once people have commented.

Install with `npm i pipeup`. From a bundler (no side effects; call `mount` yourself):

```js
import { mount } from "pipeup";
const pipeup = await mount({ name: "Sam" }); // options: root, name (optional), store
await pipeup.flush(); // write any unsaved changes now (this also happens when the page is hidden)
pipeup.unmount(); // remove Pipeup from the page; the comments stay saved
```

Pages designed for review can reserve a comment gutter: add `data-pipeup-reserve` to `<html>` and lay the
page out with `var(--pipeup-gutter, 0px)`. While All comments is open the page is moved over for it and its
width is published as `--pipeup-panel`, so fixed bars can use `right: var(--pipeup-panel, 0px)` — see [examples/review-document.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-document.html).

Examples in the source repository, one per kind of page, each following the agent skill's guidance (open from disk after `npm run build`):

- [examples/review-document.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-document.html) — a document: centred reading area with a reserved comment gutter.
- [examples/review-site.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-site.html) — a site: clear blocks with stable ids for comment mode and pins; navigation ignored.
- [examples/review-deck.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-deck.html) — a deck: one marked element per slide; slide controls ignored so they keep working (slide-aware comments come in a later release).

Comments show only while someone is reviewing: in comment mode, while All comments is open, or while a comment
is being written. With comment mode off (as every page opens) the page is the author's alone; the control still
counts the open threads.

The comment control is one round button in the corner: the comment icon, or the number of open threads inside
a comment bubble. Hovering it shows a tooltip with its shortcut; clicking (or tapping) it opens its menu of
one-line rows, each explained by a tooltip on hover or focus. From the top: who you are (avatar and name, with
Add name, edited in place in that row), Copy as Markdown (for AI), Copy as Text, All comments, and nearest the button **Start commenting** with its shortcut and a switch, which leaves the menu open so you see it move. The menu closes on Esc, a click outside, or 3 seconds after the pointer leaves it.
**All comments** is a panel on the right that moves the page over to make room: every thread in page order with
where it is, threads whose content is gone under "No longer on the page", and a Show resolved switch in its
header. Choosing one scrolls to it and opens it while the panel stays open (or opens it beside the panel when it
has nowhere to show); the panel closes with its close button, Esc or a click on the page. Elements the page
fixes to the window don't move over with the page.

Comment mode (press **Shift+Alt+C**, or **⇧⌥C** on a Mac, or switch on Start commenting in the control's menu) lets reviewers comment on blocks and drop pins
(Option-click, or Alt-click) on any page. While it is on, clicks, submits, and Enter or Space on the page's own controls do
nothing, and selecting text offers a comment icon, clicking a highlight opens its thread, and
clicking a block opens its comment box at once (a bar names the block, and its expand icon moves the box to the
block around it, keeping what you typed). Esc steps back: the box and its block together, then comment mode (or an open
comment, then comment mode). It is a quiet page, not a
sandbox:

- CSS `:hover` styles still apply.
- A page's own capture-phase listeners on `window`, added before Pipeup, can still hear events.
- Esc also reaches the page's own key handlers.
- The browser's own right-click menu is switched off in comment mode.

Not built yet: using comment mode from the keyboard (Tab between blocks, ↑ parent, ↓ child, Enter to
comment). Blocks and pins are mouse-only for now.

`pipeup/core` is the headless core only, for tools that never draw UI:

```js
import { PipeupDocument, IndexedDbStore, loadOrCreateProfile, parseDocumentAttribute, describeRange } from "pipeup/core";

const doc = await parseDocumentAttribute(document.documentElement.dataset.pipeupDoc);
const store = await IndexedDbStore.open();
const me = await loadOrCreateProfile(store); // name "" until they add one; animalName(me.identity.publicKey) says who they are
const comments = await PipeupDocument.open({ doc: doc.id, key: doc.key, store, identity: me.identity, name: me.name });
await comments.comment(describeRange(getSelection().getRangeAt(0), document.body), "Is 20% realistic?");
```

| Command | Does |
|---|---|
| `npm run check` | Types, lint, unit tests, build, size budget and browser tests |
| `npm test` | Tests only |
| `npm run e2e` | Browser tests (Playwright; run `npm run build` first) |
| `npm run format` | Prettier |

Design: [docs/design/architecture.md](https://github.com/pipeup-ai/pipeup/blob/main/docs/design/architecture.md).
Changes: [CHANGELOG.md](https://github.com/pipeup-ai/pipeup/blob/main/CHANGELOG.md). Licence: MIT.
