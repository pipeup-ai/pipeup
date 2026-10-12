# Looking the same on every site

Status: **draft, for review**. Functional requirements: [FUNCTIONAL_SPEC §9](../FUNCTIONAL_SPEC.md)
("Pipeup looks the same on every site", "light or dark as a whole"). Bug fix: targets `main`.

Code paths are relative to `libs/ts/pipeup/`.

## What was reported

Two screenshots of a dense, styled status page that has its own light/dark switch (2026-10-12):

1. The comment cards in the right-hand column are washed out: text and avatars almost vanish.
2. Later, the All comments panel and an open comment are dark while the page and the highlight are light.

## What already protects Pipeup

- One element, `<pipeup-root>`, appended under `<html>`, with an open shadow root (`src/ui/host.ts`). Page
  selectors cannot reach inside it.
- The host element is styled inline with `!important` for position, z-index, display, opacity, transform
  and filter.
- `:host{all:initial}` and `.layer{all:initial}` (`src/ui/styles.ts`) reset the inherited properties the
  page sets on `<html>`/`<body>`.

So a plain "page CSS leaks in" is unlikely to be the whole story. Candidate causes, most likely first:

| # | Cause | Why it fits | How to confirm |
|---|---|---|---|
| A | **Theme read once, and on the wrong signal.** `readTheme` decides `dark` from `body`'s (else `html`'s) computed background luminance. `applyTheme` reruns only when attributes change on `<html>` or `<body>` (`src/ui/app.ts:775-777`). A page that switches theme by a class on a wrapper element, or whose body has no background of its own, is read wrongly or goes stale. | Explains screenshot 2 (dark Pipeup on a light page) and the washed-out look in 1 (light-on-light text if the layer is dark but a surface is light). | Reproduce on the site; log `readTheme(...)` before/after the page's switch. |
| B | **Dark applies to some parts only.** `dark` is a class on `.layer`; the page highlights are painted by a separate sheet built once with `installPageSheet(document, theme.dark)` (`src/ui/highlights.ts`), so on a theme change the layer flips and the highlight colours don't. | Pins/highlights light while panel is dark. | Toggle the page theme; compare. |
| C | **`all` does not reset everything.** It leaves `direction` and `unicode-bidi` alone and custom properties. A right-to-left page flips Pipeup's layout; a page that defines our short variable names (`--k`, `--su`…) on `html` is only safe because `.layer` redeclares them, and any variable declared only by inheritance (`--pu-accent`, `--pu-font`) can be overridden. | Not in the screenshots; common elsewhere. | Hostile test page (below). |
| D | **Ancestor effects.** `opacity`, `filter`, `mix-blend-mode`, `zoom`, `transform`, `backdrop-filter` on `<html>` or `<body>` apply to the whole `<pipeup-root>` subtree regardless of the shadow boundary (we set `opacity/transform/filter` on the host, but not on its parent). `color-scheme`, `forced-colors`, and `text-size-adjust` also interact. | Washed-out look if a page fades its body. | Hostile test page. |
| E | **Top layer / stacking.** Pages that open `<dialog>`/`popover` (top layer) or use huge z-indexes sit above our `2147483000`. | Not reported yet. | Hostile test page. |

## Approach

1. **Reproduce first, as a test.** Add `e2e/isolation.spec.ts` and a set of hostile pages in
   `e2e/pages/hostile/`, each applying one nasty rule: `*{opacity:.5!important}`, body filter/transform/
   zoom, `html{direction:rtl}`, `* {font-family…!important}`, a page-level `--k`/`--pu-*` collision, a wrapper-class
   dark switch, `color-scheme: dark` on a light page, forced colours, an open `<dialog>`, and a copy of the
   real site's relevant CSS (kept fictional, per the repo rule). For each: mount Pipeup, open a thread, and assert
   Pipeup's computed styles (colour, opacity, font, direction, box) equal those on a plain page, and that
   Pipeup's text has at least 4.5:1 contrast against its own surface.
2. **One source of appearance.** A single `appearance` value (light/dark) owned by the app, applied to the layer
   and the page sheet together in one function, so no part can disagree. A theme change fades (existing
   transition tokens) and updates the highlight sheet with it.
3. **Read the page's appearance more reliably.** Prefer, in order: an explicit `data-pipeup-theme` or `--pipeup-*`
   hook from the author; the page's `color-scheme` where it says so; the luminance of the largest visible
   background behind Pipeup's own surfaces (sample under the column and panel, not just `<body>`). When unclear,
   light. Re-read on `class`/`style`/`data-*` changes anywhere in `<html>` (observe `subtree` with a cheap filter)
   and on `prefers-color-scheme` changes, debounced.
4. **Close what `all` leaves open.** Set `direction:ltr; unicode-bidi:normal` on the layer (the comment's own text
   keeps `dir="auto"`), and set every custom property Pipeup reads on `.layer` itself.
5. **Ancestor effects.** Detect them (computed opacity/filter/zoom/blend on `<html>`/`<body>`) in tests and in
   `pipeup check` rather than fight them; where a safe inline override on the host's own box works, use it.
   Document what can't be fixed from inside.
6. **Report, don't guess.** `pipeup check` gains a line saying which of A–E it found on the page.

## Decisions for the maintainer

- Keep following a dark page (fixed as above), or **always light** (simplest, matches the light-only rule for
  our own visuals; the page's dark mode would show a light panel)? Recommendation: keep following, with the
  single source of appearance.
- Is the real site available for a reproduction, or do we build the fictional equivalent from its screenshot?

## Change log

- 2026-10-12 — First draft.
