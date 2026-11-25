# Extension check: the core scenarios, by hand

A hand check of Pipeup for browsers in **Chrome, Firefox and Safari**, run before a release goes to the stores.
About 25 minutes a browser. Record ✅ / ❌ (or — where a browser doesn't offer it) and a note for each step; file
each ❌ as an issue that names the step and the browser.

The automated tests cover Chrome and Firefox with the extension loaded, and Pipeup itself in Chromium and
WebKit. In Safari, `npm run safari-test` in apps/extension runs the first run (A2, A3 and B's first comment) with
Apple's UI testing, with a screenshot of each step; the rest of this list is by hand there.

## Set up

- **Build:** `node tools/build-extension.mjs --safari` (see [apps/extension/README.md](../../apps/extension/README.md)
  for loading each build). Note the version and the Pipeup file's hash the build prints.
- **Fresh start:** a new browser profile (Safari: remove Pipeup's site data in Settings → Privacy), so no comments,
  name or choices are left from before.
- **Pages:** have these open in tabs.

  | Page | For |
  |---|---|
  | `https://example.com` | the short page: turning on, the first comment |
  | A long article with pictures and a sticky header | scrolling, pictures, stacking |
  | A single-page app you can sign in to (a mail or docs site) | following the address |
  | `http://localhost:8771/try/document.html` (the site, served locally) | a page with Pipeup built in |
  | Any other page on `localhost` without Pipeup | Always on for local pages |
  | The browser's settings or new-tab page | pages closed to extensions |

- **Who:** when asked for a name, use **Sam**.

## A. Turning on

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 1 | Look at the toolbar | Pipeup's bubble, readable on the toolbar in the light and the dark look. | | | |
| 2 | On example.com, press it | A panel with the page's address, one main action, **Comment on this page**, and one sentence under it ("Click anything on the page to comment on it."). No switch, shortcut or link. Nothing is on the page yet. (Safari asks for the site first.) | | | |
| 3 | Press **Comment on this page** | Comment mode is on: moving over the page outlines blocks. No Pipeup button in the page's corner. The first time in this browser, the hint beside the corner says only "Click anything to comment · Esc when you're done" (no button named); later starts show no hint. | | | |
| 3a | In comment mode, press any key; then click a link or button; then open a thread | Each once, the first time, in the hint's place: "Tab moves between blocks", "Hold Space to use the page", "Option-click (Alt-click) to pin". Not again in this browser. | | | |
| 4 | On the long article, press **Shift+Alt+P** | Pipeup turns on there too. | | | |
| 5 | Press the toolbar button on the settings or new-tab page | The panel says Pipeup can't run there, and why. | | | |
| 6 | Press it on the page with Pipeup built in | The extension steps aside and says the page has its own Pipeup. Only one Pipeup is on the page. | | | |

## B. Writing comments

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 7 | In comment mode, click a paragraph | A box opens beside it with the cursor in it. Its line says "Comment" (not "Comment or add others with @": nobody else has commented yet). | | | |
| 8 | Type "First comment", press **Enter** | The comment is kept and its box closes: the marker stays on the paragraph, no thread or reply box opens, the next block isn't lit; the toolbar button counts 1. The first time in this browser, one line on the page: "Saved in this browser. Press Pipeup in the toolbar to copy, save or send them." It isn't said again for later comments. Clicking the marker opens the thread with its reply line ("Reply"). | | | |
| 9 | Select a few words with the mouse | A comment icon appears by the selection. Press it: the box opens on those words. Send it: the words are highlighted. | | | |
| 10 | Right-click a picture → **Comment with Pipeup** | The box opens on the picture. | | | |
| 11 | On a tab where Pipeup is off, select words, right-click → **Comment with Pipeup** | Pipeup turns on and the box opens on the words. | | | |
| 12 | From a block's bar, **Pin**, then click a point | A pin comment box opens at that point; sent, the pin stays there when the page scrolls. | | | |
| 13 | Start a comment, type a word, press **Esc** | The draft is cancelled or offers to keep the words; nothing is lost silently. | | | |
| 13a | Type a comment quickly the moment its box opens, with an @mention, an emoji from the box's button, and words in Japanese or Chinese input | Every letter arrives, in order; the @ list moves with the arrows; the input method's words are kept. | | | |
| 13b | Turn on **Voice** and dictate into a comment box | The words arrive in the box. | | | — |

## C. Threads

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 14 | Move over highlighted words | A preview of the comment. Click: the thread opens beside the words. | | | |
| 15 | Type a reply, press **Reply** | The reply is added; the cursor stays in the reply box. | | | |
| 16 | On your comment, **⋯ → Edit**, change a word, save | The comment shows the new words. | | | |
| 17 | On your reply, **⋯ → Delete** | The reply is gone. | | | |
| 18 | **Resolve**, then **Reopen** | The thread leaves and returns; the count follows. | | | |
| 19 | **React** with an emoji | The reaction shows under the comment. | | | |
| 20 | Reload the page, press Pipeup | Every comment is back in its place. | | | |
| 21 | Scroll the long article up and down with a thread open | The thread stays with its words; nothing jumps or is left behind. | | | |

## D. The toolbar menu and the panel

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 22 | Open the toolbar panel with Pipeup on | Pipeup's menu, five rows and More: your name (or your animal) with Add your name, **Your comments on this page** (with the count), **Copy comments** (to paste anywhere), **Save as a file**, **Commenting** with ⇧⌥C, **More**. **Send to my agent** is in the top level, after Save as a file, only once it is set up (not in Safari). No status line, no footer. | | | |
| 22a | Press **More** | It opens in place, easing: Theme, Hide comments, Keep comments beside the page (not in Safari), Always on for this site, **Send to an AI agent on this computer · Set up once** (not in Safari, and only until it is set up), any add-on rows, then Turn off on this page and Settings. **‹**, **Esc** or **←** folds it back, focus on More. | | | |
| 23 | Change the name to **Ada** in place | New comments are Ada's. | | | |
| 24 | **Theme** → Dark, then Light | All of Pipeup's UI on the page changes, completely, with no light pieces left in the dark look or dark ones in the light. | | | |
| 25 | **Hide comments**, then show them | Highlights, pins and threads leave and come back. | | | |
| 26 | **Your comments on this page** | Chrome, Firefox: the side panel opens with every comment. Safari (and unpinned): Pipeup's own panel on the page, whose bar has the name and the Comment switch but no "…" menu. Each thread keeps its own ⋯. | | | |
| 27 | **Keep comments beside the page** | The side panel stays; a thread opened on the page shows there. Closing the panel unpins. | | | — |
| 28 | In the panel, click a thread | The page goes to its place, which is marked. | | | |

## E. Getting comments out

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 29 | **Copy comments** (one press), paste into a text editor | Every comment with what it's on, as readable text that is also Markdown; the row says how many threads were copied. | | | |
| 30 | **Save as a file → A Markdown file**, then **A Pipeup file** | Two files in the browser's downloads; the row folds back after each. | | | |
| 31 | **More → Send to an AI agent on this computer** before setting up | It opens to the one command to run. After running it and pressing the row again, comments reach `pipeup browser`; **Send to my agent** moves to the menu's top level, after Save as a file, and once a reply has come back into the thread its hint names that agent. | | | — |
| 32 | **More → Settings** | A short page (about a hundred words) that opens on **Comments you've made**: every page commented on, newest first, each opens. Then **Keyboard** (⇧⌥P, ⇧⌥C on one line each), then two settings with one sentence each (Show Pipeup's own button in the page's corner; Keep a small picture of where each comment was), then one **Add-ons** line and one **Send to an AI agent on this computer** line (not in Safari), each opening to its content. | | | |

## F. Sites

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 33 | **More → Always on for this site** | The browser asks for that site only. After a reload, Pipeup is there without a press. | | | |
| 34 | On the localhost page without Pipeup, with Pipeup on | More offers **Always on for local pages** in its place; another port has it too. | | | |
| 35 | In the single-page app, comment, then move to another view | The first view's comments leave; coming back, they return. | | | |
| 36 | **More → Turn off on this page** | Pipeup leaves the page; the page is as it was. | | | |
| 37 | Reload the extension (or rebuild and reload it) | Pipeup takes itself off open pages; pressing it again starts it. Comments are kept. | | | |

## G. Add-ons

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 38 | Open the extension's settings, press the **Add-ons** line | The line said "Emoji on; … off"; open, Emoji is on; Voice, Share, Live, Save to GitHub and My identity are off. | | | |
| 39 | Turn on **Voice**, then dictate a comment | The browser asks for the microphone; the words arrive in the box. | | | |
| 40 | Turn on **Share** with a sharing address | **More** in the toolbar menu has Share's row, a switch; nothing was sent before it was turned on. | | | |
| 41 | Turn each add-on off again | Its rows leave More. | | | |

## H. Looks, stacking and keys

| # | Do | Expect | Chrome | Firefox | Safari |
|---|---|---|---|---|---|
| 42 | Switch the computer to the dark look, then back | The toolbar bubble stays readable; Pipeup follows when its theme is Auto. | | | |
| 43 | On the long article, open a thread near the sticky header and scroll it under | Pipeup's box and threads are above the page's header, banners and menus, never under them. | | | |
| 44 | Open one of the page's own dialogs (a sign-in or share dialog), then comment on something inside it | Pipeup works inside the dialog and can be clicked. | | | |
| 45 | Put a video or picture fullscreen with Pipeup on | Pipeup is still there. Esc leaves fullscreen (the browser keeps that key). | | | |
| 46 | Zoom the page to 200 %, and narrow the window to about 400 wide | Boxes and threads stay inside the window; nothing is cut off. | | | |
| 47 | Press **Shift+Alt+C**, then **Tab**, **Enter**, type, **Enter**, **Esc** | The block cursor moves, a comment is written and comment mode ends, all without the mouse. | | | |
| 48 | With the block cursor out, move the mouse onto another block | The outline goes to the block under the mouse. | | | |
| 49 | In settings, turn on **Show Pipeup's button on pages**; scroll, then press the button | Comment mode starts. (Just after a scroll a Mac's scrollbar shows over the window's edge for a moment and takes presses there: note if the press was lost.) | | | |

## Differences that are expected

- **Safari** has no panel beside the page (step 27) and no Send to my agent yet (step 31).
- **Safari** moves between text boxes only with Tab, unless *Press Tab to highlight each item on a webpage* is on
  (Settings → Advanced) or Option is held. Pipeup's block cursor (step 47) doesn't depend on it; Tab between the buttons
  inside a thread does.
- **Firefox** keeps a temporary add-on only until it quits, and its side panel is the sidebar, one a window.
- **Esc in fullscreen** leaves fullscreen in every browser before Pipeup sees the key.

## What the automated WebKit run doesn't tell us

`npm run e2e:safari` in `libs/ts/pipeup` runs every one of Pipeup's browser tests in WebKit, Safari's engine. The
ones that still fail there fail for the test browser's reasons, not Pipeup's, so the steps above stand in for them:

| Tests | Why they fail in WebKit | Step that covers it |
|---|---|---|
| Tab between buttons | WebKit's Tab skips buttons by default | 15, 47 |
| A press on the corner button just after a scroll | the scrollbar that shows after a scroll takes the press | 49 |
| Touch and phone sizes | desktop WebKit only imitates touch; needs a real iPhone or iPad | not covered yet |
| Fullscreen, then Esc | WebKit keeps Esc for leaving fullscreen | 45 |
| Forced colours | WebKit has no forced-colours look | — |
| Tests that use Chrome's developer tools | Chrome only | — |

## Before sending to the stores

- Every step ✅ (or —) in Chrome, Firefox and Safari, on the build being sent.
- `npm run check` green in `libs/ts/pipeup` and in `apps/extension`.
- The version and the Pipeup file's hash match the npm release.

## Change log

- 2026-11-10: First version.
- 2026-11-10: Steps 13a and 13b, for typing in the extension's own frame.
- 2026-11-23: One menu (docs/design/one-menu.md): steps 2, 8, 22, 22a, 26, 29, 30, 32, 33, 34, 36, 38, 40 and 41 reworded for the six rows, More and Settings.
