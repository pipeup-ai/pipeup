# Pipeup website — Functional Specification

The public face of Pipeup: one page that says what Pipeup is for, shows it working, and tells a
visitor how to add it. Functional requirements only.

## 1. Purpose

- A visitor understands **what Pipeup does and why it's worth using** within a few seconds.
- They can **try it on the page itself**, without installing anything.
- They leave knowing **how to add it** to their own HTML.

## 2. Audience

- People who make and share HTML files — documents, decks, prototypes — and want feedback on them.
- People who ask AI tools to make those files, and want the feedback to flow back to the AI.

## 3. Content (one page, dense but calm, with little scrolling)

1. **First screen**: the headline "Feedback for any HTML." and one sentence on the value, set
   left-aligned beside the showcase with their tops aligned (stacked on phones). Under them:
   - **Copy prompt**: one click copies a ready-to-paste prompt that adds Pipeup
     to the reader's HTML file, including a fresh document key made in their browser, so there is
     nothing to fill in. The button's icon becomes a check and its label reads "Copied" for a moment,
     and a short note says to paste it into Claude or Codex.
   - **Install**, directly below and the same width: opens a short menu of ways to install: Claude Code (a command that installs
     the skill), Codex (a command that adds it to AGENTS.md), any other agent (llms.txt), the script
     tag for adding it by hand, and a download of the script. Choosing one copies or opens it.
   - The comment shortcut, so visitors can try Pipeup on this page.
   - One calm line on where it lives and where feedback goes: nothing to install (one script added
     to the HTML file, or loaded from a CDN, and an AI agent can add it); comments stay in the
     reviewer's own browser on their device and are never sent to any server; feedback leaves only
     when the reviewer copies it (Copy as Markdown or Copy as Text) and sends it themselves. The
     page's Markdown copy and llms.txt say the same.
2. **The showcase**: a looping demo that swipes between a **document**, **slides**, a
   **website** and the **keyboard**, changing every 10 seconds, each showing a comment being added, with a cursor that
   moves only to act and holds still while the comment is typed. The keyboard scene uses no pointer
   at all: Pipeup's block cursor (its outline and naming bar) moves through a small page while each
   key pressed appears on screen with what it does, like a screencast's key overlay: the comment
   shortcut (Comment mode), Tab (Next block) twice, ↑ (Around it), ↓ (Back in), Enter (Comment, and
   a comment is typed), Enter (Send) and Esc (Done). Key captions ease in and out; the shortcut is
   shown the way the visitor's keyboard labels it. Each scene's page is laid out at
   full width; when the comment opens, the view slides sideways to make room, like a horizontal
   scroll. Visitors can **pause** it, jump to any of the four, or swipe on a touch screen. With
   reduced motion it doesn't move on its own. In comment mode the showcase is commented on as one whole block (its moving parts are never
   picked on their own), while its tabs, pause and Try keep working.
   Beside the showcase controls, a **Try** link follows the current scene (its accessible name says which:
   "Try the document", "Try the slides", "Try the website"; the keyboard scene opens the document) and opens that example as a real page in the same tab.
3. **Try pages**: one real example each, running Pipeup, each with a very different look so
   visitors see Pipeup fit in anywhere:
   - **Document**: a short guide to how Pipeup works, laid out like a familiar word-processor page
     (a white page on a grey canvas, plain sans-serif type), without any product's branding.
   - **Slides**: a deck teaching the reviewer's side: someone sends you an HTML file, you hand it
     and the skill to your AI agent, comment on the page, send the sealed feedback file back, and
     the author's AI acts on it. Bold and graphic.
   - **Website**: a product landing page with a loud brand: vivid colour, huge heavy type, bold cards.
   A slim bar on top offers "← Pipeup" back to the home page (working when opened from disk too),
   the comment shortcut centred in the bar (when there is room), a **Try** menu listing the three examples with the current
   one ticked, and the GitHub link. It stays on one line at any width; on phones the GitHub link is
   just its icon. The bar keeps working in comment mode and is never commented on; everything else
   on the home page and the Try pages, including buttons, links and navigation, can be commented on.
4. **Footer**: always at the bottom of the window, with the facts that matter (one file and its size, no dependencies,
   works from disk, stays on your device) on the left and one **For agents** link on the right. Clicking
   it opens llms.txt; hovering or focusing it (or a first tap on touch screens) shows a short
   menu of every agent file. That is the only agent link on the page. The
   page doesn't describe the project's release status.

There is no separate set-up section: the two actions cover it.

**For agents**: the site serves, at stable addresses and linked from the page and its footer:
a short guide (llms.txt), the guide and all agent skills in one file (llms-full.txt), the page
itself as Markdown, the agent skills, the script, a robots.txt that welcomes every agent, and
structured data describing Pipeup as software.

**Link previews**: a link to the home page or a Try page shared in a chat app or social site
unfurls with a large preview image (the Pipeup mark, the name and "Feedback for any HTML", in the
site's light look), a title and a description. The pre-release copy's previews use its own image.

### Add-ons page

Optional add-ons have a page of their own, reached from a quiet "Add-ons" link in the footer. Nothing else on the
site changes: the first screen, the Copy prompt and the Install menu are about the core, which is what most people
use. The page:

- Says first that the core needs none of them and sends nothing anywhere, and that an add-on is an extra step the page's
  author chooses, never something a reviewer is moved into.
- Has one short card per add-on (Share, Voice, Live, Assist), each in plain words: what it does, **what it sends and to
  whom**, what the reviewer is asked first, and its script tag. Share also says the author picks the service (a
  PrivateBin or their own mailbox) and that it never picks one for them; Live says it is peer to peer and asks each
  reviewer before connecting; Voice says speech is handled by the browser's own engine, which may send audio to its
  maker; Assist says nothing is sent (the model runs on the reviewer's device, and the browser may download it once) and that each reviewer is asked first.
- Ends with a plain card, "Your own mailbox" (no demo), for the small server that Share can use instead of a public service: what it sends (sealed comments, to a server the author runs), what it needs (Node 22 or newer, an HTTPS proxy), a Copy command button and a link to its guide. It says it is not a page script and that Pipeup runs no mailbox for anyone. Share's card links to it.
- Shows each add-on with a short looping animated demo in the same style as the home page's showcase (a cursor that moves only to act, comments typed out, gentle easing): Share (two browsers, a comment sealed and passed across), Voice (a comment dictated and checked), Live (two named cursors and the people present), Assist (a comment, the assistant reading, then a reply that is only a short line and a slide pill whose card shows the related sentence). Each has a "Copy prompt" button that copies a ready-to-paste prompt for an AI agent to add that add-on by editing only the HTML file (nothing to download or run; the sharing address is asked of the person, never invented). With reduced motion each demo shows its finished moment.
- Says, in one line near the top, that people can make and publish their own add-ons, and links the guide (docs/ADDONS_GUIDE.md); Pipeup's own list is unchanged.
- Has a **Try it** link on each add-on card, leading to a try page for that add-on (see "Add-on try pages" below).
- Flows the full width of the window like the home page, text beside its demo.
- Carries a "beta" note while the add-ons are pre-releases, and says the core alone stays the stable choice.
- Is light mode, eases like the rest of the site, can be commented on like the rest of the site, and works without
  scripts of its own.
- Is described in llms.txt: add an add-on only when the author asks, tell them in plain words what it sends, and never
  choose a sharing service for them.

### Add-on try pages

Each add-on on the Add-ons page can be tried for real, on a page of its own that runs Pipeup with **that add-on and
no other**. They are made like the existing Try pages (a short example, a slim bar back to the site, commentable like
the rest of the site) and are reached from a **Try it** link on the add-on's card.

- **A short "what to do" at the top** of each page: the two or three steps to see the add-on work, what it sends and
  to whom (the same sentence as its card), and what it needs (a browser, a second window).
- **The add-on is the site's own copy**, the same version the card shows, so a try page never changes under a
  visitor. The pre-release copy's try pages use the pre-release add-ons.
- **Comments stay on the visitor's device** except where the add-on sends them, and the add-on asks first, exactly as
  it would on any page.
- **Voice**: a page to dictate a comment on. If the browser has no speech engine, the page says so in words instead
  of showing a button that does nothing.
- **Live**: a page that offers "Open a second window" onto the same example, so one person can see both cursors and
  the people present. It asks each window before connecting, and says public relays only introduce the windows to
  each other.
- **Assist**: a page that uses the browser's own model where there is one (Chrome on a computer), and says plainly
  what it needs and that a model may be downloaded once. Where there is none, the page offers a clearly labelled
  **practice mode** with a scripted pretend assistant, so the flow can still be seen. A second page does the same for
  a slide deck.
- **Share**: a page can only be tried online if comments have somewhere to go. Until the project chooses a service
  it is willing to point visitors at, the card says "Try it on your own computer" and shows the one command that
  opens a local demo (which runs its own sharing service on the visitor's machine). A page that sends to a public
  service would say so in plain words and ask the visitor first.
- **Your own mailbox** has no online try page: it needs a server of the visitor's own. Its card says so and points to
  its guide and the local demo.
- Light mode, easing like the rest of the site, and working without scripts of their own beyond the add-on.

## 4. Look and feel

- **Minimal**: it looks like a normal product site, not a document — content centred in the
  window, lots of whitespace, one sans-serif family for headings and text (no serif), monospace for
  code. Light only. Wide windows leave room beside the content for comments without shifting it.
- Restrained colour: off-black text on white or warm off-white, hairline borders, one soft accent
  used sparingly. No gradients, heavy shadows, emoji or stock imagery.
- The showcase gives the page its depth; there is no stock imagery.
- Headlines never wrap centred; text is left-aligned.
- Motion is gentle: sections fade and rise slightly as they come into view; nothing snaps.
  Reduced-motion settings are respected.
- Copy is plain and specific. No marketing clichés, and no em dashes.
- Keyboard shortcuts are shown the way the visitor's own keyboard labels them (⇧ ⌥ C on a Mac,
  Shift Alt C elsewhere), as separate, evenly sized keys.

## 5. Honesty

- The page never claims what isn't true yet: no install command or CDN address until Pipeup is
  published, and later features (shared rooms, live presence) are not promised.

## 6. Running it

- The site is fully self-contained: its fonts and Pipeup itself ship with it, so it makes no
  requests to other sites and works served locally or opened straight from disk.
- It can be published as static files later (for example on GitHub Pages) without changes.

## 7. Out of scope

- Documentation pages, blog, pricing, sign-up, analytics or tracking of any kind.

---

## Change log

- 2026-10-06 — First version.
- 2026-10-06 — Self-contained local build: bundled fonts and Pipeup, no third-party requests; works from disk.
- 2026-10-06 — Sans-serif only; content centred like a product site (no reserved gutter); a pausable showcase that swipes between a document, slides and a website, showing a comment being added.
- 2026-10-06 — 10 seconds per showcase scene; shortcuts shown per platform as separate keys; no em dashes in copy.
- 2026-10-06 — Denser first screen: "Feedback for any HTML." left-aligned beside the showcase; one-click "Copy prompt for Claude or Codex" with a fresh document key; skill install and by-hand set-up side by side; llms.txt and skills served for agents; the showcase can't be commented on.
- 2026-10-06 — Removed the "why" points for now; the try line is just the shortcut; the showcase is taller and shows a moving, clicking cursor.
- 2026-10-06 — Set-up section removed; "Install skill" opens a menu of install options; showcase pages are full width and the view slides over when a comment opens; calmer cursor; no key badge.
- 2026-10-06 — Buttons read "Copy prompt" and "Install", stacked at the same width; copying shows a check.
- 2026-10-06 — Footer pinned to the bottom with the agent links; release-status wording removed; llms-full.txt, the page as Markdown, robots.txt and structured data added.
- 2026-10-06 — One Pipeup mark everywhere: the round comment bubble (logo, favicon, and the comment icon in the showcase), matching the library's button.
- 2026-10-06 — The agent links combine into one "For agents" footer link with a hover menu; the header link is gone.
- 2026-10-06 — The facts line moves to the footer's left; the footer no longer repeats the name.
- 2026-10-06 — Try pages for a document, slides and a website, reached from a "Try it" link that follows the showcase.
- 2026-10-06 — Try pages teach Pipeup (a guide document and a reviewer-workflow deck) and each has a distinct look; the back link works from disk.
- 2026-10-06 — The link reads "Try"; the document looks like a word-processor page; the website's look is louder.
- 2026-10-06 — Feedback goes back by copying (Copy all), not sealed files: the slides, guide and agent files say so.
- 2026-10-06 — The showcase can be commented on as one whole block; its controls keep working in comment mode. The copy rows are called Copy as Markdown and Copy as Text throughout.
- 2026-10-06 — Everything on the site can be commented on except the Try bar (buttons, links and navigation included). The Try bar's example links become a Try menu, and the bar fits on one line at any width.
- 2026-10-07 — The Try bar's shortcut hint is centred; it gives way when the bar is too narrow, including while All comments is open.
- 2026-10-07 — The size is stated as about 36 KB; the home page's Markdown, llms.txt and the Try pages say reviewers can comment with the keyboard and screen readers.
- 2026-10-07 — Link previews: a large preview image (mark, name, "Feedback for any HTML") with title and description for the home page and Try pages, the pre-release copy included.
- 2026-10-07 — The first screen says plainly there is nothing to install and that comments stay in the reviewer's browser until they copy and send them; the footer adds "Stays on your device"; the Markdown page and llms.txt say the same.
- 2026-10-07 — A fourth showcase scene, Keyboard: no pointer, the block cursor moves through a page while each key and its action show as on-screen captions.
- 2026-10-07 — The privacy point lives only in the footer: "Stays on your device" with a lock, and a short note on hover, focus or tap ("Private by design…"); the first screen stays as it was.
- 2026-10-07 — The link-preview image is only the mark and the name, centred so a square thumbnail crop keeps all of it.
- 2026-10-07 — 0.4.1: the size is stated as about 37 KB.
- 2026-10-08 — An Add-ons page (Share, Voice, Live) reached from the footer; the home page and Copy prompt stay core only. The Copy prompt and llms.txt no longer ask an agent to download a file: they add the pinned CDN tag.
- 2026-10-08 — The Add-ons page gets an animated demo and a Copy prompt for each add-on, and uses the full width.
- 2026-10-08 — More contrast on the home and Add-ons pages (not the Try pages): darker borders and secondary text, a darker frame behind the showcase with a soft shadow under its window, and firmer outlines on the secondary buttons.
- 2026-10-08 — In the home showcase the pointer hides while the comment is typed and shows again from the same spot; clicking Send shows the button pressed, the comment settles with a soft halo and the send icon flies off, and the pointer fades out afterwards.
- 2026-10-08 — The Add-ons page matches the home page's width, header and footer links (Add-ons and the For agents menu, without the facts line): one row per add-on, words left and its demo right, short "Sends" and "Asks first" lines, and the same dark Copy prompt button plus a Copy script tag button that behave alike. The mark is drawn larger with a heavier stroke so it stays crisp on low-resolution screens.
- 2026-10-08 — Each page has its own Markdown copy: the Add-ons page's "This page as Markdown" opens addons.html.md (it pointed at the home page's).
- 2026-10-09 — The Add-ons page gains Assist (with a demo and Copy prompt) and a plain "Your own mailbox" card for the server Share can use; llms.txt and the Markdown copy say the same.
- 2026-10-09 — The Add-ons page links the guide for making your own add-on.
- 2026-10-09 — Proposed (not built): a Try it page for each add-on, linked from its card (Voice, Live, Assist, and Share once a service is chosen); none for the mailbox.
