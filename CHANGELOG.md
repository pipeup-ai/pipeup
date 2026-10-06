# Changelog

All notable changes to Pipeup are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pipeup uses
[semantic versioning](https://semver.org/). Until 1.0 the project is in alpha: a minor version can
change the API and the stored comment format.

## [Unreleased]

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

[Unreleased]: https://github.com/pipeup-ai/pipeup/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/pipeup-ai/pipeup/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/pipeup-ai/pipeup/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pipeup-ai/pipeup/releases/tag/v0.3.0
