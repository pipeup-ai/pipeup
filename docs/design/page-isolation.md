# Looking the same on every site

Status: **draft, for review** (column backing decided: always). Functional requirements: [FUNCTIONAL_SPEC §9](../FUNCTIONAL_SPEC.md)
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

Two layers: **get the appearance right** (detection), and **make it not matter when detection is wrong**
(Pipeup's own surfaces).

### 1. Reproduce first, as a test

Add `e2e/isolation.spec.ts` and hostile pages in `e2e/pages/hostile/`, each with one nasty rule:
`*{opacity:.5!important}`, body filter/transform/zoom, `html{direction:rtl}`, `*{font-family…!important}`,
a `--k`/`--pu-*` collision, a wrapper-class dark switch, `color-scheme: dark` on a light page and the reverse,
forced colours, an open `<dialog>`, and a fictional copy of the reported site's CSS. For each, in **both** looks:
mount, open a thread, and assert Pipeup's computed styles match a plain page and that every piece of Pipeup text
meets 4.5:1 against what is actually behind it (measured from pixels, not tokens).

### 2. One source of appearance

A single `appearance` ("light" | "dark") owned by the app and applied in one function to the layer, the
highlight/pin sheet and add-ons' context (`dark` in `src/ui/addons.ts:426`), so no part can disagree. It changes
with a fade.

Order of precedence: reviewer's choice (Automatic / Light / Dark in the menu, kept in the browser) > author's
`data-pipeup-theme` or `--pipeup-theme` > detected > light.

### 3. Detect the page's appearance reliably

- Prefer the page's declared `color-scheme` on `<html>`, `<body>` and the root element when it says so.
- Otherwise sample what is actually behind Pipeup: the background (first non-transparent ancestor, walking up
  from the points under the column and panel via `elementsFromPoint`, ignoring our own host), not `<body>`'s
  background alone. Compare against a dark/light threshold with a dead band, so it doesn't flip on mid-greys.
- Re-read on any `class`, `style`, `data-*` or `color-scheme` change inside `<html>` (subtree, cheap filter,
  debounced) and on `prefers-color-scheme`, not only on `<html>`/`<body>` attribute changes
  (`src/ui/app.ts:775-777`).
- When unclear: light.

### 4. Control our own surfaces

- Every surface Pipeup draws gets an **opaque** background, text, border and shadow from the active look's token
  set, designed in pairs so the contrast holds (a token test asserts 4.5:1 text and 3:1 for icons/outlines for
  every text/surface pair, in both looks). No translucent surface over page content; no colour taken from the
  page except the accent, which is checked against the surface and replaced if it fails (already partly done in
  `readTheme`).
- **The column at rest is the exposed case.** Words sit straight on the page (§7 "words lead"), so a wrong guess
  puts light words on a light page, as in the first screenshot. Fix, **decided: always**: a soft backing behind the
  column's threads in Pipeup's own surface colour, eased in, nearly invisible on a matching page and decisive on a
  mismatched one. No sampling is needed to decide whether to show it.
- Highlights and pins are the only parts over page content: both looks get a colour set tuned against the page
  text colour sampled under them (the existing `highlights.ts` dark/light tables extended to follow the sampled
  text colour, not just the flag).

### 5. Self-check (built; no fall-back look)

`src/ui/legible.ts`: after each look decision Pipeup reads what the page's styles on `<html>` do to everything under
it (`opacity`, `filter`, `backdrop-filter`, `mix-blend-mode`, `transform`, `clip-path`, `mask-image`, `zoom`),
computes how well its own words still read when `<html>` is faded over the page's canvas (its text and surface blended
toward the canvas), and warns once in the console. `pu.appearance()` returns `{ look, source, ratio, effects }` for
`pipeup check` and agents.

The planned fall-back to the other look was dropped. Fading costs both looks about the same (checked by a test), and
the other effects aren't cured by a different palette, so switching would add code and surprise people for nothing.
Body-level effects never reach Pipeup, which lives under `<html>`.

### 6. Close what `all` leaves open

Set `direction:ltr; unicode-bidi:normal` on the layer (comment text keeps `dir="auto"`); declare on `.layer`
every custom property Pipeup reads.

### 7. Ancestor effects

Opacity, filter, zoom, blend or transform on `<html>`/`<body>` apply to our host regardless of the shadow
boundary. Detect them in tests and in `pipeup check` rather than fight them; override inline on the host only
where it is safe. Document what can't be fixed from inside.

### 8. Report

`pipeup check` says which of A–E it found and which appearance it chose and why.

## Built so far

Slice 1 (#43): detection by sampled background, one look for the layer and the highlights with a fade, `data-pipeup-theme`,
column backing, `direction`, token contrast test, and the first hostile-page tests. Slice 2: the Look row in the menu
(Automatic, Light, Dark, kept in the browser) and hostile pages for `*` rules, colliding variables, body effects, a
mismatched `color-scheme`, right-to-left, resets and forced colours (`e2e/appearance.spec.ts`,
`e2e/fixtures/hostile.html`). The self-check and `pu.appearance()` are built (§5). Not yet: the `pipeup check` command itself (it does not exist yet; the spec puts it
in 0.8), and top-layer `<dialog>` pages. The size budget rose to 46.5 KB for this.

## Decisions for the maintainer

- ~~Column backing~~ decided 2026-10-12: always.
- Does the menu choice (Automatic / Light / Dark) sit with the name setting?

## Change log

- 2026-10-12 — First draft.
- 2026-10-12 — Both looks must work: one appearance source with a menu choice, sampled detection, Pipeup's own opaque surfaces, a self-check that falls back to the safe look.
- 2026-10-12 — Decided: the column backing is always on.
- 2026-10-12 — Built slices 1 and 2; font family is taken from the page by design, so the hostile tests leave it out.
- 2026-10-12 — Built the self-check and `pu.appearance()`; dropped the fall-back look, because fading costs both looks about the same.
