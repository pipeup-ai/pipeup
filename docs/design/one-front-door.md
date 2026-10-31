# One front door: how the site builds it

Design note for WEBSITE_SPEC §3 items 1, 2, 2a and 3 (change log 2026-10-27). What it looks like and says is the visual
spec, [one-front-door-mockups.html](one-front-door-mockups.html), revised by
[one-screen-home-mockups.html](one-screen-home-mockups.html) (the home page fits one screen; What your AI does and The
details get pages of their own); this note is how the site does it.

## Pages

- **index.html**: the hero is three grid items, `.intro` (headline, sentence), `.start` (the four steps, the try line,
  the quiet line to The details) and `.ad` (the showcase). Side by side they sit in named areas (`intro ad` / `start
  ad`). Stacked (≤ 900 px) a small script moves the try line into `.intro` and the showcase before `.start`, so the DOM
  order (and with it reading and keyboard order) is what is shown: headline, sentence, try line, showcase, steps. The
  try line has a keyboard and a touch version, picked with `(hover: none) and (pointer: coarse)`. Nothing follows the
  hero but the footer. `#steps` has `scroll-margin-top: 100vh` side by side, so arriving there from create-html.html
  leaves the page at its top, where the steps already are.
- **prompt.html** (What your AI does) and **details.html** (The details) are plain pages linked from the steps: the
  reviewer page's head, inline styles, header and footer, plus `pages.css` (words left, a labelled box to copy right,
  on the home page's columns; stacked below 900 px). Each box's Copy sits in its header row, never over the words.
  walk.js runs on them for the shortcut's labels and the footer menu.
- **add-comments.html** is the reviewer help page. Its head, inline styles, header and footer are still the add-on
  guide's chassis (build-guide.py), so the `.back` link style stays in it. "Add it to your own copy" is a disclosure
  button that eases a `grid-template-rows` 0fr → 1fr panel open; the panel is `inert` while closed.
- **create-html.html** is a stub: `location.replace("./#steps")`, a `<meta http-equiv="refresh">` for when scripts are
  off, a canonical link to the home page, and one plain line with a link that eases in after 0.6 s, so it only shows
  when the page doesn't move on.

## One source for the words

`prompts.js` holds every text a Copy button copies and a `data-sprompt` box shows: `b` (the author prompt), `a` (the
reviewer prompt), `note` (the note for reviewers, embedded word for word in `b`), `lines` (For your page) and `tag` (the
script line alone). Boxes are filled from it, so the words shown are the words copied. The home page shows none of
them: its Copy prompt copies `b` unseen, and if copying isn't allowed it opens `prompt.html#select`, where the prompt's
words are selected (again once the fresh key arrives) and scrolled into view. The note's help address is drawn
as a link; its text is the same.

Keys: one document key is shown at a time. A copy of a keyed text (`a`, `b`, `lines`) uses the shown key unless it was
already copied, in which case the next key (made ahead, so the click's clipboard moment isn't lost) replaces it first
and every box shows the new one. So every copy from any button carries a key of its own, and the box shows the key just
copied (PR #112's rotation, extended to the other boxes). If copying isn't allowed, the box scrolls into view and its
words are selected.

## What the site carries, filled in at build time

`inject-core.py` runs last in `build.sh` (after llms-full.txt is put together) and:

- reads the version from `libs/ts/pipeup/package.json` and fails the build if the site's `pipeup.min.js` wasn't built as
  that version, or if any page, Markdown copy, llms file or prompts.js pins another `pipeup@X.Y.Z/`;
- fills `{{VERSION}}` and `{{SIZE}}` (the site's `pipeup.min.js`, gzipped at level 6 as `scripts/size.mjs` measures it,
  rounded to whole KB) in details.html and its Markdown copy;
- fills `{{SRI:pipeup}}` with the hash of the file jsDelivr serves for that version. If the CDN can't be reached the
  attribute is dropped from text files and prompts.js keeps its placeholder (it then writes the tag without integrity),
  with a warning. It never falls back to the local build: unlike a released add-on, the core on `main` can differ from
  the release it pins (fixes land before the next release), and a wrong hash would stop every page using it.
- fails if a placeholder is left.

`tools/set-version.sh` already updates the `pipeup@X.Y.Z/` pins in these files; the version and size are never written
by hand.

## The showcase

- Each `.scene` group gets a visually hidden sentence; its drawing is `aria-hidden`, and scenes not on show are
  `aria-hidden` too.
- `held()` runs each frame: the pointer on it (`:hover`, only where the device can hover, since touch hover sticks),
  keyboard focus in it (`:focus-visible`), or the visitor commenting. Commenting is read from Pipeup's open shadow root:
  comment mode (`.launch .mode.on`), its menu open (`aria-expanded`), All comments (`.layer.listing`), or focus in one of
  its text boxes. Focus merely left on Pipeup's button doesn't hold it. This reads Pipeup's internals: if those class
  names change, the showcase just stops holding still while commenting; nothing breaks.
- Each pointer has an arrow and a fingertip SVG; the media query shows one.
- `.ad` has 4 px padding taken back by a negative margin, so its `overflow-x: auto` doesn't cut its controls' focus
  rings.

## The reviewer scene

One 19 s loop on the 400 × 270 stage, played by walk.js: mail, then Slack. The file is downloaded and opened (Open on the
download bar), the browser tab shows the page with the corner button, Start commenting, a comment typed on a paragraph,
then the button again, Copy comments › As Markdown and a "Comments copied" toast, and back in the mail (reply box) or
Slack (composer) the comments are pasted (a ⌘V / Ctrl V hint) and sent. `k` steps move the pointer (later steps win in
the cascade), `p` steps are presses: walk.js restarts the ring's animation on each new press. The scene pauses out of
view and with its Pause button (time stops, then carries on from the same moment); `?t=…&v=mail|slack` freezes a moment
for checking.

## Open points

- The reviewer page's script-line option relies on PR #112's library fix (the script line alone starts Pipeup), which
  the pinned 0.8.2 doesn't have. The site should go live with the release that carries it.

## Change log

- 2026-10-27 — First version, with the build of WEBSITE_SPEC §3's one front door.
- 2026-10-27 — The home page fits one screen: What your AI does and The details move to prompt.html and details.html,
  with shorter words (step 3 now fits two lines); a refused Copy prompt opens prompt.html#select.
