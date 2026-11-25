# Safari's app window: one picture, one line, one button

Status: **built** (2026-11-25). Functional requirements: [EXTENSION_SPEC.md](../EXTENSION_SPEC.md) §3 (change log,
2026-11-25). Visual spec: [safari-app-window.html](safari-app-window.html) (before and after, the three states, where
each cut piece goes). Targets `next` (1.1.0).

## The problem

Safari's Pipeup is a Mac app that carries the extension. Its window opens once after install and whenever the app is
launched, and it read as a wall of text: an introduction, the state line, a button, three numbered steps, three links
and a licence paragraph. About a hundred and twenty words, five kinds of text, and the one line that mattered sat in the
middle. The maintainer asked whether all of it was needed and whether it could be more visual.

## The shape

The window keeps what only it can do: say whether Pipeup is on in Safari, and get it turned on.

- One drawing. Not on yet, or off: Safari's Extensions pane with Pipeup's row and an empty tick. On: a page with
  Pipeup's button pressed and one comment on a paragraph. The drawing is the how-to.
- One line, in two parts: the state, then what to do about it.
- One button that answers the line: **Open Safari Settings** while Pipeup is off; **Try it on a sample page** once it
  is on, which opens Pipeup's sample page in Safari.
- A footer: Support, Privacy, Source and **Licences**. Licences shows the MIT and emojibase notices in the window, with
  a way back. The notices stay in the package too.
- Light and dark as the Mac, both palettes in the drawing. The window keeps one size; the state swaps ease in.

What went: the introduction (the store listing said it, before install), the three steps (the toolbar menu teaches them
one at a time), the licence paragraph (behind Licences and in the app's About panel). Sixteen words on the window with
Pipeup on, from a hundred and twenty-one.

## How it is built

- `apps/extension/safari/Main.html`, `Style.css`, `Script.js` and `ViewController.swift` are copied over Apple's
  converter's stock files by `tools/build-extension.mjs`; the licences page is `Licences.html`, copied beside them, and
  filled from the package's LICENSE and THIRD-PARTY-NOTICES.txt at build time.
- The app tells the page the state (`show(enabled, settingsWord)`) as before; the page swaps the drawing, the line and
  the button with a short cross-fade.
- Two messages to the controller: `open-preferences` (as before) and `open-sample`, which opens the sample page in the
  person's default browser session of Safari and leaves the window open.

## Change log

- 2026-11-25 — Proposed from the window seen on a dev build; built the same day.
