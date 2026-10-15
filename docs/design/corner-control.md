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

- `.launch` is a row reversed, with the button at the right edge and `.ttip` before it. `.ttip` starts at
  `max-width: 0` and `opacity: 0`. On `.launch:hover`, or while the button has keyboard focus, it eases to 240 px wide
  (it only takes what its words need) with 10 px of padding, after 0.3 s. While the menu is open it folds away.
- Its words are the shortcut, preceded only by what is worth reaching out for: the label for threads in other views
  ("3 here · 2 on other slides") and any add-on status. The plain "Comment" is gone from it (it stays the button's
  accessible name).
- With reduced motion it fades only. It has no display on screens with no hover, as before.

## What moved with it

- The menu rises from 8 px in from the right and 40 px up (it was 20 and 76).
- Messages sit 40 px in from the right and 4 px up, beside the square (they were 76 and 24).
- The column nudges an open card above a 44 px corner (it was 66).

## Size

Pipeup stays at 52.0 KB gzip, 9 bytes under its budget: the tooltip's three transitions became one shorthand, and the
control dropped its own colour rule (buttons already inherit it).

## Change log

- 2026-10-15 — First version.
