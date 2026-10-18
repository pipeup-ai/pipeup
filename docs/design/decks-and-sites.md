# Decks and sites

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (a click made while Space is held, the naming bar, how to pause),
§6 (a deck's own controls, showing slides, refitting, the control above a deck's controls), §7 (one bubble per
thread, a new comment's box in the window, the hint after the menu, All comments as a list), §7a (copy the same
whether or not a slide shows), §8 (Moved, a view owns only what is inside it). From the click-path review of
0.8.0-beta.2, the slides and websites testers (SL-*, sites-*), with the mouse and looks findings that touch the same
code (MD-09, MD-10, MD-11, KB-10, LK-06, LK-15). Builds on [words-and-focus.md](words-and-focus.md) (#80).

## Decks

- **A deck's own controls** (SL-5). `IGNORED` (`pick.ts`) is the author's `[data-pipeup-ignore]` plus reveal.js's
  `.reveal > .controls, .progress, .slide-number`. Everything that read the attribute reads the selector: comment
  mode's `onPage` and Tab (`comment-mode.ts`), `pickBlock` and `blockTree`, the selection's `NOT_HERE` and the picking
  cursor's rule (`highlights.ts`). Nothing is written to the page.
- **Every showing slide is here** (SL-3, SL-12). `besides()` (`here.ts`) finds marked slides shown, partly in the
  window, and clear of the current one above or below it: only a deck that scrolls has any (stacked slides overlap,
  even mid cross-fade). `holds()` counts them with the current slide (`isHere(…, also)`), so a click or a selection
  there opens a box that stays, their threads show, and the block cursor's `keep` lets their blocks in: it starts on
  the first block in view instead of scrolling back to the current slide's heading.
- **Refitting beside All comments** (SL-7). When the room changes on a deck (`makeRoom`), the frame loop dispatches a
  `resize` on `window` each frame for 0.45 s, while the room's margin eases: reveal.js (and any deck that lays out on
  resize) follows the room as it opens and closes. `fitting` keeps Pipeup's own `onResize` out of it. A deck sized
  in CSS must size from the page, not the window: `examples/review-deck.html` now uses `min(92%, 960px)` and centres
  its controls with `--pipeup-panel`, as the site's Try deck already did.
- **The control above a deck's corner controls** (SL-8). `render()` measures the `IGNORED` elements in the root on a
  deck; any along the bottom of the room (within 48 px of it, its top in the window's lower half, and not Pipeup's own
  element) that reaches into the last 380 px of the room, as far left as a message can reach (320 px wide, 52 px from
  the edge on touch), lifts the control, its menu and its messages by `--pu-lift` (set on the layer, so the
  stylesheet's `bottom` uses it; `bottom` eases). It was the last 48 px (the corner) until U03: on a phone a message
  runs along most of the bottom, and comment mode's touch hint covered a bottom-centre "← 1 / 3 →" bar.
- **Copy reads the same on any slide** (SL-9). `wordsOf` falls back to `textContent` where `innerText` is empty (a
  hidden slide); the slide's title is also found in reveal.js's `.slides section`. `Location.within` says the id is
  of a marked element around the one commented on (a slide), and the Markdown says `Paragraph · … in
  [data-pipeup-id="s1"]` instead of pairing the slide's id with the paragraph's name.

## Websites

- **A click made while Space is held** (sites-02, sites-12). Comment mode keeps `press`, the pause state when the
  pointer went down, until just after it comes up (`pointerup`/`pointercancel`, then a task, so the click is still
  inside the press). `mute` and `swallow` use it (`quiet()`), so a press finishes as it began whenever Space is let
  go. A quiet click is claimed, so the app's `onClick` never takes it as a click elsewhere: `dismiss()` no longer
  sends a waiting comment's view back (`held()`), which had switched a site's tab straight back.
- **Moved** (sites-04). `moved(ctx, t)` (`column.ts`) is the resolved state. Thread views take `moved` and their
  context line says `Moved · “quote”`, or `Moved · it read “snapshot”` for an element; the column and the bubbles'
  popover rebuild when it changes; All comments' cards and open thread show it, and the card's screen-reader text
  starts with it.
- **The hint after the menu** (sites-06, sites-11, LK-15). A hint asked for while the menu is open waits
  (`waiting`, a closure) and the frame loop shows it once the menu has closed, for its full time. `KEYS_HINT` says
  "Hold Space to use the page". While the menu is open, other messages sit left of it (`--r: 314px`), or at the top
  on a narrow window.
- **A new comment in the window** (sites-07). The column's restack clamps the draft into the window always, not only
  when it reaches the control's corner.
- **Above any page bar** (sites-08). The host's `z-index` is the highest there is, 2147483647, and the host comes
  after `<body>`, so a page's bar at that z-index paints under it. The top layer (a popover host) was tried and left
  out: it lifts Pipeup out from under `<html>`'s own effects, which `legible.ts` reports as reaching Pipeup, and it
  would sit above or below the page's own popovers and dialogs by the order they opened.
- **Where-labels** (sites-10). `headingOf` walks out from the element: among the earlier siblings at each level, the
  nearest h1–h3 that is the sibling or all of it (a wrapper holding only its heading). A heading inside another card
  or tab panel is never taken, and a hidden one only for content hidden with it.
- **A view owns what is inside it** (sites-16). On a page (not a deck), `classify()` keeps a thread here when its
  content is found as it was (`attached`), showing, and outside every `[role=tabpanel]`, whatever view it was made in.
  Content inside a panel still goes with its view; changed content still goes by its view, so a route's different
  content at the same path stays elsewhere.
- **A closed details** (sites-14). `pulse()` on hidden content swells the closed `details`' summary instead, or
  nothing.

## Naming, bubbles and All comments

- **Names** (sites-15, MD-11). `KIND` holds tags (upper case) and roles or field types (lower case, looked up with
  `Object.hasOwn`, so `role="constructor"` is nobody's kind): Checkbox, Switch, Tab, Radio button, Button, Link,
  Dropdown (a select), Disclosure (a summary), List, Article. `wordsOf` prefers a field's label and a select's chosen
  option to its text, and a placeholder. A block with no kind and no words is a `Bar` when long and thin (width over
  1.4 or under 0.7 times its height) and a `Shape` otherwise. The Pin icon is a map pin, its point at the bottom
  middle, on the same 24 grid.
- **The naming bar over words** (MD-09, KB-10). It still sits above (or below) the block it names, never over it;
  pointed at anywhere but its icons, it fades to 0.15 (`.namebar:hover:not(:has(.nb:hover))`), easing, so the words
  under it can be read.
- **One bubble per thread** (MD-10, sites-18). The bubbles' frame steps a bubble right by 22 px while its point is
  within 22 px of one already placed, so threads on one element sit side by side (since 0.8.0, within the room they
  have: see [looks-readable.md](looks-readable.md)). On a control (`INTERACTIVE`, now in
  `geometry.ts`) the bubble's tail is just past the control's right edge, so all of the control stays the page's.
- **All comments as a list** (LK-06). The panel has a heading for screen readers ("All comments", `role=heading`, so
  a page's own `h2` selectors never meet it); `.list` is `role=list` named "Comments"; each card is a `listitem`; a
  group (a slide, a view) is a `listitem` holding its own named `list`. Cards' buttons are plain buttons (no
  `menuitem`), and the arrow keys move between them as before.

## Size

Pipeup is 55.0 KB gzip (+1.2 KB); the budget rises from 54 to 55 KB (`scripts/size.mjs` and the add-ons' `CORE`). The
largest parts are the names (0.37 KB), the decks' refit and lift, the waiting hint and the view rule in the app
(0.3 KB), and the showing slides. With the looks (#81) and phones (#82) batches merged in, Pipeup is 57.4 KB and the
budget is 57.5 KB.

When merged with the phones batch, its own "hint waits for the menu" (`hintLater`) replaced this batch's `waiting`:
`toast()` defers a hint into `hintLater` while the menu is open, `hideHint()` drops a waiting hint (except by touch),
and the menu's bottom offset (`--b`) carries the deck's lift.

## From the regression pass on beta.5

- The lift above a deck's corner controls skips Pipeup's own element (inside the page's while a dialog or fullscreen
  element is open) and anything whose top is above the middle of the window (a layer over the whole window).
- `here.view(at)` on reveal.js gives content in an unmarked slide that slide (`.slides > section` by index, or its
  marked slide), not the one showing, so the block cursor leaves a slide as it turns and a comment is filed there.
- The panel's room also sets `width: auto` on `<html>`, so a page's `html { width: 100% }` gives it up.
- A deck shown fullscreen can't make room: the browser's own `:fullscreen` rules win over any page rule.

## Change log

- 2026-10-15 — First version.
- 2026-10-15 — Merged with the looks and phones batches: one waiting hint, the menu's `--b` with the deck's lift, All
  comments' groups as list items holding their own lists, and rows that fold and grow; Pipeup 57.4 KB, budget 57.5 KB.
- 2026-10-18 — From the regression pass on beta.5: the corner lift, reveal.js slides by content, room with a set
  width.
- 2026-10-18 — The lift counts a deck's controls anywhere along the bottom as far left as messages reach, not just the
  corner (U03); it skips Pipeup's own element and anything whose top is in the window's upper half.
