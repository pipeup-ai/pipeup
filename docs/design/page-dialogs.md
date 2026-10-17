# Working in a page's own dialogs

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §9 (*Pipeup keeps working while a page's own dialog is open*) and §7
(messages while All comments is open). Found after 0.8.0-beta.3: with a dialog open, nothing on the page could be
commented on.

## What broke, by kind of dialog

| Kind | What happened | Fix |
|---|---|---|
| A browser's modal `<dialog>` (`showModal()`) | Everything outside the dialog is inert, Pipeup's element too, and the dialog's top layer is above it: the outline and the box were under the backdrop, the box couldn't take focus, the control couldn't be pressed. | Pipeup's element moves into the dialog while it is open. |
| A library dialog (Radix, shadcn/ui, Bootstrap, MUI) | Its focus trap, listening for `focusin` and `focusout` on `document`, pulled the caret back out of the comment box; a press in Pipeup counted as a press outside, which closes it. | Focus and presses in Pipeup don't reach the page's listeners. |
| The focus-trap library | The same, listening in the capture phase, and cancelling presses outside so focus can't move. | The same, and Pipeup's lines focus themselves when a press on them was cancelled. |
| `inert` on the rest of the page (Headless UI, MUI) | Fine: Pipeup's element is under `<html>`, outside `<body>`. | Tested. |
| An overlay at the highest z-index | Fine: Pipeup's element comes after `<body>` and wins the tie. | Tested. |

The shortcut still does nothing while a page's field has focus (a library dialog usually focuses its first field), as
everywhere: comment mode starts from the control.

## A modal `<dialog>` (`app.ts`, `rehome`)

- `rehome()` lists the open modal dialogs (`dialog:modal`) and keeps them in the order they opened (a new one goes on
  the end, a closed one comes off), so with nested modals Pipeup is in the one on top. With none open, its element goes
  back under `<html>`.
- It runs when a dialog's `open` attribute changes (the theme observer already watches every attribute), when nodes
  are removed (a dialog removed with Pipeup inside it), and once at start (a dialog already open).
- The observer that re-places comments ignores records that only moved Pipeup's own element.
- The top layer itself was tried and doesn't help: a popover shown above a modal dialog is still inert (it can't take
  focus, and hit-testing goes to the dialog). Only a descendant of the dialog is live.
- Its cost, agreed: while the dialog is open it has one more child, so a page rule such as `dialog > :last-child` may
  match Pipeup's element instead. Pipeup's element is fixed over the window, so it never changes the dialog's layout
  itself. A dialog with a `transform` would become the containing block of Pipeup's fixed element (not seen in the
  common libraries).
- In comment mode Escape is Pipeup's, so it steps back instead of closing the dialog; outside comment mode the dialog
  closes on Escape as usual.

## Focus traps and presses outside (`app.ts`, `composer.ts`)

- On `window`, in the capture phase (before the page's `document` listeners in either phase), a `focusin` whose target
  is Pipeup's element and whose `relatedTarget` isn't, and a `focusout` whose `relatedTarget` is Pipeup's element and
  whose target isn't, stop there. Focus moving inside Pipeup, or from Pipeup back to the page, is untouched.
- On Pipeup's element, `pointerdown`, `mousedown`, `touchstart`, `click`, `focusin` and `focusout` stop bubbling, so the
  page's `document` and `window` listeners never count them as presses outside. Pipeup's own listeners are on
  `window` in the capture phase, or inside its shadow root; the app's `click` listener already ignored Pipeup's own.
- A press on a comment or reply line whose default was cancelled (a trap's capture-phase `mousedown`) focuses the line.

## Messages while All comments is open (`styles.ts`)

They sit inside the panel, above its footer, on top of it (`z-index: 2`): beside it they covered a deck's own slide
controls, now centred in the narrower space. The phone rule (the panel fills the screen) was the same, so the two are
one.

## The Esc that closes the menu

The launcher's Escape (on `window`, added at mount) now also cancels the key when it takes it, and comment mode's
Escape (on `window`, added later) skips a cancelled key: with focus on the page and the menu open, one Esc used to close
the menu and leave comment mode.

## Size

Pipeup is 57.7 KB gzip (+0.3 KB); the budget rises from 57.5 to 58 KB.

## Change log

- 2026-10-17 — First version.
