# Design: `pipeup init`

Spec: [§15e](../FUNCTIONAL_SPEC.md). Status: built (0.8).

## Shape

`cli/init.mjs`, called from `cli/pipeup.mjs`. Plain Node, no dependencies (the package has none at run time). It edits
the page as text, never through a parser that would reformat it: every change is an insertion or an attribute
replacement at a known offset, so every other byte stays as it was. A plan is built first (a list of changes, each
with a sentence), printed, confirmed, then applied in one write.

## What it knows without the network

- **Pipeup's own hash.** The package carries `dist/pipeup.min.js`; the command hashes it (sha384) for the
  `integrity` attribute and pins `https://cdn.jsdelivr.net/npm/pipeup@<VERSION>/dist/pipeup.min.js`.
- **The add-ons' hashes and sentences.** The add-ons build (`libs/ts/addons/scripts/build-all.mjs`) writes
  `dist/addons.json` into the pipeup package: for each add-on of the same version, its sha384, its one-sentence
  network statement (from its `package.json`), and anything it needs from the author (`pipeup.asks` in its
  `package.json`: the attribute, the flag to pass it with, a sentence, a pattern). The release builds the add-ons
  before it publishes the core, so the published package carries the file. Without it `--addon` refuses, in words.
- **The document identity** comes from `newDocumentAttribute()` in `dist/pipeup.core.js`.
- **The agent** is read from `~/.pipeup/agent.json` (as `pipeup agent` writes it); without one, `--agent` says to
  run `pipeup agent` first.

## Editing the page

- `<html …>` start tag: attributes are added at the end of the tag, or a `data-pipeup-*` value is replaced in place
  (the add-on and agent lists are appended to, never rewritten).
- The script goes just before `</body>` (or `</html>`, or the end of the file), on its own line, indented like the line
  it sits before.
- An existing Pipeup script is found by its address (`pipeup@x.y.z/dist/pipeup.min.js`, `pipeup.min.js` beside the
  page) or, for a page carrying Pipeup inside it, by the classic script's signature. `--update` rewrites only the
  version and the `integrity` value of that tag; it refuses an older version.
- `--offline` writes the classic script inside a `<script>` element; the build guarantees it contains no `<script`
  or `</script`. Add-ons are not available offline in this version (their code isn't in the package), and the command
  says so.

## Marks

Without `--yes`, after the setup it offers marks. Candidates are found by scanning start tags outside `<script>`,
`<style>`, `<template>` and comments: headings, `section`, `article`, `figure`, `table`, `pre`, `blockquote` get
`data-pipeup-id`; `img`, `svg`, `canvas` get `data-pipeup-label`; elements whose class names a slide get
`data-pipeup-slide` numbered in order. Elements inside `nav`, `header`, `footer` or `data-pipeup-ignore`, and any that
already carry a mark, are skipped. A name is proposed from the element's `id`, `aria-label`, `alt` or `title`, or its
first words (kebab-case, at most five words, unique on the page), and the command says what it took the part to be.
For each: Enter accepts, a typed name renames, `s` skips, `q` stops. Answers are read a line at a time from standard
input, so tests and agents can pipe them.

## Change log

- 2026-10-13 — First draft.
- 2026-10-13 — Built. Tests: `libs/ts/pipeup/e2e/init.spec.ts` (core: dry run, setup, asking, update, marks, slides,
  offline in a browser with the network blocked, exit codes) and `libs/ts/addons/e2e/init-addons.spec.ts` (add-ons,
  their questions, the agent), since only the add-ons job builds `dist/addons.json`. A section with a heading is
  offered through its heading only, so one part isn't named twice.
