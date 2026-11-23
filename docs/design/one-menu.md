# One menu, built for the job

Status: **built** (2026-11-23). Functional requirements: [EXTENSION_SPEC.md](../EXTENSION_SPEC.md) §3, §4a, §5
(change log, 2026-11-23); host side, [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §4a. Visual spec:
[extension-menu.html](extension-menu.html) (before and after, wording). Targets `next` (1.1.0).

## The problem

A newcomer's first run in Safari and Chromium (23 November 2026) met, before their first comment, a button, a switch, a
shortcut and a link to an empty list; and once Pipeup was on, eleven rows, a status line that promised "send" when
nothing was called that, two shortcuts, two things called Comments, three ways to make Pipeup go away, and a second menu
on the page behind the panel's "…" with the same rows again.

## What was built

**The toolbar menu** (`apps/extension/src/popup.*`).

- Off: **Comment on this page** and one sentence under it. No switches, shortcuts or links; `#off` holds nothing else.
- On, in order: the name row (the name, or the animal Pipeup gave, with *Add your name* or *Edit* beside it; edited in
  place as before), **Your comments on this page** with the count, a separator, **Copy comments** (bold, "to paste
  anywhere"), **Save as a file**, **Send to my agent** where the browser reaches agents, a separator, **Commenting**
  (a switch with ⇧⌥C), **More**. The status line and the footer are gone.
- **Copy comments** is one press: `commentsAs("ai")`, the readable text that is also Markdown. "As text" is gone.
- **Save as a file** and **More** open in place under their row (`.sub`, a grid row easing from `0fr` to `1fr` with
  opacity, `visibility` switched at the end so a closed sub-menu is hidden to assistive tech and to tests) and fold back
  with the row (its chevron reads ‹ while open), **Esc** or **←**, focus returning to the row. Closed, they are `inert`.
- **More** holds Theme, Hide comments, Keep comments beside the page (where the browser has a side panel), Always on
  for this site or for local pages (the two-line rows that used to sit outside the menu), the add-ons' rows, a
  separator, Turn off on this page and **Settings** (a link to `comments.html`, drawn as a row).
- The add-ons' rows come from Pipeup (`addonRows()`, below) and are drawn as text only: a button with the label, the
  count where there is one, and a switch where the row is one (`role="switch"`, `aria-checked`). A press is
  `selectAddonRow(key)`, then the menu re-reads the tab.

**On the page** (`start.js`). Pipeup is mounted with `pageMenu: "off"` in both of the extension's ways of showing (pinned
and popovers), so its ⋯ isn't drawn beside the control (which is already off) nor in All comments' bar; the bar keeps the
name and the Comment switch. The "Show Pipeup's button on pages" setting still brings back Pipeup's own button, menu and
panel, unchanged. The probe the toolbar menu reads now carries the animal name and the add-ons' rows, and `act: "row"`
presses one. `act: "menu"` and the `extras` flag are gone.

**The one-time line.** The first time a thread by the reviewer appears in this browser (`firstCommentSaid` in the
extension's storage), `start.js` asks Pipeup to say "Saved in this browser. Press Pipeup in the toolbar when you're ready
to send them." It is shown as Pipeup's own notices are, beside where the control would be, for the usual time.

**Settings** (`comments.*`). The page is called Settings and opens on **Comments you've made** (the list, first, under
that name), then **The extension** (the ⇧⌥P shortcut, Show Pipeup's button on pages, the pictures switch), then one
**Add-ons** line that says which are on ("Emoji on; Voice, Share… off") and opens, easing, to the add-ons; Send to my
agent's setup follows where offered.

**In Pipeup** (`libs/ts/pipeup`), the host side, +0.2 KB gzip (66.8 of the 67 KB budget):

- `mount({ pageMenu: "off" })`, as `data-pipeup-menu`: the launcher removes its ⋯ (`.mm`) and the panel's (`.ib`).
  `openMenu()` still works for a page's own code; the extension never calls it.
- `addonRows(): HostMenuRow[]`: the add-ons' `MenuItem`s as `{ key, label, hint, checked?, count }`, every word read
  through a guard so an add-on's failing getter shows an empty word rather than breaking the host's menu. `key` is the
  row's position for as long as the add-on is on; a host re-reads the rows each time it shows them.
- `selectAddonRow(key)`: presses that row.
- `note(text)`: one line through Pipeup's toast.
- The names stay clear of the bundle's mangled internals (`scripts/mangle.mjs` shortens `menu`, `menuRows` and `say`,
  so a public `menuRows()` would have left the bundle under another name).

**Tests.** The extension's Chromium e2e tests read the new rows (More opened where a row moved under it; Esc folding
it; Copy in one press; Save as a file folding after each save; the panel's bar without "…"; Settings' Add-ons line). The
Safari UI test reads the count from the **Your comments on this page** row and checks that Start commenting and the
footer link are gone. The hand checklist's rows are reworded. The store screenshots (`npm run store-art`) show the menu
with Save as a file open and Settings in place of Comments you've made.

## Not in this change

- The comment-mode hint on the page, Pipeup's own (five instructions on the first visit).
- What the page does after Return (the reply field, the next block lit).
- The spec's open questions (Keep comments beside the page at the top level in Chrome and Firefox; Send to my agent
  before Copy where an agent is set up; the one-time line in the badge instead of on the page): built as sketched,
  to be decided on use.

## Change log

- 2026-11-23 — Built from the agreed spec; this note.
