# Pipeup for browsers — Functional Specification

A browser extension that lets a reviewer comment with Pipeup on any web page, including pages that never added it.
Functional requirements only. Visual spec: [design/browser-extension.html](design/browser-extension.html).

## 1. Purpose

- A reviewer can give feedback on **any page they can open**, not only pages whose author added Pipeup.
- What they write reaches the person or agent who asked for it the same ways it does today.

## 2. Browsers

- **First:** Chrome, Edge and Firefox, and the browsers that install from their stores (Brave, Vivaldi, Opera, Arc,
  Zen, Floorp, LibreWolf and others; Firefox on Android).
- **Then:** Safari on Mac, iPhone and iPad.
- Each installs from that browser's own store.

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
    **✓ Resolve** (or **Reopen**), and **Edit** and **Delete** on your own comments. Opening a thread there goes to its
    place on the page (unpinned, its popover opens there too).
  - The pin is in the side panel's header and in the toolbar panel (**Keep comments beside the page**); the choice is
    kept for every site. Unpinning closes the side panel, and closing it unpins.
- When the extension adds Pipeup, **Pipeup's corner button is hidden**. A setting, **Show Pipeup's button on pages** (off
  by default), brings back Pipeup's own button, menu and panel on the page instead.
- On a page that has **Pipeup built in**, the extension steps aside and says so; the page's own copy is the only one.
- On pages browsers keep closed to extensions (their settings, new tab and store pages, files such as PDFs the browser
  draws itself), the panel says Pipeup can't run there and why.

## 4. Commenting

- Pipeup works as on a page that has it built in: the same control, menu, comments and add-ons, in the same looks.
- The add-ons that work on any page are included, each turned on by the reviewer. Add-ons that need the page's own
  markup (Inline) and update notices (the store updates the extension) are not.

## 5. Where comments are kept

- In the browser, **by the extension**, by page address. The site can't read or remove them, and the extension writes
  nothing into the site's own storage.
- **Comments you've made** lists every page the reviewer has commented on, newest first, and opens any of them.
- When a comment is made, the extension keeps a **small picture of where it was**, in that browser only. A Lost comment
  (functional spec §8) shows it to the reviewer who made it, marked "only in this browser". The picture is never sent
  with the comment, shared or copied for AI. Pictures are on by default; the reviewer can turn them off, which also
  removes the ones kept.
- A page's scripts can't reach the extension's Pipeup. Agents get comments as they do today: Copy for AI, Share, or the
  agents' mailbox.

## 6. Privacy

- The extension sends nothing anywhere and loads no code from the web. Only add-ons the reviewer turns on send, as they
  say. No analytics or telemetry.

## 7. Releases

- Every Pipeup release is also an extension release, with the **same version** and the **same Pipeup files** as npm.
- Each store reviews each release; until a store has, it offers the previous version. The maintainer can see, per
  store, whether a release is live or waiting for review.
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
