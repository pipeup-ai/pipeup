# The newcomer's third pass: the states after the first comment

Design note for the changes agreed from the third newcomer's run (24 November 2026), on the one-menu build with the
second pass in (PR 151). The visual spec with the real screens is [states-pass.html](states-pass.html); the functional
requirements are in [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 and §7.

## What a newcomer met

After Return the box closed and the marker stayed (second pass), but then: the same paragraph lit up to be commented on
again and a click opened a second empty box, with the first comment out of sight; the marker opened the thread as a
form, with the reply line focused and Cancel and Reply waiting; a click on another paragraph while that thread was open
only closed it, with no outline on hover meanwhile; the pin hint arrived on opening the thread; and "Comment discarded ·
Undo" stayed in the corner through a second comment being sent.

## How it is built

All five are in the library (`libs/ts/pipeup`), so every host gets them, and all five are about the pointer: the
keyboard's paths (block cursor, Enter, Shift+Enter, Tab to a marker) keep their behaviour.

- **A commented block reads like its marker.** `quoteAt` (app.ts), which the bubbles' hover and click already use for
  text highlights, also answers, in comment mode, with the thread whose element is the block under the point (the
  block as comment mode would pick it); a text highlight inside the block still wins. So the preview and the click
  come from the one rule for highlights, and comment mode's click handler, which already leaves clicks on highlights
  to it, needs nothing new. Outside comment mode a block isn't a target, so page clicks are left alone.
- **One click while a thread is open.** Comment mode's hover no longer stops offering blocks while a thread is open;
  its click closes the open thread and goes on to choose the block. A reply half-written in the thread holds the click
  (`ctx.replying()`), with the caret put back and a one-line message, as a comment with words does.
- **A thread of your own words opens to read.** `open(id, rest)`: the bubbles pass `rest` for a pointer's click (and the
  preview's); `open` skips focusing the reply line when `rest` and every comment in the thread is the reader's own. The
  resting look is the touch look, already built.
- **The pin hint** is said from comment mode when a box opens on a picture (`img, picture, svg, canvas, video, figure,
  iframe, object, embed`) or on a block taller than half the window, instead of when a thread opens.
- **Undo goes when the reviewer moves on.** `movedOn()` clears a showing Undo offer; called when a comment is sent, a
  reply is sent and a thread is opened.

The bundle grows by about 0.3 KB gzip; the budget goes to 67.5 KB (`scripts/size.mjs`).

## Tests

`e2e/one-thing.spec.ts` (rewritten for one click), `e2e/newcomer.spec.ts` (the pin hint's new moment),
`e2e/newcomer-states.spec.ts` (a commented block previews and opens to read; the Undo offer goes), and
`e2e/focus-reply.spec.ts` (threads with someone else's words still focus the reply line).

## Change log

- 2026-11-24 — First version, with the visual spec and the five changes.
