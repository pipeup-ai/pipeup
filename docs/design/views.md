# Slides and hidden views (0.4, part 1)

Status: **approved** (2026-10-07). Functional requirements: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md)
§6 and §8.

## Goal

Comments belong to where they were made — a slide, a tab, a route — and Pipeup shows each one only
there, says how many are elsewhere, and can take the reviewer to them. Hand-made decks work with no
code; frameworks and pages can drive navigation.

## Here

`ui/here.ts` owns **here**: the current view.

- **Slide.** On a page with `[data-pipeup-slide]` elements, the current slide is the marked slide
  that is showing: intersecting the window and not hidden by `display:none`, `visibility:hidden` or
  `opacity:0` on it or an ancestor. If several are, the one covering most of the window wins.
- **Re-checked on events,** batched to one check per animation frame: scroll (capture), resize,
  keyup, click, `transitionend`, and a `MutationObserver` on the slides' `class`, `style` and
  `hidden` attributes. No polling.
- **reveal.js.** When `window.Reveal` exists, the current slide comes from `Reveal.getIndices()`
  mapped to the marked slide (or the n-th `.slides > section`), it listens to `slidechanged`, and
  navigates with `Reveal.slide()`.
- **Hooks.** `Pipeup.mount({ slides: { current(): number, go(n: number): void } })` replaces
  detection for a deck. `Pipeup.onReveal(fn)` registers a handler called with a view
  (`{ slide: "3" }` or the page's state) when the reviewer chooses a thread elsewhere.
  `Pipeup.setViewState(state)` reports the page's own view (`{ tab: "pricing", label: "Pricing tab" }`;
  string values; `label` is the readable name and is not compared).
- **The view** = `{ slide?, ...pageState }`. New comments save it in `anchor.view` (the signed
  field already exists; the UI starts filling it).
- **Navigate(view)**: the deck hook's `go`, else reveal.js, else `onReveal`, else scroll the slide
  into view. Resolves when here matches or after 1 s.

## Here or elsewhere

A thread is **here** when:

- on a slide page: its `view.slide` is the current slide (threads with no slide count as here);
- otherwise: every key of its saved view except `label` equals the current page state (a thread
  with no saved view, or a page that never called `setViewState`, is here), and its content is
  attached and not hidden. Detached (deleted) content counts as here and is listed under "No longer on the
  page"; content hidden on the page with no other view is listed under "Hidden on the page".

Threads elsewhere get no bubble, pin or highlight. A change of here re-renders through the existing
fade paths (eased; cross-fade with reduced motion).

## On screen

- **Control.** The number counts open threads here. A small dot on the button shows open threads
  elsewhere. Its label: "2 here · 5 on other slides" or "· 5 in other views".
- **All comments.** On slide pages, groups in deck order headed "Slide 3 · 2 open", this slide's
  group marked "This slide". On other pages, threads elsewhere are grouped under their view's
  `label` (or its values joined with " · ").
- **Choosing a thread elsewhere** navigates, then opens it on its content; if the content doesn't
  appear, it opens as a side thread with its snapshot (the existing lost-thread path).
- **Copy as Markdown** already names slides; non-slide views add their label to the "Where" line.

## Size

Budgets were 33 KB (min and esm) and 12 KB (core) for this part. The size pass came first and freed 0.43 KB gzip with no
change in behaviour (shorter internal style tokens and property names); 2.5 KB was not there to be had without
dropping behaviour, and slides and views need about 1.9 KB, so the min and esm budgets went up by 1 KB.
For part 2 (keyboard, touch and the drawer) the budgets are **36 KB** (min and esm) and 12 KB (core); see
[keyboard.md](keyboard.md).

## Testing

- Unit: here-or-elsewhere rules; view equality ignoring `label`; slide choice by visible area (fake
  boxes).
- e2e fixtures: a class-toggled deck (like the Try deck), a scrolling deck, a reveal.js-shaped stub
  (`window.Reveal` with `getIndices`, `slide`, events), a tabbed page using `setViewState` and
  `onReveal`.
- Behaviours: only this slide's threads show; they fade on change; the control counts and marks;
  All comments groups; choosing elsewhere navigates then opens; no hook → side thread; deck
  navigation keeps working in comment mode; nothing on the page's DOM changes.

## Not doing

Build steps (fragments); more framework adapters (Slidev, impress.js, Marp); opening `<details>`
or tabs for the page.

---

## Change log

- 2026-10-07 — First version.
- 2026-10-07 — Size: budgets 33 KB (min, esm); the size pass freed 0.43 KB, not 2.5 KB.
- 2026-10-07 — Built. Decisions made while building: equal areas (a cross-fade) go to the more opaque slide and a
  full tie keeps the current one, so a cross-fading deck changes here as its fade passes the middle or ends; new
  comments take the slide that holds their content; `slide` is Pipeup's own and is dropped from page state;
  hidden content with no view of its own is listed under "Hidden on the page"; a thread that can't be reached
  opens beside the panel saying "On slide 3 — it read …" (or "In FAQ tab — …"); the panel's count and the
  menu's All comments count every open thread, the control only those here; reveal.js vertical slides are
  followed by their horizontal index only.
- 2026-10-07 — Here or elsewhere: detached content counts as here ("No longer on the page"); hidden content with no other view is "Hidden on the page".
- 2026-10-07 — Size: budgets 36 KB (min, esm) and 12 KB (core) from part 2.
