# One Copy row, Theme, and Space to pause

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (holding Space pauses comment mode) and §7 (the menu's rows). Builds on
[panel-filters-hover.md](panel-filters-hover.md) and [comments-at-rest.md](comments-at-rest.md).

## Copy comments (`launcher.ts`, `styles.ts`)

- The two copy rows become `copyRow` ("Copy comments", with a `chev` icon at its end) and `copyChoices`, a `.subs` group
  holding `mdRow` (As Markdown, `copyAll("ai")`) and `textRow` (As text, `copyAll("text")`). Both choices close the menu,
  as the rows did.
- `setCopy(on, focus)` sets `aria-expanded` on `copyRow`, toggles `.open` on the group and makes it inert while folded.
  With `focus`, opening moves focus to As Markdown, and folding moves it back to Copy comments. A click on Copy comments
  toggles it; → opens it from the keyboard and ← folds it from inside. The menu's arrow keys skip rows inside an inert
  group (`items()` now leaves out `[inert]`).
- `setMenu` runs before the rows exist, so it reaches them through `foldCopy`, assigned once they are made. Closing the
  menu folds the choices, so it always opens folded.
- `.subs` unfolds with `grid-template-rows` 0fr → 1fr and opacity (opacity only with reduced motion). The choices are set
  in by 30 px under their row, and the chevron turns a quarter.

## Theme

The Look row's label is now "Theme". Its icon, its three states and the stored choice (`ctx.menu.look()`, `setLook`) are
unchanged, so a reviewer's earlier choice is kept.

## Space to pause (`shortcut.ts`, `comment-mode.ts`)

- `HOLD` is `" "` and `HOLD_LABEL` is "Space" on every platform. The `holding(MouseEvent)` check is gone: a mouse event
  can't tell whether Space is down, so a missed key-up is ended by the window's `blur` (as before) and the next key-up.
- `holds(e)` decides whether a Space keydown is the pause. It is not when a modifier is down or the keys are composing,
  when focus is in a text field (`input`, `textarea`, `select`, `contenteditable`), or when it is on a control matching
  `CONTROL` that `:focus-visible` (reached from the keyboard, so Space presses it). A control that has focus only because
  it was clicked doesn't match `:focus-visible`, so a page button pressed during one pause doesn't take Space from the
  next. The block cursor's markers always count as the pause: Enter comments there, and Space no longer does.
- On a pause keydown (and every repeat while paused, whatever has focus), the capture listener on `window` calls
  `preventDefault` and `stopPropagation`: the page neither scrolls nor hears it (a deck doesn't turn a slide). The
  matching keyup ends the pause and is swallowed the same way.
- The hint reads "Hold Space to use the page" through `HOLD_LABEL`.

## Size

Pipeup is 51.9 KB gzip (+0.3 KB, within the 52 KB budget).

## Change log

- 2026-10-15 — First version.
