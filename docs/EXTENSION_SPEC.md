# Pipeup for browsers — Functional Specification

A browser extension that lets a reviewer comment with Pipeup on any web page, including pages that never added it.
Functional requirements only. Visual spec: [design/browser-extension.html](design/browser-extension.html).

## 1. Purpose

- A reviewer can give feedback on **any page they can open**, not only pages whose author added Pipeup.
- What they write reaches the person or agent who asked for it the same ways it does today.

## 2. Browsers

- **First:** Chrome, Edge and Firefox on computers, and the browsers that install from their stores (Brave, Vivaldi,
  Opera, Arc, Zen, Floorp, LibreWolf and others).
- **Then:** Safari on Mac; later Firefox on Android, and Safari on iPhone and iPad.
- Each installs from that browser's own store.
- Where a browser can't do something, the extension leaves it out rather than offering it broken:
  - **Safari** has no panel beside the page: comments always open on the page, and **Keep comments beside the page**
    isn't offered.
  - **Send to my agent** is offered in Chrome, Edge and Firefox on Mac and Linux; not yet in Safari or on Windows,
    where it isn't shown.
  - **Voice** is offered only where the browser can turn speech into text (not Firefox).
  - **Safari** doesn't offer **Share** or **Live** (they show other people's comments, which Apple's store requires ways
    to report and block for), and takes no pictures of where comments were made (§5), since it has nowhere to show
    them.

## 3. Turning Pipeup on

- Nothing is added to a page until the reviewer asks: from the browser's toolbar button, or its shortcut (Shift+Alt+P;
  Shift+Alt+C stays comment mode once Pipeup is on).
- Installing asks for no access to sites. **Always on for this site** adds Pipeup whenever that site is opened, and
  asks the browser's permission for that site only.
- The toolbar button's panel shows the page's address. Off, it offers one main action, **Comment on this page**, which
  adds Pipeup and starts comment mode, since that is why the reviewer pressed it.
- With Pipeup on, the toolbar panel is **Pipeup's menu**, drawn by the extension: where comments go, who you are (the
  name edited in place), **Copy comments** (As Markdown, As text), **Theme**, **Comments** (with the open count),
  **Hide comments**, **Keep comments beside the page** and **Start commenting**, then **Always on for this site** and
  **Turn off on this page**.
- **A new comment is written on the page**, in a box beside what it's about, with the cursor in it (the browser can't
  move the cursor into its side panel).
- Comments can be **pinned** beside the page, in the browser's **side panel** (Chrome and Edge's side panel; Firefox's
  sidebar), or not:
  - **Unpinned** (the default): a comment's thread opens beside it on the page, as a popover, and the page keeps its
    width. **Comments** in the toolbar panel opens the side panel with every comment.
  - **Pinned**: the side panel stays beside the page. A thread opened on the page, or just written, shows there.
  - The side panel lists every comment with **@ For you** and **✓ Resolved**; each thread has its replies, **Reply**,
    **✓ Resolve** (or **Reopen**), and **Edit** and **Delete** on your own comments. Each says what it's on: its words,
    or, for something without words, what it is and what it's called ("On a picture · Lumen logo"). A click anywhere on
    a thread opens it and goes to its place on the page, which is marked (unpinned, its popover opens there too). The
    line Pipeup draws from a comment to its place can't cross from the side panel into the page.
  - The pin is in the side panel's header and in the toolbar panel (**Keep comments beside the page**); the choice is
    kept for every site. Unpinning closes the side panel, and closing it unpins.
- When the extension adds Pipeup, **Pipeup's corner button is hidden**. A setting, **Show Pipeup's button on pages** (off
  by default), brings back Pipeup's own button, menu and panel on the page instead.
- On a page that has **Pipeup built in**, the extension steps aside and says so; the page's own copy is the only one.
- When the extension is reloaded or updated, Pipeup on open pages takes itself off them; pressing Pipeup again starts the
  new version. Comments are kept.
- On pages browsers keep closed to extensions (their settings, new tab and store pages, files such as PDFs the browser
  draws itself), the panel says Pipeup can't run there and why.

## 4. Commenting

- Pipeup works as on a page that has it built in: the same control, menu, comments and add-ons, in the same looks.
- The add-ons that work on any page are included, each turned on by the reviewer. Add-ons that need the page's own
  markup (Inline) and update notices (the store updates the extension) are not.

## 4a. More ways in, and out

- **Right-click menu:** **Comment with Pipeup** on selected words, a picture, a link or anything on a page adds Pipeup if
  it isn't on, and opens the comment box on what was right-clicked (words selected; the picture; the link; else what
  was right-clicked, or comment mode when Pipeup wasn't on yet).
- **Comments** in the toolbar menu opens Pipeup's own panel on the page when comments aren't pinned, and the side panel
  when they are.
- **Single-page apps:** when a site changes page without loading one (its address changes), Pipeup follows: the new
  address's comments show, in the same comment mode.
- **Pages on this computer:** on a page from localhost or 127.0.0.1, the toolbar menu offers **Always on for local
  pages** (every port), in place of Always on for this site.
- **Save comments**, in the toolbar menu: **As a Markdown file** (for people and AIs) or **As a Pipeup file** (to open
  again), saved where the browser saves downloads.
- **Send to my agent**, in the toolbar menu: the page's comments go to agents on this computer, and their replies come
  back into the threads (functional spec §15g). Until it is set up, it says the one command to run, which sets it up
  for the browser it is in (Chrome, Edge or Firefox) from the release the extension is.
- **Add-ons**, turned on in the extension's settings: Emoji (on by default), Voice, Share (with a sharing address),
  Live, Save to GitHub (with a repository; GitHub asks the reviewer to sign in on its own page, so the extension holds
  no GitHub sign-in) and My identity. Their menu rows are in Pipeup's own menu, reached from **More from add-ons**.

## 5. Where comments are kept

- In the browser, **by the extension**, by page address. The site can't read or remove them, nor anything else Pipeup
  shows on the page (the reviewer's name, add-ons' panels, a recovery code).
- **What the reviewer types into Pipeup on a page can't be seen by the page:** not the words of a comment, reply or
  edit, nor the keys pressed, nor what is pasted or dictated there. Typing looks and works as it does on a page with
  Pipeup built in: @mentions, add-ons' buttons in the box (Emoji, Voice), Enter to send, Shift+Enter for a new line,
  Esc to cancel, undo, and the browser's spelling and input methods. The page sees only that Pipeup's box has the
  focus.
- The extension writes nothing into the site's own storage. Add-ons' choices are kept by the extension too (whether
  Live is on and that the reviewer agreed to it, Share's and Voice's choices, Emoji's recent emoji), so a page can't
  read them or set them in advance.
- **Comments you've made** lists every page the reviewer has commented on, newest first, and opens any of them.
- When a comment is made, the extension keeps a **small picture of where it was** (where the browser lets it see the
  tab: after a press on Pipeup or its right-click menu), in that browser only. A Lost comment
  (functional spec §8) shows it to the reviewer who made it, marked "only in this browser". The picture is never sent
  with the comment, shared or copied for AI. Pictures are on by default; the reviewer can turn them off, which also
  removes the ones kept. Deleting a comment removes its picture.
- A page's scripts can't reach the extension's Pipeup. Agents get comments as they do today: Copy for AI, Share, or the
  agents' mailbox.

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
