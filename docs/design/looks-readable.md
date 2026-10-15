# Looks, accessibility and motion: fixes from the click-path review

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §7 (*long comments at rest*, the comment control), §8 (*Motion*), §9
(*accent*, *highlights over any colour*, *text direction*, *keyboard focus* and *forced colours*). These are the looks,
assistive-settings and motion findings from the hands-on review of 0.8.0-beta.2 (LK-02, -03, -04, -05, -07, -08, -09,
-10, -16, -18, -19; sites-05; KB-09; SL-10; MD-13, -14, -15, -16; T18's wording). Each has a browser test in
`e2e/looks.spec.ts` that measures what is seen (contrast, colour, opacity, layout per frame) and failed before the fix.

## Highlights follow the words under them (`highlights.ts`, `app.ts`)

There was one set of highlight colours per page look, switched by Pipeup's own look (`sheet.dark`). A cream tint at 75 %
under light words (a dark footer on a light site, a blue button) or after Theme › Light on a dark page left the words at
1.1 to 1.9 to 1. Now every highlight name has a second form, `pipeup-quote-d`, `pipeup-on-d` and `pipeup-done-d`, for
light words on a dark ground, and each range goes to one or the other by `lightWords(range)`: the words' own colour
against the first opaque background up from them (or the page's canvas), or, over a background image, the words' own
lightness. Pipeup's look plays no part, so `sheet.dark` is gone.

The dark-ground colours are a deep amber, `rgb(180,120,0)` at 35 % (at rest) and 50 % (open), and grey at 20 % when
resolved. Measured over the grounds the review used, the quote highlight keeps light words at 4.5 to 1 or better: #BBB
on #141414 5.9, #F2F2F2 on #1D1D1F 9.2, white on #2F6FEB 4.8 (4.57 without it), white on violet 5.6. The old dark-page
amber (250,200,100 at 28 %) lightened the ground: 4.75 for #BBB, 3.55 on the blue button. The light-ground colours are
unchanged.

`lightWords` reads computed styles, so its answer is kept per range (a `WeakMap`) and read again whenever Pipeup looks at
the page's colours again (the theme observer's `lookAgain`), which also repaints.

## The page's accent only when it reads (`theme.ts`)

A link colour was taken at 3 to 1 on Pipeup's surface, and `--pipeup-accent` was never checked. Now either is used only
when its words reach 4.5 to 1 on the palest surface Pipeup lays under accent words: the 12 % accent tint (`--as`) over
the look's surface (white, or #1B1B19 in the dark look). Otherwise Pipeup's own accent for that look. It is checked
again whenever the look changes. Words on the accent (`--pu-on`) are now whichever of white and #111 reads better
(luminance above 0.19 takes #111), so a readable dark-look accent never gets white words at 3.5 to 1.

## Forced colours (`styles.ts`)

In high-contrast modes backgrounds and shadows are replaced, so the switches (track and knob are backgrounds) drew
nothing, the control looked the same in and out of comment mode, an "on" filter painted its word black on a black
backplate, and your own reaction looked like anyone's. Under `forced-colors: active` these opt out of forced colours
(`forced-color-adjust: none`) and draw with system colours: a switch is a CanvasText outline with a CanvasText knob off,
and a Highlight track with a HighlightText knob on; an "on" filter, your own reaction (and quick-row choice), and the
control in comment mode are filled with Highlight, words in HighlightText.

## Keyboard focus (`styles.ts`)

Menu rows, All comments' cards and a card's action icons showed focus as a 1.04 to 1.15 tint. Every button and link in
Pipeup now gets a 2 px accent ring on `:focus-visible` (1 px outside it), except the four that draw their own: menu rows
and the cards' buttons (`.mi`, a ring 2 px inside, so the menu's folds and the list's scrolling never clip it), the
comment control, the filters, and a column thread's hidden opener (its thread shows the ring). The accent reads at 4.5
to 1 on Pipeup's surfaces, so the ring is at least 3 to 1 in both looks. The rules' old `outline: none` went with it.

## Text direction (`thread-view.ts`, `composer.ts`, `bubbles.ts`)

Comments, replies, a reply an add-on is writing, the hover preview and every writing box have `dir="auto"`, so each takes
its own words' direction inside Pipeup's left-to-right layer.

## Long comments at rest (`column.ts`, `thread-view.ts`, `styles.ts`)

A column card's comment shows four lines (84 px) at rest, its last line fading (a mask), then **more** in the accent;
opened, the text eases to its full height. `restack()`, which measures the cards anyway, sets each comment's
`--full` (its `scrollHeight`) and `.long` when it is taller than 88 px; the text eases between 84 px and `--full`, and
"more" folds in and out like the replies do. All comments keeps its two-line clamp; the bubbles' hover preview (which
had a `clamp` class and no rule) now clamps to two lines too.

## Names beside the actions (`styles.ts`)

A closed card kept 72 px at the end of its top line for its hidden actions, so a 12-letter name was cut. On a closed card
the actions are now laid over the end of the line on a backdrop of the card's own colour (a gradient from transparent,
`--bg`, which a hovered panel card changes), so the name has the whole line until they ease in, and the card never
changes size. An open card keeps them in the line.

## The other-slides dot and the count (`styles.ts`, `launcher.ts`, `icons.ts`)

In comment mode the control is filled with the accent, and the dot was the accent too (1.2 to 1); it now takes the
words-on-accent colour, easing with the control. The count's bubble has a second, wider form (`wide`, an ellipse on the
same 24 grid with the same tail) that cross-fades in for "9+", with the number set 1 px higher in it. The count stops
at "9+" (it went to "99+", which ran into the outline in wide fonts such as Verdana, Arial and Courier New, and in CI's
Linux fallback for Georgia); measured from the font's ink, every count clears the outline by 1.5 px or more, in serif,
sans-serif and monospace page fonts. The exact number is in the control's name and its slide-out.

## A look that differs from the page (`app.ts`, `styles.ts`)

The app now keeps the page's own look (`pageDark`, with the same dead band as before) beside the one it shows, and puts
`.flip` on the layer when they differ (Theme › Dark on a light page, say). Then the corner's glass is solid `--su`, and a
dimmed or resolved card stays solid while its contents dim: the dimming is a variable (`--o`) that the card takes as its
opacity normally, and its children take instead under `.flip`. Dark cards no longer turn into grey slabs, and the
control's count reads at full contrast.

## Motion

- **All comments' list** (`launcher.ts`). `place()` for the list and its groups folds out what leaves (fixed height to
  0, faded, margins and borders to 0, then removed) and grows in what arrives, once the list has been drawn since the
  panel opened. What is folding keeps its place while the rest settle. A card swapped for the same thread's other card
  (opening or closing) goes at once and the new one eases from the old one's height: growing eases a `max-height` to 40
  px past its measured height, so the reply box's buttons easing in meanwhile are never cut and nothing jumps at the end;
  shrinking eases `height`. The group titles and the empty message are kept between updates so they never fold for
  nothing. With reduced motion arrivals only fade in and leavers only fade out.
- **Sending** (`app.ts`, `column.ts`). The draft is marked `sending` while its comment is saved, and the column doesn't
  draw new threads meanwhile, so the new thread no longer appears (stacked above the draft) before the draft has gone.
  Every new card, and the draft itself, now waits unseen until it is first placed and then fades in where it belongs, so
  the sent comment fades in exactly where its box fades out.
- **Reduced motion in the column** (`column.ts`). A card that has to move fades out (`.hop`), moves once it is unseen, and
  fades back in; moves asked for meanwhile join that one.
- **The menu** (`launcher.ts`, `styles.ts`). The footer's version of the menu (above the footer, without Comment and All
  comments) is `.menu.inp`, set only as the menu opens, so the menu closing as the panel opens fades out where it was,
  whole, instead of losing two rows and dropping 48 px.
- **⋯** (`thread-view.ts`). Its pop-in animation runs when it opens (`.pm.in`); rebuilt while open (Delete asking again)
  it changes in place.

## Words

- Resolving says "Resolved · ✓ Resolved in All comments shows it again"; there is no "Show resolved".
- The Theme row's tooltip is "Automatic follows the page; press to change" (the row already ends with the choice).
- A filter's tooltip shows only while it is off, so For you's never covers "No comments mention you".

## Size

Pipeup is 53.4 KB gzip, 1.3 KB more: the CSS for the forced-colour states, focus rings, long comments, the actions'
backdrop and the list's folding is about 0.4 KB, and the code for highlights by ground, the accent check, the list's
fold and grow, the column's fades and the wider bubble the rest. The redundant `outline: none` rules and the list's
transition list were trimmed. The budget rose from 53 to 53.5 KB on its own; with the words-and-focus batch (#80,
+1.7 KB, budget 54 KB) merged in first, Pipeup is 55.0 KB and the budget is 55.5 KB (core and the add-ons' `CORE`).

## Change log

- 2026-10-15 — First version.
- 2026-10-15 — Merged with the words-and-focus batch: Pipeup is 55.0 KB, budget 55.5 KB.
- 2026-10-15 — The count stops at 9+ (99+ didn't fit wide fonts); the exact number is in the name and the slide-out.
