# Pipeup for browsers — Functional Specification

A browser extension that lets a reviewer comment with Pipeup on any web page, including pages that never added it.
Functional requirements only, written as the product is; the change log at the end says how it got here. Visual
specs, current: [design/extension-menu.html](design/extension-menu.html) (the one menu),
[design/newcomer-pass.html](design/newcomer-pass.html) and [design/states-pass.html](design/states-pass.html) (the
newcomer's first run), [design/safari-app-window.html](design/safari-app-window.html) (Safari's app window).
Earlier ones (browser-extension, extension-native-ui, extension-on-page, extension-pin) are history, kept for the
record.

## 1. Purpose

- A reviewer can give feedback on **any page they can open**, not only pages whose author added Pipeup.
- What they write reaches the person or agent who asked for it the same ways it does today.

## 2. Browsers

- Chrome, Edge and Firefox on computers, the browsers that install from their stores (Brave, Vivaldi, Opera, Arc, Zen,
  Floorp, LibreWolf and others), and Safari on a Mac. Later: Firefox on Android, and Safari on iPhone and iPad.
- Each installs from that browser's own store.
- Where a browser can't do something, the extension leaves it out rather than offering it broken:
  - **Safari** has no panel beside the page: comments always open on the page, and **Keep comments beside the page**
    isn't offered. Safari doesn't offer **Share** or **Live** (they show other people's comments, which Apple's store
    requires ways to report and block for), and keeps no pictures of where comments were made (§5), since it has
    nowhere to show them.
  - **Send to my agent** is offered in Chrome, Edge and Firefox on Mac and Linux; not in Safari or on Windows, where it
    isn't shown.
  - **Voice** is offered only where the browser can turn speech into text (not Firefox).

## 3. Turning Pipeup on

- **Nothing is added to a page until the reviewer asks**, by one of three ways: the toolbar button's **Comment on this
  page**, the one shortcut, or **Comment with Pipeup** in the right-click menu (§4a).
- **The one shortcut is Shift+Alt+C** (Shift+Option+C on a Mac), everywhere. With Pipeup off on the page it adds Pipeup
  and starts comment mode, as Comment on this page does; with Pipeup on it turns comment mode off and on, the
  comments staying in view. Taking Pipeup off the page is **Turn off on this page** in the menu. The toolbar button's
  own shortcut has no key unless the reviewer gives it one in the browser's settings. On a page with Pipeup built in
  the key goes to the page's own Pipeup (below).
- **Permission.** Installing asks for no access to sites. In Chrome, Edge and Firefox, pressing the toolbar button,
  the shortcut or the right-click item is the permission for that page, and nothing is asked. Safari grants nothing
  on a press: the first time Pipeup is used it asks, once, whether Pipeup may see websites, and the panel says so under
  the button before the press (comments stay in the browser; **Always Allow on Every Website** means it never asks
  again). The press is never lost: when Safari closes the panel to ask, Pipeup is still added and comment mode still
  starts once the question is answered. No other question is ever asked for commenting, since comments go nowhere;
  only an add-on that sends them somewhere says so when it is turned on (§6). **Always on for this site** adds Pipeup
  whenever that site is opened, and where the browser asks per site, asks for that site only.
- **The toolbar button** is Pipeup's violet bubble in every browser, on light and dark toolbars alike, as the stores and
  the app show it; it never changes with the browser's look or the system's. Its badge counts the page's open
  comments, and turns green with "on" while comment mode is on and there are none.
- **The toolbar menu, with Pipeup off** on the page, shows the page's address, one action, **Comment on this page**, and
  one sentence saying what will happen ("Click anything on the page to comment on it"). Nothing else: no switches,
  shortcuts or links before the first comment. Where comments stay is said once, after the first comment, not before.
- **The toolbar menu, with Pipeup on**, is Pipeup's menu, the one menu in the extension, built for the reviewer's job
  (comment, then get the comments to whoever asked) rather than the feature list. In order:
  - who you are (the name, edited in place; "Add your name" until there is one);
  - **Your comments on this page**, with the count, which opens them (§4a);
  - **Copy comments**, one press: the comments as readable text a person can paste into a message or an AI chat, which
    is also Markdown (functional spec §7a), described as "to paste anywhere", never by format;
  - **Save as a file**, which opens to its two kinds (§4a);
  - **Send to my agent**, where it is offered (§2) and once it is set up; until then it is under More, as a row that
    says it is set up once, so a newcomer's menu has nothing in it they can't use;
  - **Commenting**, a switch with the shortcut beside it, the one row that says whether comment mode is on;
  - **More**, which opens in place to everything that is a preference or a way out: **Theme**, **Hide comments**, **Keep
    comments beside the page** (where offered), **Always on for this site** (or **Always on for local pages**, §4a),
    the add-ons' rows, **Turn off on this page**, and **Settings**.
    The menu has no status line and no footer. The shortcut's keys are drawn (Shift and Option as Pipeup's own glyphs on
    a Mac, the words elsewhere), the same in every browser.
- **On the page**, Pipeup's own menu isn't shown: the toolbar menu is the menu. The panel Pipeup opens on the page
  keeps the name and the Comment switch in its bar, and nothing the toolbar menu already offers. Pipeup's corner
  button is hidden and comment mode's hint names no button; the setting **Show Pipeup's own button in the page's
  corner** (off by default) brings back Pipeup's own button, menu and panel on the page instead, from the next page
  Pipeup starts on.
- **After the reviewer's first comment** in this browser, one line says, once, where it went and what comes next
  ("Saved in this browser. Press Pipeup in the toolbar to copy, save or send them"): the menu's own verbs, said when
  they are true.
- **A new comment is written on the page**, in a box beside what it's about, with the cursor in it (a browser can't
  move the cursor into its side panel). What the reviewer types there can't be seen by the page (§5).
- **Threads open on the page** (unpinned, the default): a comment's thread opens beside it as a popover, and the page
  keeps its width. **Your comments on this page** opens Pipeup's own panel on the page.
- **Pinned** (Chrome and Edge's side panel, Firefox's sidebar; not Safari): the side panel stays beside the page. A
  thread opened on the page, or just written, shows there, and Your comments on this page opens the side panel. The
  side panel lists every comment with **@ For you** and **✓ Resolved**; each thread has its replies, **Reply**, **✓
  Resolve** (or **Reopen**), and **Edit** and **Delete** on your own comments. Each says what it's on: its words, or,
  for something without words, what it is and what it's called ("On a picture · Lumen logo"). A click anywhere on a
  thread opens it and goes to its place on the page, which is marked. The line Pipeup draws from a comment to its
  place can't cross from the side panel into the page. The pin is in the side panel's header and under More (**Keep
  comments beside the page**); the choice is kept for every site. Unpinning closes the side panel, and closing it
  unpins.
- **A page with Pipeup built in** keeps its own: the extension steps aside, and the toolbar menu says so and says to
  comment with the page's own button or the shortcut. A press that would have started commenting there, the shortcut
  or Comment with Pipeup, goes to the page's own Pipeup as its shortcut, so the key does on that page what it does on
  any page with Pipeup. A root left in a tab by a copy of the extension that the browser has already cut off (the
  extension reloaded or replaced under the tab) is not the page's own: it is taken off, and Pipeup starts.
- **When the extension is reloaded or updated**, Pipeup on open pages takes itself off them; pressing Pipeup again
  starts the new version. Comments are kept.
- **Pages browsers keep closed to extensions** (their settings, new tab and store pages, files such as PDFs the browser
  draws itself, and HTML files opened from this computer): the menu says Pipeup can't run there and why. For a file
  it says how to open it so Pipeup can run (through a local server, or with `pipeup browser`; in Chrome, also the
  browser's own switch that lets an extension see files). Where the browser gives the extension no address at all,
  the menu says "This page" rather than guessing one.

## 4. Commenting

- Pipeup works as on a page that has it built in: the same control, menu, comments and add-ons, in the same looks.
  The page's look (light or dark) and font are followed as on any page; the page's link colour becomes Pipeup's accent
  only when it is a colour that reads (functional spec §9), otherwise Pipeup's violet.
- The add-ons that work on any page are included, each turned on by the reviewer. Add-ons that need the page's own
  markup (Inline) and update notices (the store updates the extension) are not.

## 4a. More ways in, and out

- **Right-click menu:** **Comment with Pipeup** on selected words, a picture, a link or anything on a page adds Pipeup if
  it isn't on, and opens the comment box on what was right-clicked (the words selected; the picture; the link; else
  what was right-clicked). On a page with Pipeup built in, it goes to the page's own Pipeup as its shortcut (§3).
- **Your comments on this page**, in the toolbar menu, opens Pipeup's own panel on the page when comments aren't
  pinned, and the side panel when they are.
- **Single-page apps:** when a site changes page without loading one (its address changes), Pipeup follows: the new
  address's comments show, in the same comment mode.
- **Pages on this computer:** on a page from localhost or 127.0.0.1, More offers **Always on for local pages** (every
  port) in place of Always on for this site.
- **Save as a file**: **A Markdown file** (for people and AIs) or **A Pipeup file** (to open again), saved where the
  browser saves downloads.
- **Send to my agent**: the page's comments go to agents on this computer, and their replies come back into the threads
  (functional spec §15g). Until it is set up, its row is under More and opens to the one command to run, which sets
  it up for the browser it is in (Chrome, Edge or Firefox) from the release the extension is; set up, the row is in
  the menu's top level.
- **Add-ons**, turned on in Settings: Emoji (on by default), Voice, Share (with a sharing address), Live, Save to GitHub
  (with a repository; GitHub asks the reviewer to sign in on its own page, so the extension holds no GitHub sign-in)
  and My identity. Their menu rows are under More.

## 5. Where comments are kept

- In the browser, **by the extension**, by page (its document identity where the page has one, else its address).
  The site can't read or remove them, nor anything else Pipeup shows on the page (the reviewer's name, add-ons'
  panels, a recovery code).
- **What the reviewer types into Pipeup on a page can't be seen by the page:** not the words of a comment, reply or
  edit, nor the keys pressed, nor what is pasted or dictated there. Typing looks and works as it does on a page with
  Pipeup built in: @mentions, add-ons' buttons in the box (Emoji, Voice), Enter to send, Shift+Enter for a new line,
  Esc to cancel, undo, and the browser's spelling and input methods, in the page's look. The page sees only that
  Pipeup's box has the focus.
- The extension writes nothing into the site's own storage. Add-ons' choices are kept by the extension too (whether
  Live is on and that the reviewer agreed to it, Share's and Voice's choices, Emoji's recent emoji), so a page can't
  read them or set them in advance.
- **Settings** (reached from More) opens on **Comments you've made**, every page the reviewer has commented on, newest
  first, each opening that page; then the one keyboard shortcut; then the extension's settings, one sentence under
  each; then the add-ons and Send to my agent's set-up, each behind one line until the reviewer asks for them. A
  newcomer reads about a hundred words, not a manual.
- When a comment is made, the extension keeps a **small picture of where it was** (where the browser lets it see the
  tab: after a press on Pipeup, its shortcut or its right-click item), in that browser only. A Lost comment
  (functional spec §8) shows it to the reviewer who made it, marked "only in this browser". The picture is never sent
  with the comment, shared or copied for AI. Pictures are on by default; the reviewer can turn them off, which also
  removes the ones kept. Deleting a comment removes its picture.
- A page's scripts can't reach the extension's Pipeup. Agents get comments as they do today: Copy comments, Share, or
  Send to my agent.

## 6. Privacy

- No account, no server of Pipeup's own, no analytics or telemetry, and no code loaded from the web.
- On its own the extension sends nothing. Comments leave the browser only when the reviewer copies or saves them, or:
  - **Send to my agent**, when pressed: the page's comments go to agent programs on this computer, nowhere else.
  - **Add-ons the reviewer turns on**, each as it says when turned on: **Share** sends comments to the sharing address
    the reviewer gave; **Live** shares the reviewer's presence on the page with others there, only after the reviewer
    agrees in Live's own panel; **Save to GitHub** opens a GitHub page holding the comment, which GitHub receives when
    the page opens (nothing is filed until the reviewer submits it there); **Voice** uses the browser's own speech
    service, which may send what is said to the browser's maker.
- Where the browser asks people to agree to what an extension sends (Firefox), it asks before Send to my agent is
  first used, and before Share, Live or Save to GitHub is first turned on; declined, that feature stays off.
- The store listings and the privacy policy say the same as this section ([store/privacy-policy.md](store/privacy-policy.md)).

## 7. Releases

- Every Pipeup release is also an extension release, with the **same version** and the **same Pipeup files** as npm.
- Each store reviews each release; until a store has, it offers the previous version. The maintainer can see, per
  store, whether a release is live or waiting for review.
- Each store's package is built from the release's tag, so a store's reviewer can rebuild it from the source.
- Stores get stable releases only. Pre-releases may later go to separate testing listings.

## Change log

- 2026-11-09 — First version. Agreed with the maintainer: comments are kept by the extension, by page address; a
  page's scripts can't reach the extension's Pipeup; Chrome, Edge and Firefox first, Safari after; stable releases only
  in stores at first.
- 2026-11-09 — A small picture of where each comment was made, in that browser only, shown on a Lost comment to the reviewer who made it (§5; visual spec docs/design/refind-comments.html). On by default.
- 2026-11-09 — Built for local testing in Chrome (load unpacked; apps/extension/README.md). Not in any store yet.
- 2026-11-09 — The toolbar is the way into Pipeup (visual spec docs/design/extension-on-page.html): Pipeup's corner button is hidden on pages the extension adds it to, unless the reviewer turns on Show Pipeup's button on pages; the panel gains Start commenting, All comments and Pipeup's menu; Comment on this page also starts comment mode; the toolbar button shows comment mode.
- 2026-11-09 — Pipeup in the browser, not on the page (visual spec docs/design/extension-native-ui.html): the toolbar panel is Pipeup's whole menu, and the comments (the list, threads, replies and the new-comment box) are in the browser's side panel; the page keeps only highlights, pins and comment mode's outline. Reactions, mentions and add-ons' rows aren't in the extension's panels yet.
- 2026-11-09 — Write where you point; pin the comments (visual spec docs/design/extension-pin.html): a new comment's box opens on the page with the cursor in it; comments are pinned in the side panel or, by default, open as popovers on the page.
- 2026-11-09 — After the extension is reloaded or updated, Pipeup on open pages takes itself off them.
- 2026-11-09 — Side panel: a click anywhere on a thread opens it; a thread on something without words says what it is and its name.
- 2026-11-09 — The right-click menu, Comments opening Pipeup's own panel when unpinned, single-page apps, Always on for local pages, pictures (shown on lost comments in the side panel), Save comments, Send to my agent, and add-ons with their settings (§4a, §5).
- 2026-11-10 — Built for local testing in Firefox and in Safari on a Mac. What Safari can't do is left out: comments aren't pinned beside the page there, and Send to my agent isn't offered (§2).
- 2026-11-10 — Ready for the stores, agreed with the maintainer after checking the store drafts against the code: what each browser leaves out (§2: Send to my agent not on Windows; Voice not in Firefox; Share, Live and pictures not in Safari; Firefox on Android and Safari on iPhone and iPad later); Send to my agent's command fits the browser and release (§4a); nothing Pipeup shows can be read by the site, add-ons' choices are kept by the extension, and deleting a comment removes its picture (§5); what leaves the browser, and when, said in full, with the browser asked first where it asks (§6); packages built from the release's tag (§7).
- 2026-11-10 — Agreed with the maintainer: what the reviewer types into Pipeup on a page can't be seen by the page, keys included (§5). Design: docs/design/extension-private-typing.md.
- 2026-11-23 — HTML files opened from this computer: the panel says they're closed to extensions and how to open them so Pipeup can run; no address from the browser reads "This page", not "about" (§3). Found on a file opened in Safari.
- 2026-11-23 — Agreed with the maintainer (visual spec docs/design/extension-menu.html): one menu, built for the job. Before the first comment, one action and one sentence; with Pipeup on, six rows (name, Your comments on this page, Copy comments in one press, Save as a file, Send to my agent where offered, Commenting) and More for preferences and ways out; no status line or footer; Pipeup's own menu isn't shown on the page; a one-time line after the first comment; Comments you've made becomes the first part of Settings (§3, §4a, §5). From the newcomer's first run in Safari and Chromium (23 November 2026).
- 2026-11-23 — Agreed with the maintainer (visual spec docs/design/newcomer-pass.html), from a second newcomer's run over the one menu: before the first comment the sentence says only what clicking does; the one-time line after it uses the menu's verbs (copy, save or send); Send to my agent is under More until it is set up; the hint on the page names no button; Settings reads in about a hundred words, the shortcuts on one line each and the agent set-up behind one line (§3, §4a, §5).
- 2026-11-24 — Safari: one question, once, instead of one per site per day, said in the panel before the press; and
  Comment on this page finishes its work after Safari's question closes the panel, instead of losing the press (§3).
  Found by the maintainer on the first press in Safari.
- 2026-11-25 — The toolbar button is the violet bubble in every browser (§3). It was one of two greys picked by the system's dark mode, so a dark Mac with a light Chrome theme got a light-grey bubble on a light toolbar, near invisible; Safari, which tints its own icon, showed violet, and the two didn't match.
- 2026-11-25 — One shortcut, Shift+Alt+C, on and off: with Pipeup off it adds Pipeup and starts comment mode, with Pipeup on it turns comment mode off and on; the toolbar button's Shift+Alt+P is no longer a default key, and Settings lists the one shortcut (§3). The maintainer: two ways on don't make sense.
- 2026-11-25 — On a page with Pipeup built in, the shortcut and Comment with Pipeup go to the page's own Pipeup instead of doing nothing (§3). The browser now takes the shortcut before the page sees it, so without this a built-in page lost its key. The maintainer: if Pipeup is there, don't offer to turn it on.
- 2026-11-25 — Rewritten as the product is, after the maintainer found the spec layered (side-panel-era sentences beside the one menu's): §2 Safari is shipped, not next; §3 says the three ways in, the one shortcut, the permission in every browser, the two states of the toolbar menu, on-page threads as the default and the side panel as the pinned choice, built-in pages and orphans; §4a's right-click item always opens the box on its target; §5 names the one shortcut. The header names the current visual specs and marks the earlier ones as history. Nothing in the product changed.
