# All comments as the hub, and one card everywhere

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (the comment box, Edit and Delete) and §7 (*compact cards*, actions,
the comment control, All comments). Mock-ups: the *Comments at Rest* page, part two (storyboard, swimlanes, screens). This
builds on [comments-at-rest.md](comments-at-rest.md).

## The card (`thread-view.ts`)

- Every comment starts with `.hdr`: avatar, `.who` (the name, cut short on one line), `.ago` (`formatAgo`, with the exact
  time as its `title`), then `.acts` at the right. The hover-only footers (`.ft`, `.rft`) are gone, and so is the avatar's
  reserved space at the top right.
- Root actions: React, Resolve or Reopen, and ⋯ (`more`). A reply has React, plus ⋯ when it is yours. ⋯ opens `.pm`, which
  holds Copy thread (on the root) and, on your own comments, Edit and Delete. Delete needs a second press ("Delete for
  everyone"). The open menu, the comment waiting for that second press and the comment being edited live in the view, so
  they survive `update()`.
- The view rebuilds its comments on every update. After a choice it puts focus back (into the menu, or on the ⋯ that
  opened it). It closes the menu once focus has settled outside the card (`focusout`, then a `setTimeout`): moving
  between choices, or the card rebuilding itself, doesn't count as leaving.
- Edit swaps the comment's words for a composer prefilled with them (`value`, label "Save"). Saving calls
  `actions.edit`, and Esc or Cancel puts the words back. `actions.remove` deletes.
- `ThreadActions.me` is a getter (`o.doc.me`): the identity can change after Pipeup starts, and a snapshot made Edit and
  Delete disappear.
- Column cards hide `.acts` until hovered, focused or open (`.th:not(.on):not(:hover):not(:focus-within)`), and show `.rest`
  (the reply count) only while closed. The popover and the panel always show their actions.

## The writing box (`composer.ts`, `draft-view.ts`)

- The composer is `.row`, which holds `.line` (a rounded box: the textarea and add-ons' tools) and `.bts` (Cancel, then
  Send named for what it does: Comment, Reply, Save). `.bts` eases open while the row has focus or words (`.row.has`).
  Send has `.show` and is out of Tab's reach until there are words. The paper-plane icon is gone. `placeholder` and
  `value` are new options.
- The draft card starts with `.hdr` (the avatar button and the "You're Otter · add your name" line), then the label,
  the add-on note and the composer.
- Each draft keeps one box (`draftBox` caches it per `Draft` in a WeakMap). A view that takes the draft over (column,
  popover or panel) moves the same element, so its words, caret and name field go with it.

## The panel (`launcher.ts`)

- The header is `mine` (@) and `showResolved` (✓): buttons with `aria-pressed` (`.tg`) beside Close. There is no title
  and no count. Both always show. @ on with no mentions says "No comments mention you". Each has a tooltip
  (`data-tip`, drawn by `.tg::after`, easing in after 0.4 s on hover or focus), mirrored to `aria-description`.
- The rows are cards (`.cd`). The button (`.mi`) holds the header, the quote (or the location, or the lost snapshot), the
  clamped words and `.rest`. Opened, the button is hidden and the card is the thread view (`.xr`): its header, the quote
  once, the thread. A click on its top line (not a button) closes it. The line starts from the card.
- The footer (`.pf`) shows the face and name, `.fs` (Comment, its shortcut and a switch) and ⋯, which opens the same
  menu as the round button. While listing, the layer's `.listing` class moves the menu above the footer, hides its
  Comment and All comments rows (and `items()` skips hidden rows), and draws the round button in (opacity and scale,
  inert).
- New comments: `startDraft` and `setCommenting(true)` no longer clear `listing`. The column and bubbles leave the draft
  to the panel while listing. `buildAll` puts the draft's card before the first thread whose node follows the draft's
  (`compareDocumentPosition`), focuses it once, and puts the caret back after rebuilds. `target()` takes a draft too, so
  the line joins the card to what it's about. The panel stays open until its × or Esc: a page click never closes
  it (the pointer-down bookkeeping that rule needed is gone). Esc in the panel steps back past the draft first
  (`ctx.back()`). While listing, the menu has `z-index:1`, because otherwise the panel, drawn later, covered it.

## Updating the list without a flash

- `buildAll` runs on every render while the panel is open, and a render can come from just pointing at a highlight.
  Rebuilding the list with `replaceChildren` took focus out of an open reply box and put it back, which restarted its
  focus styles: the box flashed on every update.
- `place(parent, nodes)` now updates the list (and each group box, kept by key) by moving only what changed. The open
  card (`openCard`) and the new comment's card are kept between updates. The new comment's card goes into the list at
  its place in page order (`draftBefore`) instead of being moved there afterwards. Focus is put back only if what held
  it was rebuilt.

## Deleted comments and the pulse

- `replies(t)` (thread-view) is a thread's replies that haven't been deleted. The card, the reply counts in the column,
  the panel and the bubble preview use it. The app's `threadsNow()` leaves out threads whose first comment was deleted.
  Render, All comments, the highlights and the count all read it, so a deleted comment leaves nothing behind.
- A pulse (`swell`) keeps a function that gives its content's current boxes, and the frame loop refits it. Opening a
  thread from the panel scrolls the page smoothly, and the pulse now stays on the content instead of where the content
  was.

## Size

+1.6 KB gzip (49.2 → 50.8 KB). The budget rises from 50 to 51 KB. This is Pipeup's own UI, which every page shows, so it
can't move to an add-on. There are no unused styles to cut (checked).

## Change log

- 2026-10-14 — First version.
- 2026-10-14 — From review of the build: the panel stays open until closed, @ and ✓ always show with tooltips, open cards
  show their quote once, the footer's menu draws above the panel, deleted comments go away, and the pulse follows the
  page.
- 2026-10-14 — The list updates in place, so an open reply box no longer flashes when the panel updates.
