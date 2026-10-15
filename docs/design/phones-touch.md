# Phones and touch

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (touch: 44 px, fitting the screen, Pin, the touch hint), §7
(nothing under the control, the reply box waits, bubbles on screen, the menu fits, the narrow panel), §7b (a long
press on a reaction). From the touch review of 0.8.0-beta.2 (findings T03 to T18). Builds on
[words-and-focus.md](words-and-focus.md), which is not repeated here.

## One test for touch (`layout.ts`)

`touch()` is the stylesheet's `pointer: coarse`, read with `matchMedia`, so the code and the styles agree on what a
touch screen is. It decides Pin (T05), the hint (T06), the reply box (T08) and the selection's icon (T11). Hiding
shortcut labels (`.ks`) is CSS only, and only where there is no hover either (`pointer: coarse` and `hover: none`), so
a tablet with a keyboard and trackpad keeps them.

## Fitting the screen, clear of the control (T03, T04, T10, T13)

- `Viewport.keep` is where the comment control's corner starts. `floor()` is the lowest a box may reach: a box that
  reaches past `keep.left` stays 8 px above `keep.top`. `placePopover` and `placeDraft` use it, so a thread beside a
  bubble, a preview and a new comment's box are never under the control. Bubbles measure the control
  (`.launch .mode`) each frame, so a control moved or resized is followed; in comment mode on a touch screen `keep.left`
  is 0, because the hint runs along the bottom beside the control.
- When the corner is in the way below a block, `placeDraft` first tries moving the box left of the control (a
  desktop window 300 px tall), and only then up over the block.
- `placePopover` clamps a thread on words to the window: words that went below it (a phone turned) no longer take
  the thread off screen. After a change of width, `inView()` (app) scrolls what the open thread or new comment is on
  back into view, near the top so the thread fits below it. Height alone doesn't count: a phone's keyboard changes it.
- `placeBar` puts the naming bar at the window's top when a block leaves room neither above nor below; and
  `positionBar` keeps it off the comment box (just above the box, or below it), which on a phone often sits over a
  tall block. Before this the bar sat under the box and covered its Comment button.
- The naming bar has `max-width: calc(100% - 16px)`; its label (`overflow: hidden`, so its flex minimum is 0) shortens
  first, and the icons keep their 44 px.
- Bubbles are placed with `across()`: their point is kept 20 px from the left and 30 px from the right, so the bubble
  and the 44 px round it are on screen. Only across: a bubble scrolling off the top or bottom goes with its content.
- `placeDraft`'s room for the naming bar is 60 px on touch, where the bar is taller.

## Pin by touch (T05)

The naming bar's Pin, clicked with a pointer (`detail` > 0) on a touch screen, calls `wait(true)`: the button is
pressed (`.nb.on`), the label says "Tap where to pin", and screen readers hear it. `onPick` sends the next tap on the
page to `pin(e)`, the same as Option-click, so the words typed so far are kept. `ctx.state.pinning` stops a highlight
taking that tap (`readsAt`). Choosing anything else (`choose`) lets go; so does Pin again. From the keyboard (`detail`
0) Pin still pins the centre.

## Comment mode's hint (T06, T18)

- The hint now waits for the menu to close (`hintLater`, shown from `frame()`), for every pointer: nothing of Pipeup's
  covers a message. The keyboard's hint waits the same way.
- By touch, `tapHint()` says "Tap what you want to comment on" with **Done** (`setCommenting(false)`). `toast()` takes
  `ms = 0` for "until replaced". `hideHint()` leaves it alone while `tapping()`; another message takes its place for its
  time, and the hint comes back 0.32 s after it fades. While All comments covers the page it goes (`render`), and it
  comes back when the panel closes.
- A message's words take no taps: only its button does (`.toast.show .ta`). What is under the hint (a deck's slide
  controls on a phone) still works. This also stops a faded Undo message from catching clicks.
- On touch a message is one 44 px bar (two lines of words fit), `--r` is 52 px to clear the 44 px control, and boxes
  keep 8 px above it.

## 44 px (T07)

One `pointer: coarse` rule sets `min-height` (and `min-width` where a button can be narrow) to 44 px on every button
a finger presses: the menu's rows, a card's actions, the ⋯ menu, reaction chips and the quick row, Cancel, Comment and
Reply, the filters and Close, the footer's switch and ⋯, the naming bar's icons, the selection's icon, the draft's
avatar and "add your name", messages' buttons and add-ons' buttons. Writing lines are 44 px tall. A bubble keeps its
20 px look; a `::before` 14 px round it makes a 44 px circle that takes the tap.

## Threads open without the keyboard (T08)

`open()` passes `busy` when `touch()`, so `focusReply` remembers the opener (for Esc) but doesn't focus the line; All
comments' `toggle` does the same. Tapping the line focuses it as usual. "Still not right" still puts the caret there,
as the reviewer asked to write.

## The selection's icon (T11)

`placeIcon(..., below)` centres the icon under the selection, 20 px down, clear of the phone's selection menu above
and of its handles at the selection's ends; above when there's no room below.

## The menu fits (T12)

`.menu` sits at `bottom: var(--b)` (40 px, 52 px on touch, 60 px above All comments' footer). In a window up to 600 px
tall it has `max-height: calc(100% - var(--b) - 8px)` and scrolls. Only short windows scroll, because a scrolling box
clips the tooltips beside the menu's rows; touch has no tooltips anyway.

## Who reacted, by touch (T15)

A chip's `pointerdown` from a finger starts a 0.45 s timer; when it fires the chip gets `.held`, which shows `.rc`
as hover does, and the click that ends the press doesn't toggle the reaction. The next `pointerdown` anywhere takes the
names away. `contextmenu` is prevented on chips. `.rx.new`'s entrance now fills `backwards`, not `both`: a finished
animation that kept filling left the chip a stacking context, so the names (hover's too) were drawn under the reply
line.

## The narrow panel (T16)

On a narrow screen, `threadOptions(t, about)` gives an open element or pin thread its closed card's `about` (where it
is) as `note`. A comment moved into the panel shows its label again (`hideLabel(false)`): the naming bar on the page
may have hidden it.

## Not changed

- **T09**, the control over a page's own bottom-right tab or button: no simple change fits the spec. Moving the
  control needs a reliable way to find a page's fixed controls; the spec only asks for that on decks (the control sits
  above a deck's own corner controls), which is separate work.
- On a phone, comment mode's hint covers the page's last lines while comment mode is on, as the spec asks for a hint
  that stays. Taps go through its words, and Done is one tap away.

## Size

Pipeup is 54.9 KB gzip on its own (+1.1 KB over #80); with the looks batch (#81) merged in, it is 56.2 KB and the
budget is 56.5 KB (`scripts/size.mjs` and the add-ons' `CORE`).

## Change log

- 2026-10-15 — First version.
- 2026-10-15 — Merged with the looks batch: Pipeup is 56.2 KB, budget 56.5 KB.
