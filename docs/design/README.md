# Design notes and visual specs

Every change in behaviour has a functional requirement in [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) or
[EXTENSION_SPEC.md](../EXTENSION_SPEC.md), and a note here says how it was built, with a change log of its own. A
visual spec (an `.html` page of flow and mock-ups) is how a design is agreed before it is built. Notes and visual
specs are records: once a later pass redoes a thing, the earlier page is history, kept but not followed.

## Visual specs, current

- [extension-invite.html](extension-invite.html) — the extension offered from the page's own menu (extension-invite.md; 1.2).
- [extension-menu.html](extension-menu.html) — the browser extension's one toolbar menu (one-menu.md).
- [newcomer-pass.html](newcomer-pass.html) — the newcomer's first run, second pass (newcomer-pass.md).
- [states-pass.html](states-pass.html) — the states after the first comment (states-pass.md).
- [safari-app-window.html](safari-app-window.html) — Safari's app window (safari-app-window.md).
- [extension-private-typing.html](extension-private-typing.html) — the extension's typing frame.
- [refind-comments.html](refind-comments.html) — re-finding comments on changed pages.
- [one-thing-at-a-time.html](one-thing-at-a-time.html), [compact-asks.html](compact-asks.html) — the page-side box and asks.

## Visual specs, history

browser-extension.html, extension-native-ui.html, extension-on-page.html and extension-pin.html are the extension's
first four shapes (November 2026), each redone by the pages above. The `*-mockups.html` pages are earlier
explorations of their notes (agent hand-off, assist, editions, local agents, micro core, one front door, one-screen
home, one-tap page API, quick start, readable Markdown, signed replies).

## Keeping it fresh

- Anything not built lives only in the functional spec's §17 (out of scope) or §18 (phases), one line each, never in
  the body of a section.
- A note's first lines carry its status (`Status: **built**`, `**withdrawn**`, …) and point at its requirement.
- Before each milestone, the specs are read against the code and the tests, and every sentence that no longer holds
  is fixed in one pass (25 November 2026 was the first).
