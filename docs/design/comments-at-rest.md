# Comments at rest, Hide comments, and pausing comment mode

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (holding ⌘ pauses comment mode), §7 (*When comments show*,
the menu's Hide comments, All comments) and §9 (the gutter). This reverses the 2026-10-06 rule in
[architecture.md](architecture.md) §11 *Visibility*, where comments showed only in comment mode.

## Visibility

- `UiState.hide` is the reviewer's choice. It starts from `localStorage["pipeup:hide:<doc id>"]` (`"1"` when on),
  is written by `menu.setHide()`, and is kept per document, so another page on the same origin isn't affected.
  Without storage the comments show and the choice lasts for the visit.
- `render()` derives `hidden = hide && !commenting && !listing && !reading && !draft`. Everything else that
  followed `hidden` (the highlight fade, the gutter, open threads closing) is unchanged.
- Since comments show at rest, the bubbles view's highlight hover and click work outside comment mode through the
  same `ctx.readsAt` rule. Outside comment mode (and while it is paused), a highlight on one of the page's links
  or controls leaves the click to the page, as before.
- The menu gains a `hide` icon (an eye, struck through) and the Hide comments switch above Start commenting.
  Start commenting's tooltips no longer say it shows the comments.

## All comments: comments clicked on the page

- The panel registers `ctx.registerList(open)`. While `listing`, `app.open(id)` hands the thread to the panel
  instead of opening it on the page. That covers a highlight, a bubble, a bubble's preview and a column thread,
  which all go through `ctx.open`.
- Opened from the page, `toggle(id, true)` scrolls the panel's row into view but leaves the page where it is:
  the reviewer just clicked on that place, and scrolling it to the centre would move it from under the pointer.
- The panel's window click handler (capture) no longer closes the panel for a click a view claimed. The bubbles
  view claims a click on a highlight before the panel hears it, because views are created before the launcher.

## Holding ⌘ (Ctrl elsewhere)

- `shortcut.ts` exports `HOLD` (`"Meta"` on Apple platforms, `"Control"` elsewhere), `HOLD_LABEL` and
  `holding(e)`.
- Comment mode sets `UiState.paused` on that key's keydown and clears it on its keyup or on the window's `blur`.
  `pause()` hides the hover outline (not a chosen block or an open draft) and re-renders.
- `render()` applies the picking cursor only when `commenting && !paused`.
- While paused, `onMove`, `mute` and `swallow` return early, so the page hears pointer events, clicks and
  submits as normal.
- Every pointer event is checked against the key itself (`paused(e)`). A pause whose key-up was lost ends with the
  next move, and a key pressed while the window wasn't listening still pauses.
- The keyboard's block cursor is untouched. The pause is for the pointer.
- Comment mode's hint adds "Hold ⌘ to use the page" (Ctrl elsewhere).

## Size

About 0.4 KB gzip: Pipeup is 49.2 KB against its 50 KB budget.

## Change log

- 2026-10-14 — First version: comments at rest, Hide comments, opening page clicks in All comments, and the ⌘ pause.
