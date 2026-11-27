# The extension, offered from the page

Status: **built** (2026-11-27, targets `next` as 1.2). Functional requirements:
[FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §7c (the menu's row list in §7 names it; §18 places it in 1.2). Visual spec:
[extension-invite.html](extension-invite.html) (flow, the menu before and after, wording, which browsers). Targets `next`.

## The problem

Pipeup for browsers is in the stores (Chrome submitted; Safari in review, 27 November 2026), but a reviewer who meets
Pipeup on a page has no way to learn it exists. The page is where they are; its menu is the one place Pipeup speaks.

## What was decided

- One row, first from the top of Pipeup's ⋯ menu, named for the browser ("Pipeup for Chrome"), opening to two choices
  beneath it as Copy comments does: the store, and Don't tell me again. Either ends the offer on this site.
- Only where the browser has a **public** listing (a list shipped in the build), only on Pipeup's own menu, never by
  touch, never a toast or badge, no network, nothing told to anyone.
- Authors turn it off with `data-pipeup-extension="off"`; nothing else about it is theirs to change.
- Remembered where Theme and Hide comments are: per site, in this browser. Pipeup can't know whether the extension is
  installed, and keeps nothing across sites; both are said plainly rather than worked around.

## How it is built

Code paths are relative to `libs/ts/pipeup/`.

- `src/ui/invite.ts`: `publicExtension(ua)` reads the browser's own name against a four-line table (Edge, Firefox,
  Chrome, Safari; most specific first) and returns the browser, the store and the listing's address, or null for a
  phone or tablet, an unknown browser, or a browser whose listing isn't public (its address is empty). Adding a store
  is filling in one address.
- `src/ui/app.ts`: `menu.invite()` applies the other conditions (not a touch-only screen, `data-pipeup-extension`
  not "off", not ended here) and `menu.endInvite()` remembers the end under `pipeup:invite` in the same prefs as
  Theme and Hide comments (the page's localStorage, so per site; a host's own, in the extension).
- `src/ui/launcher.ts`: the block (`.subs.open.inv`) holds the row, its two choices (`.subs`, as Copy comments') and
  a separator, so ending the offer folds the whole block with the fold the menu already has; the store row is an
  `<a class="mi" role="menuitem" target="_blank" rel="noopener noreferrer">`. `build()` asks `invite()` each time
  the menu opens and rebuilds the rows when the answer changes.
- Size: +0.9 KB gzipped; the budget went from 67.5 to 68.5 KB (`scripts/size.mjs`).
- Tests: `test/ui/invite.test.ts` (which browser gets which store) and `e2e/invite.spec.ts` (the row, the fold, the
  store's new tab, Don't tell me again and its memory, the author's switch, touch).

## Open

- Safari's App Store address joins the list when the 1.1.0 review is through; Edge and Firefox when they are submitted
  and public. Each is one address in `src/ui/invite.ts`, in the release that follows.

## Change log

- 2026-11-27 — Proposed: visual spec drawn and agreed; §7c written.
- 2026-11-27 — Built in core, with tests. The store row is the store's name alone ("Chrome Web Store ↗"): the agreed
  words didn't fit a sub-row at 290 px. The Chrome listing's address is in.
