# All comments: filters that read as on/off, and actions on a closed card

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §7 (*All comments*, *Actions*). Builds on [panel-hub.md](panel-hub.md).

## The filters (`launcher.ts`, `styles.ts`)

- `filter(word, tip, face, run)` replaces `iconSwitch`. Each is a `button.tg` holding its icon (`<b aria-hidden>@</b>`, or
  the `resolve` icon at 14 px) and its word: **For you** and **Resolved**. `aria-label` is the word, because the tooltip
  is drawn by `.tg::after` (`content: attr(data-tip)`) and generated content would otherwise join the accessible name.
  `aria-pressed`, `aria-description` and `data-tip` are as before ("Only comments that mention you", "Show resolved
  comments too").
- `.tg` is a pill: 28 px high, `border-radius: 99px`, 13 px words with a 5 px gap after the icon, `white-space: nowrap`.
  Off: `color: var(--mu)`, no background. Hover: `var(--ho)` and `var(--k)`. On (`[aria-pressed=true]`): `var(--as)`
  (the accent at 12%) and `var(--pu-accent)`; hovered while on, the accent at 20%. Background and colour ease over
  0.2 s. Dark needs no rules of its own: `--as` is mixed from the dark accent (`#9A94EE` unless the page sets one), and
  `--ho` and `--mu` have dark values. With forced colours, the on pill is `Highlight` / `HighlightText`, since the
  tint is dropped there. On coarse pointers the existing `min-height: 36px` applies.
- Both pills and × fit at 320 px with room to spare (about 90 px each), and at phone widths the panel is full width.

## Actions on a closed card (`thread-view.ts`, `launcher.ts`, `styles.ts`)

A closed card used to be one `button.mi` with the card's words inside it, and a button can't hold buttons. Now:

- **`threadView` has a `card` variant**: only the first comment. The `.more` part (replies, the reply line, the
  addressed note, the seen mark) is never attached, so no second reply box for the thread is in the page.
  `note` replaces the quote line with the card's own (quote, lost snapshot or location, as the row showed it) and
  `rest` is the card's last line ("2 replies · 👍 1"). `reactionRow` takes `bare`: only the quick row, never the
  chips, since the card counts reactions in `rest`. Everything else (React and its quick row, Resolve or Reopen, ⋯ with
  Copy thread, Edit and Delete asked twice, editing in place, the menu closing when focus leaves) is the same code as
  the open card.
- **The closed card is `div.cd` > `button.mi` + the card view.** The button is `position: absolute; inset: 0` over the
  card, transparent, and holds what the card shows in a `.sr` span (for screen readers, and so `getByRole` names stay
  the same). Being positioned, it paints over the view's static content, so a click on the words reaches it and
  opens the card. `.acts`, `.refs` (the quick row) and `.edit` are `position: relative; z-index: 1`, above it, and `.pm`
  is already absolute at `z-index: 5`. A click on an action therefore never reaches the card's button: nothing opens.
  The card has no click handler of its own.
- **Closed cards are kept** by thread id (`closed`: card element and view) and updated in place, like the open card.
  A rebuilt card under a still pointer would lose `:hover` for a frame and its actions would blink; kept, it stays
  hovered, and the view's state (quick row, ⋯ menu, edit box) survives updates. Entries for threads no longer listed
  are dropped after each build.
- **Showing the actions**: `.cd:not(.open):not(:hover):not(:has(:focus-visible,.pm)) .acts{opacity:0}`, easing with
  `.acts`' existing opacity transition. `:focus-visible` rather than `:focus-within`, because opening the panel with a
  click puts focus on the first card, and its actions shouldn't appear for that; arrow keys or Tab show them. An open
  ⋯ menu keeps them. The actions sit in the card's `.hdr`, laid out whether seen or not (as on column cards), so
  nothing moves or changes size when they appear. The card's hover tint is now on `.cd` itself, since the button
  over it is transparent.
- **Touch**: under `@media (hover:none)` a closed card's `.acts` are `display: none`, so an invisible Resolve can't be
  tapped by accident; tapping the card opens it, with its actions, as before.
- **Resolve** on a closed card goes through `cardActions.resolve`: when the card will leave the list (resolved threads
  hidden, no reduced motion), it is marked `leaving`, its height is pinned and then set to 0 with `.cd.out` (opacity,
  margin and border easing out over `--mv`), and the thread is resolved after 340 ms. The class survives rebuilds
  through the `leaving` set. With reduced motion, or with resolved threads shown, it resolves at once.
- **Keyboard**: Tab from a card's button reaches its React, Resolve and ⋯; the arrow keys still move between cards.
  Escape in a closed card's actions puts focus back on the card's button (it no longer closes the panel from there);
  an edit box opened there keeps its own Escape. When an update rebuilds a card's actions, focus goes back to the same
  button, or, if the card left the list, to the card now in its place.

## Size

Pipeup goes from 51.1 to 51.6 KB gzip, inside its 52 KB budget.

## Change log

- 2026-10-15 — First version.
