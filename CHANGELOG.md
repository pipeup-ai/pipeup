# Changelog

All notable changes to Pipeup are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pipeup uses
[semantic versioning](https://semver.org/). Until 1.0 the project is in alpha: a minor version can
change the API and the stored comment format.

## [Unreleased]

## [0.4.0-beta.2] - 2026-10-07

### Added
- **Slides and hidden views.** Pipeup follows a deck's current slide by itself (slides marked
  `data-pipeup-slide`, or reveal.js) and shows only that slide's comments; they ease out and in as the slide
  changes. New comments remember their slide and the page's view.
- `Pipeup.setViewState({ tab, label })` lets a page report its view (a tab, a route); comments made there show
  only there. `Pipeup.onReveal(fn)` lets the page go to a view or slide when a reviewer chooses a comment there.
- `mount({ slides: { current, go } })` for decks that drive Pipeup themselves.
- All comments groups threads by slide in deck order ("Slide 3 · 2 open", this slide marked) or by view.
- Copy as Markdown names a non-slide view in each thread's "Where" line.

### Changed
- The control's number counts the open threads here; a small dot and its label ("2 here · 5 on other
  slides") say how many are elsewhere.
- Choosing a thread on another slide or view in All comments goes there first, then opens it; if it can't, it
  opens beside the panel with a snapshot.
- `pipeup.min.js` and `pipeup.esm.js` may be up to 33 KB gzip.

### Fixed
- The Try pages' shortcut hint sits in the middle of the top bar.
- A comment being written on a slide or view that has gone is no longer lost or stuck: opening another thread,
  choosing one in All comments, or commenting on selected words goes back to it.
- A deck's hook that reports no slide number, or a saved slide that is not a plain slide number, is ignored.

## [0.4.0-beta.1] - 2026-10-07

### Changed
- The menu's copy rows are called **Copy as Markdown** and **Copy as Text**.
- Flipping **Start commenting** leaves the menu open so you see the switch move; the menu closes on Esc,
  a click outside, or 3 seconds after the pointer leaves it.
- Your name is edited right in the menu's identity row; Esc cancels and keeps the menu open.
- Comment mode picks more of a page: sections, articles, navigation, forms, lists, captions, elements
  with an accessible role, and boxes that lay out several things in a row or grid.

### Added
- `--pipeup-panel`: while All comments is open, its width is published so a page's fixed bars can move
  clear of it (the rest of the page is already moved over).

### Fixed
- The site's Try bar and slide controls no longer sit under the All comments panel.
- In comment mode no block is outlined while text is selected.
- On the website, the showcase can be commented on as one block, and every button, link and navigation
  bar can be commented on too, except the Try pages' top bar, whose example links are now a Try menu.
- The Try pages' top bar keeps its links on one line on phones; the GitHub link shows just its icon
  there, and the pre-release label shortens to "Beta".
- `pipeup/package.json` can be imported (it is in the package's `exports`).

## [0.4.0-beta.0] - 2026-10-06

A pre-release to try out the pre-release channel itself: the same library as 0.3.2, published
under the npm `next` tag, with its own copy of the site at https://pipeup-ai.github.io/pipeup/next/.
0.4.0 (slides, the narrow-page drawer, keyboard and touch for blocks) comes in later betas.

## [0.3.2] - 2026-10-06

### Changed
- Pre-releases have their own channel: the npm `next` tag and a marked copy of the site at
  `/next/`, so a milestone can be tried before it reaches everyone.
- The site is deployed after a release is published, so it never points at a version npm doesn't
  have yet.
- Release tooling: one command sets the version everywhere, and a smoke test checks npm, the
  GitHub Release, the CDNs and the site after each release.
- Workflows run on Node 24 and a pinned Ubuntu 24.04 runner.

No change to the library's behaviour.

## [0.3.1] - 2026-10-06

### Changed
- Releases publish to npm with trusted publishing: the release workflow proves its identity to npm,
  so no npm token is stored. Provenance is unchanged.
- The pinned CDN address in the README, the integrate skill and llms.txt points to 0.3.1.

No change to the library's behaviour.

## [0.3.0] - 2026-10-06

The first public release.

### Added

- **One script tag.** `pipeup.min.js` is one file with no dependencies (at most 32 KB gzip). It
  mounts itself on any page whose `<html>` carries `data-pipeup-doc`, and works when the page is
  opened from disk. Published on npm as `pipeup`, with an ESM build for bundlers (`mount`,
  `unmount`, `flush`) and a headless core at `pipeup/core`.
- **Comments on text.** Select words to comment; highlights stay level with their text. Threads
  have one level of replies, and can be resolved and reopened.
- **Comment mode** (Shift+Alt+C, or ⇧⌥C on a Mac, or the control's menu): comment on any block
  (buttons, charts, cards, images) and drop pins with Option-click or Alt-click. The page's own
  controls are paused while it is on; elements marked `data-pipeup-ignore` keep working.
- **The comment control:** one round button showing the number of open threads, with a menu for
  your identity, Copy all, Copy all as text, All comments and Start commenting.
- **All comments:** a panel listing every thread in page order, including threads whose content is
  gone ("No longer on the page"), with a Show resolved switch.
- **Placement:** comments sit in a column beside documents, or as bubbles on dense pages. Pages
  designed for review can reserve a comment gutter with `data-pipeup-reserve` and
  `var(--pipeup-gutter)`. Authors can force either layout with `data-pipeup-layout`.
- **Anonymous identities:** nobody has to give a name. Each reviewer is an animal in a colour
  ("Red Fox"), the same on every page, and can add a name at any time.
- **Anchoring:** comments follow their content when the page changes, using `data-pipeup-id`,
  `data-pipeup-label` and the quoted text; ones that can't be placed are flagged, never misplaced.
- **Copy all** as Markdown for AI agents (with where each comment is, thread and comment ids) or
  as plain text.
- **Signed comments:** every comment, reply and resolve is signed by its reviewer's key, so
  comments can't be forged or altered when they are merged.
- **Local storage:** comments are kept in the reviewer's browser (IndexedDB). Pipeup makes no
  network requests and has no analytics or telemetry.
- **Agent skills:** `pipeup-integrate`, `pipeup-summarise` and `pipeup-apply`, published with the
  website along with `llms.txt` and `llms-full.txt`.
- **Website** with Try pages for a document, slides and a website.

### Known limitations

- Slide-aware comments, the narrow-page drawer, and keyboard and touch for blocks come in 0.4.
- The `pipeup` command line (`init`, `check`, `read`, `reply`) comes in 0.5.
- Shared rooms and presence come later; for now feedback travels by Copy all.

[Unreleased]: https://github.com/pipeup-ai/pipeup/compare/v0.4.0-beta.2...HEAD
[0.4.0-beta.2]: https://github.com/pipeup-ai/pipeup/compare/v0.4.0-beta.1...v0.4.0-beta.2
[0.4.0-beta.1]: https://github.com/pipeup-ai/pipeup/compare/v0.4.0-beta.0...v0.4.0-beta.1
[0.4.0-beta.0]: https://github.com/pipeup-ai/pipeup/compare/v0.3.2...v0.4.0-beta.0
[0.3.2]: https://github.com/pipeup-ai/pipeup/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/pipeup-ai/pipeup/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pipeup-ai/pipeup/releases/tag/v0.3.0
