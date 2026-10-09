# Changelog

All notable changes to Pipeup are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pipeup uses
[semantic versioning](https://semver.org/). Until 1.0 the project is in alpha: a minor version can
change the API and the stored comment format.

## [Unreleased]

- Assist shows related information as pills only, under "This may be related:"; hovering or focusing a pill shows the sentence it points to.

- Assist reads the whole page, deck and notes once, a section at a time, keeps a short summary of each on the device, and checks the likely sections in full before replying, so a goal on a far-off or short slide is found. The menu row shows how far reading has got.

- Assist reads every slide as a whole (short bullets included), so a goal on a slide can be found and pointed to with a slide pill.
- The line from an open All comments row now runs down the margin beside the panel and turns in to the end of the marked words, or along the gap above the block, instead of cutting across the page.

### Fixed
- An AI reply's ring sits at the top right of the reply, like any avatar, instead of over its words, and it pulses outward inside its own box, so nothing is cropped.
- Assist shows what a reply relied on as small reference pills (at most three, never an address): "[1] Risks" for a passage, "Slide 5" with a slide icon for a slide, a notes heading; pressing one goes there. It reads every slide of a deck, so the answer can come from slides other than the one commented on.
- A thread the AI assistant has looked at and had nothing to add to says so ("Reviewed by AI · nothing to add"), and says "AI assistant is reading this…" while it does. `host.setThreadMark` is the add-on slot for it.
- The "Assistant replies" row shows in the menu only while commenting is on.
- Assist no longer replies with what the commented words already say, and shows a link as a numbered reference ("[1]"), not an address.

## [0.5.2] - 2026-10-09

### Added
- **`@pipeup/assist`**: short replies to comments from a small AI model running on the reviewer's own device (the browser's built-in model by default; a page can supply its own engine). Turned on by the reviewer, it decides for each comment whether a reply would help (ambiguity, related information or tone), streams a short reply into the thread under the name "AI assistant (on this device)", links to the author's Markdown notes where it used them, and remembers what it has looked at so it looks again only when something is added.
- For add-ons that write AI replies: `host.setThreadNote` shows a reply as it is being written at the end of a thread; the name "AI assistant" is kept for AI replies and they are drawn with a gently glowing ring; `signOp`, `computeOpId`, `AI_NAME` and `isAiName` are exported.

### Changed
- **All comments is interactive.** A row is a preview; choosing it opens the thread out in the panel, where you can reply, resolve or reopen, and copy it. The page scrolls to its place and a thin line joins the open row to it. Nothing opens on the page, and the side popover is gone.

- An open thread's popover always shows who and when, with Copy and Resolve, so it no longer jumps in height when hovered; the chosen block's outline and naming bar step aside while a thread is open.
- The bundles go through a second minifier (terser) after esbuild: 3% smaller, 40.2 KB gzip for the script (41.5 KB before), 35.4 KB brotli.

## [0.5.1] - 2026-10-08

### Fixed
- The comment control's icon is readable when a page's link colour is pale (on a dark page, the icon was white on pale blue in comment mode).
- Pipeup follows a page that switches between light and dark after it has loaded.

### Changed
- Comment boxes are wider (400 px) on windows 900 px wide or more.

## [0.5.0] - 2026-10-08

### Added
- **Add-ons.** One core plus optional add-ons, each one more script (or one combined file such as
  `pipeup+share.min.js`), working from a page opened from disk in any script order:
  - `@pipeup/share`: comments shared through an encrypted service the author picks (PrivateBin, or an HTTP
    mailbox an organisation runs itself), set up from the command line (`npx @pipeup/share create`).
  - `@pipeup/voice`: a microphone button in the comment box for dictating, with the browser's own speech engine
    and a plain consent sentence.
  - `@pipeup/live`: live comments and presence between people on the same page, peer to peer.
  - `@pipeup/mailbox`: the reference server for the shared-copy mailbox contract (`pm1`) and its `check` command.
  Each add-on says in one sentence what it sends and to whom. The core still makes no network requests.
- `Pipeup.use(addon)` and `Pipeup.addons()`, and the add-on host (menu rows, notices, announcements, a note above
  the new-comment box, composer tools, side panels, styles, status, overlay, frame and UI callbacks), typed and
  versioned (`ADDON_API` 1).
- `PipeupDocument.ops()`, `merge(ops, source)` and `sign(purpose, data)`, and `onChange` now also hears the added
  ops and where they came from. Ops from elsewhere go through exactly the checks a feedback file's do.
- Public `--pu-*` style tokens for add-ons.
- A website page for the add-ons (what each sends, a short animated demo and a Copy prompt for each), linked from the footer. The home page and its Copy prompt stay core only.

### Changed
- Tab on the page closes an empty comment box left open, as a click elsewhere does.
- A resolved thread stays open, with a sentence saying so, while words are half-written in its reply line.
- Ops are stored and exported as `{ body, sig }` only, and each is bounded in size. A saved change that can't be
  read is kept, left out and counted in one console warning.
- A second copy of Pipeup on a page warns and hands over to the first.
- The bundle is 40.5 KB gzip (36.8 KB in 0.4.1): add-on support cost 3.8 KB, and the min and esm budgets are now 42 KB.

### Fixed
- **The guidance for AI agents no longer tells them to download a file.** `llms.txt` and the integrate skill now say to add the pinned CDN script tag by editing the HTML only; saving a local copy for offline pages is left to the user. Some agent permission classifiers blocked the old `curl` step.

## [0.4.1] - 2026-10-07

Shipped first as pre-release 0.4.1-beta.1.

### Fixed
- **Tab in comment mode always moves between blocks**, including when comment mode was turned on with the mouse
  and after clicking a block. The first Tab carries on from the block last clicked, commented on or under the
  pointer (Shift+Tab goes back from it); from the Comment control's open menu it closes the menu first.
- The keyboard's block cursor no longer stops on tiny or decorative parts: icons inside links and buttons, keys
  and words styled inside a line of text, hidden or clipped parts, and parts set not to respond to the pointer
  (such as a moving demo). What the author marked with `data-pipeup-id` still counts.
- Moving the mouse onto another block while the keyboard's cursor is out hands the outline to the mouse.

### Changed
- **Esc on the block cursor leaves comment mode** (after a comment box and an open thread), with focus back
  where it was, or on the Comment control. It no longer puts the cursor away and gives Tab back to the page.
- The mouse hint mentions Tab. The bundle is about 37 KB gzip (budget 40 KB).

## [0.4.0] - 2026-10-07

Shipped first as pre-releases 0.4.0-beta.0 to beta.3.

### Added
- **Slides and hidden views.** Pipeup follows a deck's current slide by itself (slides marked
  `data-pipeup-slide`, or reveal.js) and shows only that slide's comments; they ease out and in as the slide
  changes. New comments remember their slide and the page's view.
- `Pipeup.setViewState({ tab, label })` lets a page report its view (a tab, a route); comments made there show
  only there. `Pipeup.onReveal(fn)` lets the page go to a view or slide when a reviewer chooses a comment there.
- `mount({ slides: { current, go } })` for decks that drive Pipeup themselves.
- All comments groups threads by slide in deck order ("Slide 3 · 2 open", this slide marked) or by view.
- Copy as Markdown names a non-slide view in each thread's "Where" line.
- **Keyboard and screen-reader block cursor.** Turning comment mode on from the keyboard (⇧⌥C or Shift+Alt+C,
  or Start commenting chosen with Enter) puts a cursor on the page: Tab and Shift+Tab move between blocks at one
  level, ↑ and ↓ go to the block around it or inside it (Modifier+↑/↓ pass through), Enter comments, Shift+Enter
  opens the comments already there one at a time, and Esc puts the cursor away. The shortcut brings a put-away
  cursor back, and leaves comment mode when it is in use or nothing is landable. Screen readers hear the kind of
  block, its place, its comments and its own words; Pipeup writes nothing into the page. After each comment, and
  after Resolve, focus is back on the same block (or on the Comment control when there is no cursor).
- The naming bar's **Inside it** and **Pin** (a pin at the block's centre, from any input).
- Words selected with caret browsing (F7) or a screen reader show the comment icon once the selection settles,
  and Enter comments on them.
- Closed threads in the column open from their own button. Screen readers are told what Pipeup does in a hidden
  live region (separate from the toast).
- `--pipeup-panel`: while All comments is open, its width is published so a page's fixed bars can move
  clear of it (the rest of the page is already moved over).
- `pipeup/package.json` can be imported (it is in the package's `exports`).

### Changed
- The control's number counts the open threads here; a small dot and its label ("2 here · 5 on other
  slides") say how many are elsewhere. Its name says when comment mode is on.
- Choosing a thread on another slide or view in All comments goes there first, then opens it; if it can't, it
  opens beside the panel with a snapshot.
- The menu's copy rows are called **Copy as Markdown** and **Copy as Text**.
- Flipping **Start commenting** leaves the menu open so you see the switch move (chosen from the keyboard, it
  closes the menu); the menu closes on Esc, a click outside, or 3 seconds after the pointer leaves it.
- Your name is edited right in the menu's identity row; Esc cancels and keeps the menu open.
- Comment mode picks more of a page: sections, articles, navigation, forms, lists, captions, elements
  with an accessible role, and boxes that lay out several things in a row or grid. No block is outlined while
  text is selected.
- The naming bar's expand button is named "Around it" and the bar is a group; bubbles are named after their block
  ("Comment on Paragraph · …: …") and come in page order.
- All comments and Copy list comments in the same page order as the bubbles, the column and Shift+Enter, which
  also orders several comments on one element by where their words start (pins top to bottom).
- While the block cursor isn't in use, Enter and Space on the page's own controls do what the page does in
  comment mode (clicks are still only for commenting), and Enter in a page's form field submits the form.
- `pipeup.min.js` and `pipeup.esm.js` may be up to 36 KB gzip (was 32 KB).
- Pre-releases have their own channel (the npm `next` tag and a marked copy of the site at `/next/`). The site
  is deployed after a release is published, so it never points at a version npm doesn't have yet. Release
  tooling sets the version everywhere and smoke-tests npm, the GitHub Release, the CDNs and the site.

### Fixed
- A comment being written on a slide or view that has gone is no longer lost or stuck: opening another thread,
  choosing one in All comments, or commenting on selected words goes back to it.
- A deck's hook that reports no slide number, or a saved slide that is not a plain slide number, is ignored.
- Focus is no longer lost after sending a comment, and Esc in a thread opened from a bubble or the column
  returns there.
- In forced colours, Pipeup's buttons and the cursor's outline show a Highlight focus ring.
- The empty draft's hidden Send button no longer takes a Tab stop.

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

- Slide-aware comments and keyboard use for blocks come in 0.4; touch and the narrow-page drawer in 0.5.
- The `pipeup` command line (`init`, `check`, `read`, `reply`) comes in 0.6.
- Shared rooms and presence come later; for now feedback travels by Copy all.

[Unreleased]: https://github.com/pipeup-ai/pipeup/compare/v0.5.2...HEAD
[0.5.2]: https://github.com/pipeup-ai/pipeup/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/pipeup-ai/pipeup/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/pipeup-ai/pipeup/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/pipeup-ai/pipeup/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/pipeup-ai/pipeup/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/pipeup-ai/pipeup/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/pipeup-ai/pipeup/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pipeup-ai/pipeup/releases/tag/v0.3.0
