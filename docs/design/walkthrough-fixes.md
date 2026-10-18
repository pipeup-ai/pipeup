# Fixes from the walkthrough

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (selecting words), §7 (*compact cards*, opening a thread, the comment
control) and §10a (mentions). These are the five bugs found by walking every feature through a document, a website and a
deck, on a phone and on a dark page. They build on [panel-hub.md](panel-hub.md).

## A mention of you (`styles.ts`)

The avatar button in the comment box (`button.me`) and a mention of you in a card (`span.mn.me`) shared the class `me`, and
the button's rule (`display:grid`) turned the mention into a block. The rule is now `button.me`, so the mention stays inline
and only `.mn.me`'s bolder weight applies.

## Messages beside the round button (`styles.ts`)

`.toast` sits at `right: var(--r)` and `bottom: 24px`, so it is level with the round button (20 px in, 46 px across) and to
its left. `--r` is 76 px at rest, the panel's width plus 16 px while All comments or an add-on's panel is open, and 12 px
(with `bottom: 64px`, above the footer) when the panel fills a narrow screen. Its width is at most 320 px and never more
than the room left of `--r`, so a long hint wraps instead of reaching the bottom centre. Moving between these eases
(`transition: .3s`); with reduced motion only the opacity changes.

## The column's open card (`column.ts`)

`restack()` gives the thread it lines up exactly (the draft, else the open thread) a `want` no lower than the window's
bottom minus the button's corner (66 px), 10 px of air and the card's height, and no higher than 8 px below the window's
top. It does this only when the column reaches the button's corner (`col` ends within 66 px of the window's right edge).
`stackColumn` then moves the cards above it up as usual. The column restacks whenever a card changes size, so a growing
reply box stays clear too. The nudge is worked out from the scroll position at the time; when the reader later scrolls,
the card keeps its place on the page.

## Popovers with no room beside (`layout.ts`, `geometry.ts`)

`AnchorPoint` carries `box`: the element's box for an element comment, a 24 px square around a pin, and the last quoted
line for a text comment. When an element or pin popover doesn't fit to the right of its bubble, `placePopover` no longer
flips it to the left (which covered the element's text) but uses `placeDraft(box, size, vp, margin, 0)`: below the box,
above it when there is no room below, and when neither fits, as low as fits on screen. That last case is new in
`placeDraft` too, so a draft on a block taller than the window stays on screen.

## The selection's icon (`select.ts`, `layout.ts`)

`placeIcon(sel, line, textRight, size, vp)` puts the icon 8 px past `textRight`, the right edge of the text in the
selection's block (`blockOf`, measured with a range over its contents), and centres it on the selection's last line. When
that would leave the window, it falls back to `placeBar` (above the selection, or below it). Past the block's text the icon
can't cover the block's words, whatever is above or below the selection.

## Size

+0.4 KB gzip (50.7 → 51.1 KB). Trimming found 30 bytes (sharing `blockOf`, reusing `placeDraft`), not the 100 needed to stay
under 51 KB without dropping a fix, so the budget rises from 51 to 52 KB.

## Change log

- 2026-10-14 — First version.
