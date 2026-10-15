# The comment control as a frosted corner square

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §7 (*The comment control*). Chosen from the options drawn on 2026-10-15:
the slim tab that reaches out on hover (D3), made square, with no border, frosted glass and the count inside a larger
bubble. It replaces the 46 px round button that floated 20 px in from the corner.

## The square (`styles.ts`, `launcher.ts`)

- `.launch` is the visible control. It is fixed at `right: 0; bottom: 0`, has a `border-top-left-radius` of 10 px and no
  border or shadow. Its background is `color-mix(in srgb, var(--su) 62%, transparent)` with
  `backdrop-filter: blur(10px) saturate(1.5)`, so each look (light, dark) frosts with its own surface colour. In
  comment mode (`.launch:has(.mode.on)`) the glass is the accent at 90%, with `--pu-on` for its icon.
- `.mode` (the button) is 32 × 32, transparent, inheriting the colour, its top-left corner rounded to match the focus
  ring. It is 44 × 44 under `pointer: coarse`. The plain mark is drawn at 22 px and the bubble at 28 px, so the count
  (11 px, or 8.5 px for "99+") nearly fills the square.
- `.mode` no longer shares the panels' solid surface rule, and its hover and open fills are gone: the square itself is
  the target.

## Reaching out instead of a tooltip

- `.launch` is a row reversed, with the button at the right edge and `.ttip` before it. `.ttip` is a one-column grid,
  `minmax(0, 0fr)` folded and `minmax(0, 1fr)` open, so its width eases to exactly what its words need, evenly both ways
  (a `max-width` cap would reach full width early and then sit still most of the way when folding, then snap). The
  `minmax(0, …)` lets it fold to nothing despite its words' 10 px padding. It opens on `.launch:hover` after 0.4 s and
  folds at once when the pointer leaves, and while the menu is open. Keyboard focus doesn't open it (it held it open
  for as long as the button kept focus); the shortcut is in `aria-keyshortcuts` and beside Start commenting.
- Its words are the shortcut, preceded only by what is worth reaching out for: the label for threads in other views
  ("3 here · 2 on other slides") and any add-on status. The plain "Comment" is gone from it (it stays the button's
  accessible name).
- With reduced motion it fades only. It has no display on screens with no hover, as before.

## In comment mode it opens All comments

The button's click handler opens the panel (`setList(true)`) instead of the menu while comment mode is on: the
panel's footer already holds comment mode's switch and ⋯ for the menu, so nothing is lost. `aria-haspopup` follows,
`dialog` in comment mode and `menu` otherwise (set with the label). A menu left open from turning comment mode on is
closed by the first click, as before.

## The filters' icons

The @ was a 15 px text glyph beside a 14 px tick icon, so the two stood at different heights and the @ sat high. The
@ is now an icon (`at`, drawn on the same 24 grid) at 16 px and the tick 22 px, both about 8.7 px tall, the words' cap
height; `.tg` has `line-height: 1`, so icon and word share a middle line.

## Icons

- The naming bar's `expand` and `shrink` are two diagonal arrows each (out to the corners, in from them) instead of
  four, and `pin` is redrawn on the same 4 to 20 span as the arrows, so the three stand the same height.
- In an avatar the animal's drawing is 122% of the tint (it has room round it in its 24 grid), so the animal nearly
  fills the tint, with `stroke-width: 1.3` so its line stays as thin as before.

## What moved with it

- The menu rises from 8 px in from the right and 40 px up (it was 20 and 76).
- Messages sit 40 px in from the right and 4 px up, beside the square (they were 76 and 24).
- The column nudges an open card above a 44 px corner (it was 66).

## Size

Pipeup is 52.1 KB gzip. The square alone fitted the 52 KB budget (the tooltip's three transitions became one shorthand,
and the control dropped its own colour rule), but opening All comments in comment mode and the @ icon took it over, so
the budget rises to 53 KB.

## Change log

- 2026-10-15 — First version.
- 2026-10-15 — In comment mode the control opens All comments; the filters' icons stand the same height; budget 53 KB.
- 2026-10-15 — The slide-out eases to its exact width (a grid column) and is the pointer's only: it lingered, then
  clipped, when it eased against a 240 px cap and stayed open with keyboard focus.
- 2026-10-15 — Two-arrow Around it and Inside it, a full-height Pin, and a larger animal in its avatar.
