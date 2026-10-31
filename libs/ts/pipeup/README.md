# pipeup

Comments and feedback right on any HTML page: documents, slide decks and whole sites.

> **Alpha (0.8.2).** The API and the stored comment format may change before 1.0; pin an exact version.
> Website and Try pages: https://pipeup-ai.github.io/pipeup/ · Source: https://github.com/pipeup-ai/pipeup

Pipeup: signed comment operations, threads with one-level replies, anchors that survive page changes,
local storage, sealed feedback files, copy for AI, and the UI: comments in a column beside documents or as
bubbles, comment mode for blocks and pins on any page, and an opt-in reserved gutter. It is one file
(at most 40 KB gzip) so it works from `file://` with nothing else to load.

Nobody has to give a name. Each reviewer is an animal in a colour ("Red Fox": 5 animals, 10 colours),
picked from their identity so it is the same on every page, shown as a squircle avatar (the animal drawn in its
colour on a tint of it) at the top right of their comments; once they add a name (beside the comment box, or the
identity row at the top of the menu) the avatar shows their initial in the same colours. Copy for AI names unnamed reviewers by
their colour and animal.

As a classic script (also works from `file://`), it mounts itself (`data-pipeup-auto="off"` stops that). The script
line alone is enough; a document id on `<html>` keeps comments with the page wherever it is opened, instead of with
its address:

```html
<html data-pipeup-doc="<id>:<key>">
  ...
  <script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js" integrity="sha384-…" crossorigin="anonymous" defer></script>
```

On a host that writes its own `<html>` (claude.ai Artifacts, for example), put the same settings on the script
line instead: `<script src="…/pipeup.min.js" data-pipeup-doc="<id>:<key>" …>`. Every `data-pipeup-*` setting works
there, for add-ons too.

Each release's notes on GitHub give the `integrity` value
(`node scripts/sri.mjs` prints it for a local build). Make a document key with
`await Pipeup.newDocumentAttribute()` and keep it once people have commented.

**Add-ons.** Optional extra scripts add features (`@pipeup/share`, `voice`, `live`, `assist`, `agents`, `emoji`, `github`, `updates`, `inbox`), and anyone can write their own
(a company's, for example) without the Pipeup project's permission: see the
[guide](https://pipeup-ai.github.io/pipeup/addons-guide.html). Add-ons run with the page's full power, so keep them
intentional (best effort): pin each script with its `integrity` hash, name the add-ons that may run with
`<html data-pipeup-addons="share,voice">` (without the attribute every add-on runs; `none` lets none run), and set a content
security policy for the hosts you intend. Add-ons from anyone else are not vouched for by the Pipeup project.

Install with `npm i pipeup`. From a bundler (no side effects; call `mount` yourself):

```js
import { mount } from "pipeup";
const pipeup = await mount({ name: "Sam" }); // options: root, name, store, slides, doc, layout, theme, select
await pipeup.flush(); // write any unsaved changes now (this also happens when the page is hidden)
pipeup.unmount(); // remove Pipeup from the page; the comments stay saved
```

A page with its own review controls (a Comment button in its header, a name field) drives Pipeup without reaching
inside it:

```js
await pipeup.setCommentMode(true); // resolves once comment mode is on; pipeup.commentMode reads it
await pipeup.setName("Ada"); // kept as if the reviewer had typed it; pipeup.name reads it
const stop = pipeup.on("change", ({ commentMode, name }) => label(commentMode, name)); // however it changed
mount().catch((e) => show(e.code, e.message)); // "another-copy" or "failed", with words for people
```

Pages designed for review can reserve a comment gutter: add `data-pipeup-reserve` to `<html>` and lay the
page out with `var(--pipeup-gutter, 0px)`. While All comments is open the page is moved over for it and its
width is published as `--pipeup-panel`, so fixed bars can use `right: var(--pipeup-panel, 0px)` — see [examples/review-document.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-document.html).
A deck refits into the room beside the panel: Pipeup sends resize events while the room opens and closes (reveal.js
lays itself out again on them), and a deck sized in CSS should take its width from the page (`%`), not the window
(`vw`), as [examples/review-deck.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-deck.html) does.

Comments belong to where they were made. On a deck (slides marked `data-pipeup-slide`, or reveal.js) only the
current slide's comments show; the control counts those and a small dot marks comments on other slides, and All
comments groups every thread by slide. Choosing one goes to its slide and opens it there. Pages with tabs or
routes report their view with `Pipeup.setViewState({ tab: "faq", label: "FAQ tab" })` and go to one with
`Pipeup.onReveal((view) => showTab(view.tab))`; a deck can pass `mount({ slides: { current, go } })` or use the
same `onReveal`. Without a way to go there, the comment opens beside the panel with a snapshot of what it was on.

Examples in the source repository, one per kind of page, each following the agent skill's guidance (open from disk after `npm run build`):

- [examples/review-document.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-document.html) — a document: centred reading area with a reserved comment gutter.
- [examples/review-site.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-site.html) — a site: clear blocks with stable ids for comment mode and pins; navigation ignored.
- [examples/review-deck.html](https://github.com/pipeup-ai/pipeup/blob/main/libs/ts/pipeup/examples/review-deck.html) — a deck: one marked element per slide; slide controls ignored so they keep working, and one line so Pipeup can go to a comment's slide.

Selecting words offers a comment icon beside them, in comment mode or out of it; outside it, the comment leaves
comment mode off and the page keeps working (`data-pipeup-select="comment-mode"` keeps it to comment mode).
Comments show whether comment mode is on or off: highlights, bubbles and the column can be read and opened, and
outside comment mode the rest of the page works as normal. **Hide comments** in the control's menu puts them out
of sight on that page (remembered in the browser); the control still counts the open threads, and comment mode,
All comments or a comment being written show them again while they last.

The comment control is a small square of frosted glass tucked into the bottom-right corner: the comment icon, or
the number of open threads inside a comment bubble. One click (or tap) starts comment mode and another stops it.
Pointed at, it reaches left to show its shortcut and **⋯**, which opens its menu (by touch, press and hold the
control; from the keyboard, ↑ on it): one-line rows, each explained by a tooltip on hover or focus. From the top: who you are (avatar and name, with
Add name, edited in place in that row), Copy comments (as Markdown for AI, or as text), Theme, All comments, a Hide comments switch, and nearest the button **Start commenting** with its shortcut and a switch, which leaves the menu open so you see it move. The menu closes on Esc, a click outside, or 3 seconds after the pointer leaves it.
**All comments** is a panel on the right that moves the page over to make room: every thread in page order as a
card, threads whose content is gone under "No longer on the page", and two icon toggles in its header, **@** (mentions
of me) and **✓** (show resolved). While it is open the comment control is its footer (who you are, Comment, and ⋯ for the
menu), comment mode leaves it open, and a new comment is written in it, in page order. Choosing a card scrolls to its
place and opens it in the panel; clicking a comment on the page opens it there too. The panel stays open until you
close it with its × or Esc; a click on the page never closes it.

Every thread is the same compact card, beside the page, from a bubble or in the panel: avatar, name and how long ago,
the words, and its actions (React, ✓ Resolve, and ⋯ for Copy thread, and Edit and Delete on your own). A deleted
comment goes away; deleting a thread's first comment removes the thread. The comment and
reply boxes have Cancel and Comment (Reply) buttons; Enter also sends. Elements the page
fixes to the window don't move over with the page.

Comment mode (click the comment control, press **Shift+Alt+C**, or **⇧⌥C** on a Mac) lets reviewers comment on blocks and drop pins
(Option-click, Alt-click, or the naming bar's Pin) on any page. While it is on, clicks and submits on the page do
nothing, and selecting text offers a comment icon, clicking a highlight opens its thread, and
clicking a block opens its comment box at once (a bar names the block; Around it and Inside it move the box to the
block around it or inside it, keeping what you typed, and Pin makes it a pin at the block's centre). Hold **Space**
to use the page as normal for a moment; letting go brings comment mode back. Esc steps back: the box and its block together, then comment mode (or an open
comment, then comment mode). It is a quiet page, not a
sandbox:

- CSS `:hover` styles still apply.
- A page's own capture-phase listeners on `window`, added before Pipeup, can still hear events.
- Esc also reaches the page's own key handlers, except while the block cursor has focus.
- The browser's own right-click menu is switched off in comment mode.

From the keyboard, comment mode started with the shortcut (or Start commenting chosen with Enter) puts a **block
cursor** on the block that has focus, or the first block in view. Tab and Shift+Tab move between blocks at one
level, ↑ goes to the block around it and ↓ to a block inside it, Enter comments, Shift+Enter opens the comments
already there one at a time, and Esc puts the cursor away (focus goes back where it was; the shortcut brings it
back), then leaves comment mode. Screen readers hear "Paragraph, 3 of 12, has 1 comment" and the block's own words;
Pipeup never writes `tabindex`, ids or ARIA into the page. After each comment, focus is back on the same block.
While the cursor is not in use, Enter and Space on the page's own controls do what the page expects, and Enter in
a form field submits the form. Words
selected with caret browsing (F7) or a screen reader show the comment icon once the selection settles, and Enter
comments on them.

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
