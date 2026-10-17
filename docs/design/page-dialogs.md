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
| A dialog that hears keys before anything else (Radix's Escape, focus-trap's Tab, on `document` in the capture phase) | Escape in a comment box closed the dialog; Tab jumped into it. | Keys Pipeup acts on in its own UI stop on `document` before the page hears them; Pipeup's elements hear a copy. |
| A modal `<dialog>` in a web component's shadow root (Material Web's `md-dialog`) | As a light-DOM modal, and not found by `dialog:modal`. | Found where focus is (opening one moves focus into it); Pipeup moves into it. |
| An element shown fullscreen | Only that element is drawn: Pipeup vanished. | Pipeup moves into it (not into a video, canvas or frame, which can't hold it). |

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

## Keys (`app.ts`, `guardKeys`)

- On `document`, in the capture phase (added at mount, so before a dialog's listeners, which libraries add when the
  dialog opens), a key whose path goes through Pipeup's element and that Pipeup acts on there (`ourKey`: every key while
  typing in it; Escape, Tab, Enter and Space on its buttons; the moving keys in its menus and lists; ← → in the menu)
  stops with `stopImmediatePropagation`. Others (← → on the comment control) still reach the page, as the spec says.
- That also stops it reaching Pipeup's own elements, so the guard dispatches a copy (`composed: false`, so it never
  leaves Pipeup's shadow root) on the original target. The original's own effect (a letter typed, focus moving on,
  a button pressed) still happens, and is cancelled if Pipeup's handling cancelled the copy. If the copy reaches the
  shadow root unstopped, the app's window listener runs for the original (Escape stepping back, the shortcut), as it
  would have.
- Pipeup's listeners on `window` in the capture phase (the block cursor's Tab, the menu's Escape) run first; a key they
  stop never reaches `document`, so the guard never sees it.
- A page listener on `window` in the capture phase still hears keys first; none of the common dialog libraries uses one.

## Web components and fullscreen (`app.ts`, `opened`)

- `opened()` gathers what Pipeup must be inside: light-DOM `dialog:modal`, ones already known that are still modal, the
  modal dialog around where focus is in each shadow root (walking from the deepest active element out through shadow
  hosts), and the fullscreen element (through shadow roots), unless it is the whole page or can't hold children that
  show (`video`, `canvas`, `iframe`, `img`, `object`, `embed`, `audio`). `rehome()` keeps them in the order they
  appeared and moves Pipeup into the last.
- Extra triggers: `focusin` (on `window`, capture: a component's dialog opening moves focus into it, and focus comes
  back as it closes) and `fullscreenchange`.
- Inside a component's shadow root, events from Pipeup's UI are retargeted to the component's host when seen from the
  page, so the focus guard's checks (which compare with Pipeup's own element) don't apply there; a component's native
  modal dialog has no focus trap of its own to guard against.
- `pipeup check` and the Live add-on find Pipeup's element by its tag; both work on the page at rest, where it is under
  `<html>`.

## Not covered

- **Page popovers** (the Popover API: menus and tooltips) are in the top layer above Pipeup, and pressing Pipeup
  closes an `auto` popover (the browser does that for any press outside it). Moving into popovers was ruled out: a
  tooltip opening while someone types would move Pipeup's element and take their caret.
- **Focus traps that poll** (checking `document.activeElement` on a timer) aren't stopped.
- **Frames**: what is inside an `<iframe>` can't be commented on at all.
- **A dialog with a `transform`** would become the containing block of Pipeup's fixed element (not seen in the common
  libraries; untested).

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

Pipeup is 57.7 KB gzip with the first part (+0.3 KB, budget 58 KB), and 58.1 KB with the keys, web components and
fullscreen (+0.4 KB); the budget is 58.5 KB.

## Change log

- 2026-10-17 — First version.
- 2026-10-17 — Keys stay with Pipeup ahead of a page dialog's capture listeners; web components' modal dialogs and
  fullscreen elements; what isn't covered.
