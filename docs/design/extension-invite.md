# The extension, offered from the page

Status: **proposed** (2026-11-27; agreed with the maintainer as a visual spec, not built). Functional requirements:
[FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §7c (the menu's row list in §7 names it; §18 places it in 1.2). Visual spec:
[extension-invite.html](extension-invite.html) (flow, the menu before and after, wording, which browsers). Targets `next`.

## The problem

Pipeup for browsers is in the stores (Chrome submitted; Safari in review, 27 November 2026), but a reviewer who meets
Pipeup on a page has no way to learn it exists. The page is where they are; its menu is the one place Pipeup speaks.

## What was decided

- One row, first from the top of Pipeup's ⋯ menu, named for the browser ("Pipeup for Chrome"), opening to two choices
  beneath it as Copy comments does: the store, and Don't tell me again. Either ends the offer on this site.
- Only where the browser has a **public** listing (a list shipped in the build), only on Pipeup's own menu, never by
  touch, never a toast or badge, no network, nothing told to anyone.
- Authors turn it off with `data-pipeup-extension="off"`; nothing else about it is theirs to change.
- Remembered where Theme and Hide comments are: per site, in this browser. Pipeup can't know whether the extension is
  installed, and keeps nothing across sites; both are said plainly rather than worked around.

## Open before building

- The store addresses: the Chrome Web Store id is known once the listing is public; Safari's App Store id once approved.
  Each joins the shipped list in the release that follows its listing going public, never before.
- Where the browser check lives: core has no browser detection today (`apps/extension/src/browser.js` has the
  extension's); the rule is the same, most specific name first.
- Size: estimated 0.4 KB gzipped against the 53 KB budget (`scripts/size.mjs`); measured when built.

## Change log

- 2026-11-27 — Proposed: visual spec drawn and agreed; §7c written. Not built.
