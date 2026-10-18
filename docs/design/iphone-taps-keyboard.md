# iPhone taps and keyboard

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (touch screens, the on-screen keyboard), §7 (the menu by touch).
Found demoing 0.8.0 on an iPhone, and reproduced in the iOS Simulator's Safari with an on-screen log of events: taps
took several tries, and the keyboard covered the comment box. The touch review agents had used Chromium, which sends
a click for every tap, so neither showed there.

## Taps (`app.ts` `listenForTaps`)

- Safari on iOS sends a tap as `mousedown`, `mouseup` and `click` only where it thinks something can be clicked: a
  link, a button, an element with a click listener of its own (or an ancestor's, `<body>` included). A tap on words or
  a picture gets pointer and touch events only. `cursor: pointer` no longer counts, on `<html>` or on every element.
  Pipeup answers presses on the page through `click` on window (choosing a block, closing the menu, opening a thread
  from its marked words, closing a thread), so those taps only worked where they happened to land on a link.
- While Pipeup waits for a tap on the page, a listener on `document.body` that does nothing makes Safari send the
  click (about 30 ms after the touch ends; one tap opened the box in the simulator). Waiting: comment mode, the menu,
  an open thread or box, All comments, or words marked with comments showing. At rest there is none. `render()` keeps
  it in step; the menu, which doesn't render the app, calls `ctx.taps()`.
- The page also gets those clicks, as it would on a desktop. Nothing of the page is changed.

## The menu by touch (`launcher.ts`)

- Start commenting by touch closes the menu 600 ms after the switch moves (the `away` timer, so any other change to
  the menu cancels it). From the keyboard it already closed at once; with a mouse it stays open.

## The keyboard (`layout.ts` `seen`, `room`; `app.ts` `onSeen`, `followPan`)

- iOS shrinks only the visual viewport for its keyboard: `innerHeight` stays the same (714 to 377 points in the
  simulator). `seen()` is what can be seen, from `visualViewport`; `room()` gives popovers that height and its top, and
  `placePopover`/`placeDraft` keep a box inside it, over its block if they must.
- `onSeen` (visual viewport `resize` and `scroll`) waits 250 ms after Safari stops panning, then, if the keyboard has
  just come up and what the open box is about is hidden or leaves no room for the box, scrolls it near the top.
- While the keyboard is up for one of Pipeup's own fields (the window is more than 150 px taller than what can be
  seen), the layer takes `.kb`: the comment control and its messages fade, and boxes no longer keep clear of the
  control.
- Safari pans the page within the window to show the field being typed in. Once it has, `getBoundingClientRect()` is
  measured from what can be seen while `position: fixed` still places from the window, so everything Pipeup drew was
  off by the pan (337 points in the simulator: the box over its block, the outline and naming bar out of sight).
  `followPan()` (every frame) moves the layer by the difference between where its own box measures and the window's
  corner, so drawing and measuring agree again. Elsewhere the difference is always nothing.
- The comment box has `autocomplete="off"`, so the keyboard offers no AutoFill Contact above it.

## The touch hint (`app.ts` `tapHint`, `learnt`)

- Asked for after the demo: the hint is easier to see, and goes once it has done its job. By touch it takes `.tap`:
  filled with the accent, white words at 15 px, balanced over two lines when it wraps.
- `taught` turns true the first time a comment box opens by touch (in `render()`), for the rest of the page's life.
  The hint takes `.taught`: its words' grid column eases from `1fr` to `0fr` and their height to nothing while they
  fade, so it folds to Done beside the control (still the one tap that leaves comment mode). The words are
  `aria-hidden` once folded.
- Messages now put their words in a `.tw` span, so the hint's can fold without touching Done.
- Only an Undo answers ⌘Z or Ctrl+Z (`action.undo`): the touch hint's Done did too, since it was the only other button.

## The selection's icon by touch (`placeIcon`)

- iOS puts its own menu for a selection (Copy, Look Up…) above or below the selection, wherever there is room, so
  "below the words" was under it about half the time. By touch the icon sits at the window's right edge, level with
  the selection's last line, or its first when the last runs into that edge (where its end handle is).

## Not changed

- In the simulator, typing right after a long-press selection let autocorrect replace words ("Is this net of churn?"
  became "Is?"). It happens in a plain page textarea with Pipeup not involved, however the field is focused, so it is
  left to iOS (turning autocorrect off would take it from everyone).

## Testing

- Chromium can't show the iOS behaviour itself, so the browser tests check what Pipeup does about it: the body's
  click listener while waiting (via the DevTools protocol's listener list), the menu closing by touch, and a stand-in
  `visualViewport` that shrinks for a keyboard. The fixes were checked by hand in the iOS Simulator's Safari.

## Size

Pipeup is 59.8 KB gzip (+0.9 KB); the budget rises from 59.5 to 60 KB.

## Change log

- 2026-10-18 — First version.
