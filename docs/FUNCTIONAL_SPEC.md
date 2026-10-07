# Pipeup — Functional Specification

**Status:** Draft for review
**Owner:** Pipeup maintainers
**Last updated:** 2026-10-07 (keyboard and screen-reader cursor)

This document describes *what* Pipeup does. It is **functional only** — it does not prescribe
languages, frameworks, protocols, ciphers or hosting internals. Those live in the dev design
document, [design/architecture.md](design/architecture.md), which also holds the diagrams.
Interactive mock-ups (a document, an HTML slide deck, a rich website and a motion playground) shaped
the interaction design; they are kept with the maintainers and are not part of the public repository.
The website's Try pages show the design as built.

---

## 1. Product overview

People increasingly share work as standalone HTML files — reports, specs, prototypes and slide
decks, many of them written by AI agents. Those files have no good way to collect feedback.
Reviewers reply in chat threads that lose the context of *what* they were looking at.

Pipeup is a small library that an author (or an agent working for them) adds to any HTML page.
It turns that page into a reviewable document: reviewers can select text or point at any spot,
leave comments, reply and resolve, and — when the author chooses — see each other live, the way
they would in Google Docs or Figma.

Principles:

- **The page stays the author's.** Pipeup never changes how the page looks or behaves when
  comments are closed, and never covers its content.
- **Private by default.** Without any setup, comments stay on the reviewer's own machine.
  Nothing leaves it unless someone deliberately shares.
- **No service to run.** Pipeup works without any server operated by the Pipeup project.
  Authors who want live rooms host their own relay on a free account in one step.
- **Untrusted relay.** Whoever runs a relay, including its hosting company, can never read or
  forge comments.
- **Agent-ready.** Agents can add Pipeup to a page, verify they did it well, and read and act on
  the feedback.

> *Pipe up, right where the work is.*

## 2. Audiences and primary scenarios

**Authors** (people, or agents acting for them)

1. *I made an HTML deck and want feedback.* I add Pipeup to it, send the file or link, and get
   comments pinned to the exact slide and spot.
2. *Several people reviewed my file separately.* Each copies their comments (Copy as Markdown) and sends
   them to me; I paste them into my AI agent, which knows exactly where each comment is.
3. *I want a live review session.* I create a room on my own relay, share an invite link, and
   everyone sees who is here, which slide they are on and where their cursor is.
4. *My page changed since people commented.* Comments follow the content they were about; the
   ones that can't are clearly flagged instead of landing in the wrong place.

**Reviewers**

5. *Someone sent me an HTML file.* I open it, choose "Comment", select a sentence and type. I
   don't need an account.
6. *I'm reviewing a deck.* I click anywhere on a slide to drop a pin and comment, Figma style.
7. *I'm done.* I press "Copy as Markdown" and send what I copied back however I like — or, in a
   room, my comments are already shared.

**Agents**

8. *Add commenting to this page.* The agent integrates Pipeup, runs the check, and fixes
   anything the check reports until it passes.
9. *Summarise the feedback.* The agent reads the feedback, groups it by theme and section, and
   lists what is unresolved.
10. *Apply the feedback.* The agent edits the page for the comments the author approves, then
    replies to and resolves those threads.

## 3. What can be reviewed

- **HTML documents** — any page of flowing content: reports, specs, articles, prototypes.
- **HTML slide decks** — hand-made decks and decks built with common slide frameworks.
- **Any web page** the author controls, whether opened directly from disk, served locally, or
  hosted on the web.
- Pages that change after loading — content rendered by frameworks, loaded late, behind tabs or
  accordions, on different routes, or drawn as charts and canvases (see §8).

Images and PDFs as standalone review targets are **out of scope** for the first release.

## 4. Adding Pipeup to a page

- An author adds Pipeup with a **single line** in the page, loading it from a public CDN, or by
  installing it from a common package manager.
- A page can **include Pipeup entirely inside the file**, so it works with no network at all.
- Pipeup works the same whether the page is **opened from disk**, served from a local server, or
  hosted on the web.
- Authors can optionally mark up their page to help Pipeup:
  - a **document identity**, so copies of the same file on different machines are recognised as
    the same document;
  - **stable identifiers** on blocks, charts and slides, so comments stay attached precisely;
  - **areas to ignore** (navigation, footers, controls) where commenting is not offered;
  - a **preferred side** for the comment gutter;
  - a **reserved comment gutter**: a page can lay itself out around the space comments need (see
    §9), so its content stays centred in what remains;
  - for decks, which element is a **slide**.
- Pages with none of this markup still work; Pipeup falls back to its own judgement.
- Pipeup never requires the author to restructure or restyle their page, and never moves or
  restyles the page itself.

## 5. Starting a comment

Reviewers can start a comment in four ways. One set of gestures covers all of them; authors can turn
any of them off.

| Way | Gesture | Best for |
|---|---|---|
| **Text** | In comment mode, select words. A small comment control eases in above the selection. | Wording, specific claims |
| **Block** | In comment mode, hover: an outline glides to the most obvious thing under the pointer — a paragraph, card, image, table, chart or a single button. Click it and the comment box opens straight away. | Whole elements, including controls |
| **Pin** | In comment mode, Option-click an exact spot, or choose a block and press **Pin** on its naming bar. | Slides, charts, canvases, designs |
| **General** | Comment on the page or slide as a whole. | Overall reactions |

- **Selecting text offers commenting only in comment mode.** Outside it, selecting text offers
  nothing and the page behaves as normal. The control is a single comment icon; it never covers
  the selection.
- **Comment mode** is switched on and off from the comment control or with **⇧⌥C** on a Mac
  (**Shift+Alt+C** elsewhere) — a shortcut chosen not to clash with common browser and page
  shortcuts. **Esc** steps back out of it. Outside comment mode the page behaves exactly as normal.
- In comment mode the pointer becomes a **picking cursor** (an arrow over a dashed box, like a
  browser's element picker), except over areas the author marked to ignore.
- In comment mode, **links, buttons, toggles, menus and form fields become things to comment on**
  instead of things that act. Nothing on the page fires, submits or navigates when clicked or tapped.
  From the keyboard, while the block cursor (below) is not in use, Enter and Space on a focused control
  of the page do what the page expects, and Pipeup does nothing with them.
- **Clicking a block opens the comment box at once** — no second click. A small bar above it names
  the block ("Button · Start free trial") and offers three icons, each named on hover and to screen
  readers: **Around it** moves the comment to the block around it, **Inside it** to a block inside it,
  both keeping anything already typed, and **Pin** turns it into a pin at the block's centre (on touch
  screens, at the next spot tapped). The bar uses icons, not words.
- Pipeup skips invisible wrappers and very large containers when choosing the obvious block, and
  prefers anything the author marked with a stable identifier.
- Besides paragraphs, headings, images, tables and controls, the obvious blocks include page
  sections (sections, articles, asides, navigation, headers, footers, forms and field groups),
  lists and their items, captions, anything the page marks with an accessible role (a button, a
  tab, a region, a dialog and so on), and any box that visibly lays out several things in a row
  or grid. The innermost such block under the pointer wins; something covering most of the window
  is still the page, not a block.
- **While text is selected in comment mode**, no block is outlined or named on hover, wherever the
  pointer goes: the selection's comment icon is the only offer. Block outlines come back once the
  selection is cleared or its comment is started or cancelled.
- Areas the author marked to ignore (navigation chrome, slide controls) are never targets and keep
  working in comment mode.
- Writing a comment: type and press **Enter** to send (**Shift+Enter** for a new line, **Esc** to
  cancel). A small paper-plane send icon, pointing right, appears once there is text. There is no
  placeholder text and no "Post" button.
- **A name is never required.** A reviewer can comment straight away. Next to the comment box, their
  avatar shows who they are and invites them to add a name ("You're Otter · add your name").
- Comments are **plain text** with line breaks and clickable links. No formatting, images or
  embedded content.
- The writer of a comment can **edit** or **delete** it; edits are marked as edited.
- On touch screens: tap chooses a block, long-press selects text, and the naming bar's Pin drops a pin.

**From the keyboard and with a screen reader**

- Turning comment mode on **from the keyboard** (the shortcut, or Start commenting chosen with the
  keyboard) starts the **block cursor**: an outline on the block that has focus, or else the first block
  in view. Mouse users never see it.
- While the block cursor is in use: **Tab** and **Shift+Tab** move between blocks at the same level as
  the current one, starting with the smallest blocks a click would choose; **↑** chooses the block
  around it and **↓** a block inside it, after which Tab moves between blocks at that new level, so no
  part of the page is skipped; **Enter** comments on the block, and **Shift+Enter** opens the comments
  already on it or inside it: the first in page order, then the next one with each press, saying which of
  how many it is ("Comment 1 of 3 on this block"), or "No comments on this block" when there are none. The naming bar's Around it and Inside it
  do the same as ↑ and ↓, for screen readers that keep the arrow keys for reading. ← and → are never
  taken.
- The block cursor tells screen readers what it is on: the kind of block, its place ("Paragraph, 3 of
  12"), how many comments are on it or inside it, and the block's own words. Pipeup never changes the
  page to do this.
- After a comment is sent or cancelled, the block cursor is back on the same block, so a reviewer can
  comment on block after block. Moving it closes an open thread, as a click elsewhere does.
- **Esc** steps back as with the mouse (a comment being written, then an open thread), then puts the
  block cursor away and gives Tab back to the page, with focus where it was before; one more Esc leaves
  comment mode. While the block cursor is put away, the comment mode shortcut brings it back; pressing
  the shortcut while it is in use leaves comment mode. How to move and how to leave are said when it starts.
- Words can be selected with the browser's caret browsing (F7) or a screen reader's own selection. The
  comment icon appears once the selection stops changing, and **Enter** comments on it. A mouse drag that is still going is not a settled selection, and selecting words
  while the block cursor is out puts it away.
- With the block cursor not in use, Enter on a focused page control does what the page expects, even when
  words are selected, and Enter in a page's form field submits the form. Moving the block cursor off the
  block a comment box is on leaves the box waiting there with its words; the cursor's keys move the cursor,
  and Enter returns to the box. Modifier+↑/↓ are left to the page.
- Resolving a thread returns focus to the block cursor, or to the Comment control when there is none; Send
  keeps focus in the reply line.
- Pins are dropped with the naming bar's Pin, at the centre of the block.

## 6. Commenting on slides

- Pins and comments belong to a slide; only the **current slide's** comments are shown, and they
  ease out and in as the slide changes. Pins keep their position relative to the slide when it is
  resized.
- Pipeup follows the deck on its own: the current slide is the marked slide that is showing. Decks
  built with a common framework are followed and driven without any code; any deck can also tell
  Pipeup how to go to a slide.
- Moving between slides is never blocked by Pipeup, including in comment mode, with one exception:
  while the keyboard's block cursor is in use, ↑ and ↓ choose the block around it and a block inside it,
  so decks that use ↑ and ↓ for vertical slides wait until it is put away (Esc). ← and → always reach
  the deck.
- The comment control's number counts the open threads **here** (on this slide); a small mark on the
  control shows when other slides have open threads, and its label says how many ("2 here · 5 on
  other slides").
- **All comments** groups threads by slide, in deck order ("Slide 3 · 2 open"), with this slide's
  group marked.
- Choosing a thread **navigates to its slide** and opens it there. If the deck can't be moved, the
  thread opens on its own in the panel with its snapshot. Build steps within a slide are not
  tracked.
- Text on a slide can also be selected and commented on, as in documents.

## 7. Reading, replying and managing comments

**When comments show**

- **Comments show only while you are reviewing**: in comment mode, while the All comments panel is
  open, and while a comment is being written. With comment mode off, highlights, bubbles, pins, the
  column and open threads are all out of sight; the comment control still shows the number of open
  threads. Pages open with comments hidden, since comment mode starts off.
- Choosing a thread from All comments shows the comments while the panel stays open. When the panel
  closes and comment mode is off, they hide again. (On narrow screens, where the panel steps aside
  to show the chosen thread, they stay shown until that thread is closed.)
- Showing and hiding **eases**; nothing snaps. With reduced motion they only fade.
- In comment mode, hovering a highlight previews its thread and clicking it opens the thread, rather
  than choosing the block, unless a comment is being written.

**What you see at rest — the words lead**

- On documents, threads sit in a **column beside the content, level with what they are about**.
  When threads would overlap they stack, and they glide when space changes.
- A thread at rest shows **the comment's words**, a faint reply count, and a small **avatar at the
  comment's top right** that never moves or narrows the words. No names, boxes or buttons.
- On slides and rich pages without a free column, element and pin comments show as **small
  bubbles**; hovering one shows a one-line preview, clicking opens the thread beside it.
- **Text comments have no bubble.** The soft highlight on the text is itself what you hover and
  click; its thread opens just below the line so the words stay visible.
- A hover preview **waits for you**: it stays open while the pointer moves from the highlight or
  bubble onto it, and for a short grace period after leaving, so it can be reached and clicked.
  Clicking the preview opens the thread.

**Hover shows more**

- Hovering a comment reveals **who wrote it, when, and its actions**, easing open **underneath**
  the words — never on top of them. These details **take no space until hovered**; nothing holds
  an empty row for them. Only real content, such as a reply count, shows at rest.
- Hovering a comment or its highlight gives the commented content **one slow, soft pulse**, so you
  can see what it belongs to; the two light up together.

**Opening a thread**

- Clicking a highlight, bubble, preview or thread opens it: it gains a thin line on its left (no
  background), lines up with its content, and other threads dim and step aside.
- Clicking again **never closes** a thread. An open thread closes with **Esc**, by clicking
  elsewhere on the page, or by opening another thread.
- An open thread always ends with a quiet **reply line**. **Opening a thread puts the cursor in its
  reply line**, so the reader can type a reply straight away; Esc still closes the thread. A new comment
  opens as a thread once sent, with the cursor in its reply line — or, when the keyboard's block cursor
  is in use, with focus back on the block cursor.
- Every thread can be opened from the keyboard: bubbles and threads at rest in the column are buttons,
  reached with Tab in the order they sit on the page, and text threads through All comments. Closing a
  thread with Esc gives focus back to what opened it (its bubble, its place in the column, its row in
  All comments, or the block cursor).

**Replies — one level, under the comment**

- Anyone can reply to a comment. Replies sit **indented beneath the original comment**, in the
  order they were sent.
- There is **no reply to a reply**: every reply is to the original comment, written in the reply
  line at the end of the thread.

**Actions** (shown on hover, as icons with names, right after who wrote it and when)

- **Copy** and **Resolve / Reopen** — on the thread. Copy takes the **whole thread** (see §7a);
  resolving fades the thread and its highlight away.
- The thread is answered from its reply line, which lines up with the indented replies. It is a
  plain line to write on, with no mark or placeholder before it: clicking anywhere on it puts the
  caret at the end of what is there, and on hover the line darkens slightly and shows a text
  cursor.

**The comment control**

- The comment control is **one round button** in a corner. It takes no extra space and never
  slides open.
  - With no open threads it shows the comment icon, Pipeup's mark, drawn in a thin line.
  - With open threads it shows **their number inside the comment bubble**, slightly larger.
  - Hovering it shows a **tooltip**: "Comment" and the shortcut.
- **Clicking it opens its menu**, which rises above the button. Each item is **one line**; what it
  does is explained in a **tooltip** that eases in after a short delay on hover or keyboard focus,
  never moves anything, and is read out by screen readers. From the top:
  - **who you are** — your avatar and name (your animal, such as "Red Fox", until you add one), with
    **Add name** or an edit mark at the end; choosing it turns that row into a name field in place
    (no separate box), with the cursor in it. **Enter** or leaving the field saves; **Esc** cancels
    and leaves the menu open; the row then shows the name and avatar again. The menu never closes
    while the name is being edited;
  - **Copy as Markdown** — every open thread as Markdown for AI, in order, with where each one is (§7a);
  - **Copy as Text** — the same threads as plain text: where it is, then just the names and
    words (§7a). Each copy row has a one-line tooltip. There is no copy-format setting;
  - **All comments**, with the number of open threads;
  - nearest the button, **Start commenting**, with its shortcut and a **switch** that shows whether
    comment mode is on. Toggling it starts or stops comment mode and **leaves the menu open**, so
    the switch is seen to move — except that turning it on from the keyboard closes the menu as the
    switch moves and puts the block cursor on the page (§5).
  - The comment control's name tells screen readers whether comment mode is on.
- The menu works from the keyboard (arrows, Home and End move; Enter chooses; Space toggles a
  switch; Esc closes the menu) and by touch
  with no hover needed. Switches ease between their states.
- Choosing a copy row or All comments closes the menu. Otherwise the menu closes on **Esc**, on a
  click or tap anywhere outside the menu and the button, or once the pointer has been away from
  both for **3 seconds** (coming back sooner keeps it open). On touch screens, where there is no
  hover, only a tap outside or Esc closes it. In comment mode, a click outside the menu only closes
  it: it doesn't choose a block, drop a pin or reach the page. The comment mode shortcut toggles comment mode
  without opening the menu; with the menu open it leaves the menu open.
- **All comments** opens a **panel on the right** listing every thread, including ones in hidden
  views and ones whose content is gone (§8), with each author's avatar.
  - The page **moves over to make room** for the panel, easing into the narrower space and back when
    the panel closes, so the panel covers none of the page's content (§9).
  - **Show resolved** is a small switch in the panel's header: it brings resolved threads back,
    muted, each with **Reopen**, in the panel and on the page.
  - Choosing a thread **reveals where it is**, scrolling to it and opening it, while the panel stays
    open, so a reviewer can step through comments.
  - The panel closes with its close button, Esc, or a click on the page.
  - On narrow screens the panel takes the full width, and choosing a thread closes it so the thread
    can be seen.
- **Every counted thread can be reached** through All comments, so a thread whose content is
  hidden, moved off screen or gone is never counted without a way to it.

## 7a. Copying comments for AI

- Copying a thread or copying all produces text an AI assistant can act on directly.
- **Copy as Markdown** and a thread's own copy button give **Markdown for AI** — a heading per thread and,
  for each one: where it is (slide or section, then the element), the element's stable identifier,
  the exact quoted text or pin position, who started it and when, then the comment and its replies
  as a list. Copy as Markdown adds the page title and address, the export time, the number of open threads
  (noting resolved ones are left out) and a one-line instruction to work through them and say what
  changed.
- **Copy as Text** gives **plain text** — where it is, then just the names and words.
- There is no copy-format setting.
- Resolved threads are left out of both copy rows.

## 8. Staying attached on changing pages

- When the page changes, every comment re-finds what it was attached to. Each comment is in one
  of three states, shown to the reader:
  - **Attached** — found where it was;
  - **Moved** — found nearby or after the content changed; flagged so someone can confirm;
  - **Orphaned** — its content is gone; the comment remains in the panel with a **snapshot** of
    what the reviewer was looking at.
- Every comment remembers the view it was made in: the slide, and whatever the page reports about
  itself (such as the open tab or route), with a readable name when the page gives one.
- Comments made in a view that is currently hidden (another tab, accordion, route or slide) show
  nothing on the page, are counted as elsewhere on the comment control, and are listed in All
  comments under where they live. Choosing one **reopens that view** when the page tells Pipeup how
  to do so, and opens the thread on its content; otherwise the thread opens on its own with its
  snapshot. Pipeup never opens tabs or accordions itself.
- A new comment with words in it whose slide or view goes away steps aside and keeps its words. Opening
  another thread, choosing one in All comments, or starting another comment then takes the reviewer back
  to it (when the page can go there) rather than dropping or hiding it.
- Comments on charts or other dynamic visuals record what the reviewer saw, including any state
  the page reports (for example, a chosen filter).
- When the author publishes a new version of the file, comments on text that changed are marked
  **Moved** rather than silently re-attached.

## 9. Fitting the page naturally

- With comments closed, Pipeup causes **no change to the page's layout** and **covers no
  content**, at phone, tablet and desktop widths. There is one exception: while the **All comments
  panel** is open on a screen wide enough for it to sit beside the page, the page moves over by the
  panel's width to make room, and eases back when it closes. Elements the page fixes to the window
  do not move with it. On narrow screens the panel covers the page instead.
- Pipeup picks its placement for the space available:
  - **Column** — on wide documents, threads sit in empty space beside the content;
  - **Drawer** — on narrow pages, threads live in a drawer that is closed by default;
  - **Bubbles** — on slides and rich pages, on the element or spot they belong to.
- **Documents designed for review** keep a **gutter on the right** for comments: the reading area
  stays centred in the space beside it, and threads sit in the gutter. When comments are hidden
  (comment mode is off), while the All comments panel makes its own room, or when there is no room
  for the column, the gutter closes and the content eases back to the true centre.
  This happens only on pages that reserve the gutter (§4); Pipeup never shifts a page that doesn't.
- Pipeup takes on the page's **fonts, accent colour, and light or dark appearance**, so it reads
  as part of the page.
- Pipeup never breaks the page's own behaviour, and the page's styles never break Pipeup.
- Pipeup is fully usable with a **keyboard and screen reader**: every way to start a comment (§5),
  every thread, the menu and All comments can be reached and used without a pointer; focus is never
  lost after sending, cancelling or closing; and screen readers are told which block a comment is
  being written on, when it changes, and when comment mode ends. Pipeup's focus marks stay visible in
  high-contrast (forced colours) modes.

**Motion — nothing switches on or off abruptly**

- Everything that appears, disappears, moves or resizes **eases**; nothing snaps or blinks.
- Outlines and bars **glide between targets** rather than vanishing and reappearing.
- Entrances ease out, movement eases in and out, with short durations and no overshoot or bounce.
- Pins settle into place; threads open smoothly and the ones around them shift to make room;
  counts roll; "typing" indicators breathe.
- Other people's cursors glide between updates instead of jumping.
- The one exception: anything the reviewer **drags** follows the pointer exactly.
- With **reduced motion** on, movement becomes soft cross-fades — still eased, never instant.

## 10. People and identity

- No accounts. Each reviewer is given an **animal in a colour**: one of 5 animals (Otter, Fox,
  Owl, Bear, Rabbit) in one of 10 colours (Red, Orange, Yellow, Green, Teal, Blue, Purple, Pink,
  Brown, Grey), so 50 combinations, named like "Red Fox" or "Blue Owl". It is shown as a
  **squircle avatar**: the animal drawn simply in its colour on a soft tint of that colour, never
  an emoji. The same reviewer is the same animal in the same colour everywhere they comment.
- A reviewer **may add a display name** at any time, from the avatar or the menu; their avatar then
  shows their initial. Until they do, they appear as their animal, including in copied comments.
- A reviewer's identity is **tied to their browser**. Their own comments are recognised as theirs
  so only they can edit or delete them.
- Nobody can post a comment that **appears to come from someone else**, even in a shared room.

## 11. Saving and sharing feedback

**On this machine (default)**

- Comments are saved automatically in the reviewer's browser and are there when they reopen the
  same document.
- Nothing is sent anywhere.

**Returning feedback (for now)**

- A reviewer sends feedback back to the author by pressing **Copy as Markdown** and sending what they copied
  any way they like: a message, an email, or pasted straight into a conversation with an AI
  assistant.
- **Sealed feedback files** remain part of the design for sharing later: a single small file of the
  reviewer's comments, encrypted for the document's audience when the page has a document identity
  (§4), mergeable by the author with duplicates shown once, and readable by Pipeup's command-line
  tool. They have **no controls in the page yet**: no Send feedback, no Add feedback, and dropping a
  file on the page does nothing.

**Shared rooms**

- An author can turn a document into a **room** on a relay they own. Everyone in the room sees
  comments appear as they are written, and comments persist while nobody is online.
- The author shares an **invite** — a link, or a code to enter on a page opened from disk.
  Only people with the invite can read or write.
- An author can choose for the invite to be **built into the file**, so anyone holding the file
  joins automatically, or to be **shared separately**, for sensitive documents.
- An author can **close a room** and start a new one to remove everyone's access.
- If the connection drops, a reviewer keeps working; their changes are sent when it returns.
- A room's comments can still be copied out at any time (and, once feedback files have controls,
  exported to one).

## 12. Presence (in rooms)

- Avatars show **who is here now**, and on decks, **which slide each person is on**.
- Live **cursors** and **"typing…"** indicators, which each person can turn off for themselves.
- A **follow** action jumps to the slide or place another person is looking at.
- Presence is never stored; it exists only while people are connected.

## 13. The relay

- An author can **create their own relay with one step** on a free hosting account they own.
  The first supported host is Cloudflare.
- Running a relay on a free account **never produces a bill**: when free limits are reached the
  relay stops accepting new data and says so, rather than charging.
- The relay enforces limits per room — size, rate of writes, number of people — and rooms that
  are inactive for a chosen period **expire** and are deleted.
- The author can list their rooms, see their size and last activity, and delete any room.
- The relay keeps **no record of comment content** in a readable form and keeps no logs of its
  own beyond what the host requires.
- The Pipeup project runs **no relay** in the first release.

## 14. Security and privacy

- **Nobody but the room's members can read comments**, including the relay operator and its
  hosting company.
- The relay and its host can see only **that a room exists, the size and timing of traffic and
  members' network addresses** — never comment text, names, cursors, quoted text or the document.
- **Comments cannot be forged or altered** by other members or by the relay. The relay can at
  most withhold or drop data; Pipeup shows when it can tell something is missing.
- Comment content can **never run as code** or change the page.
- Pipeup sends data **only** to the relay the author chose. It has **no analytics, tracking or
  telemetry**.
- Published builds are **verifiable**: an author can pin the exact version they tested, and the
  browser will refuse a build that has been tampered with.
- Access can be removed by **closing the room** (§11). Anyone who already had access can still
  read what they saw before; Pipeup says so plainly when a room is closed.

## 15. Agent support

- **Agent skills** ship with Pipeup and teach agents to:
  - add Pipeup to a document or deck so it looks native;
  - **create content ready for review**, with guidance for each kind of page — documents with a
    centred reading area and a reserved comment gutter, sites with stable, named blocks for comment
    mode, decks with marked slides — and when to use each of Pipeup's options;
  - run the **check** and fix what it reports;
  - **summarise** feedback by theme, section and status;
  - **reply to and resolve** threads, and **apply** approved changes to the page.
- **Check** loads a page with and without Pipeup and reports pass, warn or fail for:
  - any layout change caused by Pipeup;
  - closed Pipeup UI overlapping page content, at phone, tablet and desktop widths;
  - Pipeup UI overlapping the page's own controls;
  - blocks, charts and slides without stable identifiers;
  - colour contrast and keyboard reachability of Pipeup's UI.
- Check output is readable by people and parseable by agents, and the check fails clearly so an
  agent knows to keep fixing.
- Agents read comments a reviewer copied (Copy as Markdown); later they will also read and write feedback
  files and, with an invite, take part in rooms.

## 16. Distribution

- Published to **npm as `pipeup`** and served by **common public CDNs**, with every release at a
  fixed, permanent version.
- Each release says which version to pin and how to verify it.
- Pipeup is **as compact as possible**: it adds as little as it can to a page's download, every
  release states its size, and a release that grows past its size budget is not published.
- **Open source under the MIT licence.** The source, issues and releases are public on GitHub, and
  the website (with its Try pages and agent skills) is published alongside it.
- Versions follow semantic versioning. Until 1.0 the project is in **alpha**: the API and the stored
  format may change between minor versions, and each release says what changed.
- **Pre-releases** can be tried before a milestone reaches everyone: installed from npm and the CDNs
  by their exact version or a `next` tag, with their own copy of the website, Try pages and agent
  skills at a separate address, clearly marked as a pre-release and not indexed by search engines.
  A pre-release never changes what a plain install gets, the stable website or the stable CDN
  address.

## 17. Out of scope for the first release

- Standalone images and PDFs as review targets.
- Accounts, sign-in, email or push notifications, and @mentions.
- A relay run by the Pipeup project, and hosts other than Cloudflare.
- Peer-to-peer rooms without a relay.
- Rich text, attachments or reactions in comments.
- Drag-to-select an area as a comment target.
- Replies to a reply (every reply answers the original comment).
- Suggesting edits to the page text (tracked changes).

## 18. Release phases

1. **Comments on this machine** — documents, slides and rich pages; all ways to start a comment
   (§5); reading, replies, resolve and copy for AI (§7, §7a); anchoring (§8); placement and
   motion (§9); feedback files; check; agent skills. Private builds only.
2. **Rooms** — relay, invites, presence, live sync.
3. **Public release** — npm and CDN publication, verification guidance, open-source licence. The
   first public release (0.3.0) ships phase 1's comments on this machine, ahead of rooms.

## 19. Open questions

- How long inactive rooms live before expiring by default.

---

## Change log

- 2026-10-05 — First draft from the brainstorm: name chosen (Pipeup), sharing model chosen
  (feedback files plus an author-owned Cloudflare relay), security model and agent check defined.
- 2026-10-05 — Interaction design from the mock-up rounds: four ways to start a comment with an
  always-available text control; controls become targets in comment mode; words-first threads with
  hover details beneath, pulse connection, and a left line for the open thread; one-level threaded
  replies with a reply line at the bottom; icon actions (reply, copy thread, resolve); Show
  resolved; Copy all for AI as Markdown with locations, with a Copy as setting; motion rules.
- 2026-10-05 — Distribution: Pipeup must be as compact as possible, with a published size per
  release and a size budget that blocks oversized releases.
- 2026-10-05 — Phase 1 core built. Hardening from review: another member can no longer hide or
  replace someone's comment, and a malicious feedback file can no longer stop a document from
  accepting comments. No change to the functional requirements.
- 2026-10-05 — Renamed Earshot → Pipeup. npm refused `earshot` as too similar to `teashot`, and
  the `earshot` org was taken; the package `pipeup` and the org `@pipeup` are now claimed.
- 2026-10-05 — Plan 2A built: reading, replying and commenting on text, the column and bubbles, the comment control's menu and feedback files. Nothing appears, moves or disappears abruptly. Escape closes an open comment or the menu. Pipeup's controls stay readable on pages with aggressive styles. No change to requirements.
- 2026-10-05 — Plan 2A final review fixes: commenting is paused while comments are hidden (no comment icon appears); a first comment is posted even if the name cannot be remembered; highlights stay readable on dark pages; comments stay level with their text when images, fonts or collapsible sections change the page layout.
- 2026-10-06 — Review of the first UI: replies sit indented under the original comment, with no
  reply to a reply; hover previews wait for the pointer and can be clicked; clicking never toggles a
  thread closed (Esc or clicking elsewhere does); documents designed for review keep a centred
  reading area with a reserved comment gutter on the right, which pages opt into; agent skills give
  guidance for creating each kind of page and using Pipeup's options. Comment mode (blocks and
  pins) comes first in the next UI plan, so sites can be commented on beyond selected text.
- 2026-10-06 — Plan 2B built: comment mode (the comment control's Comment button or C; blocks with a naming
  bar and Parent; Option-click pins; nothing on the page fires, submits or navigates; ignored areas keep
  working); replies one level under the comment; hover previews that wait and open on click; clicking never
  closes a thread; the opt-in reserved gutter, which keeps the reading area centred and gives the column
  room only when the window is wide enough; clickable links in comments (web addresses only); the comment
  icon goes when the selection does; the control's menu works from the keyboard; bubbles and pins fade out
  as gently as they fade in. No change to requirements.
- 2026-10-06 — Plan 2B final review fixes: a preview lets go when the pointer leaves through Pipeup's own
  controls; text inside page wrappers (such as a skip-link target, an open question or a label) can be
  selected in comment mode; leaving comment mode fades the outline and naming bar out; closed comments, the
  closed menu and hidden previews are out of the keyboard's reach, so nothing can be typed into a comment
  that isn't showing; a block's name keeps the start of its words, cut short when long; the pin hint names
  Alt for keyboards without Option. Not built yet: using comment mode from the keyboard (§5: Tab between
  blocks, ↑ parent, ↓ child, Enter to comment) — blocks and pins are mouse-only for now. No change to
  requirements.
- 2026-10-06 — Review of comment mode: the comment control shows only its icon until hovered; the
  shortcut is ⌥⌘C on a Mac and Ctrl+Alt+C elsewhere (the single C key clashed with page shortcuts,
  and ⇧⌘C is the browser's inspect shortcut); the naming bar's "Parent" becomes an expand icon with
  a tooltip; comment mode shows a picking cursor.
- 2026-10-06 — Comment mode shortcut changed to ⇧⌥C on a Mac and Shift+Alt+C elsewhere: ⌥⌘C opens
  the browser's inspector in Chrome, Edge and Firefox on a Mac.
- 2026-10-06 — A name is no longer asked for before the first comment: each reviewer is one of 25
  animals with a squircle avatar and can add a name whenever they like. Avatars sit at each
  comment's top right without moving its words. The send icon is a right-pointing paper plane.
- 2026-10-06 — In comment mode, clicking a block opens the comment box straight away; the naming
  bar's expand icon moves that comment to the surrounding block, keeping what was typed.
- 2026-10-06 — The comment control hides its number when there are no open threads; the number opens All comments, so every counted thread can be reached (a thread whose content was gone could be counted but not opened on rich pages).
- 2026-10-06 — The comment control is one round button: its number sits inside the comment bubble, a tooltip names it and its shortcut, and a click opens its menu with Comment nearest the button. All comments is a panel on the right that stays open while choosing a thread reveals it.
- 2026-10-06 — Five animals instead of 25 (Otter, Fox, Owl, Bear, Rabbit), to keep Pipeup small.
- 2026-10-06 — Reviewers are an animal in a colour (5 animals × 10 colours = 50, e.g. "Red Fox"), shown in that colour.
- 2026-10-06 — Polish: All comments has its own icon; on narrow screens the panel takes the full width and closes when a thread is chosen; a click on the page that closes the panel gives focus back to the comment control. `animalName` now returns "<Colour> <Animal>" (for example "Red Fox") as a string, and an avatar's `data-animal` holds that full name.
- 2026-10-06 — The reply line is a plain line, with no reply mark: a click anywhere on it puts the caret at the end, and it darkens on hover. The comment control's bubble is drawn with a thinner line, its number in medium weight.
- 2026-10-06 — The comment control's menu is simpler: one line per row with tooltips, your identity at the top, a copy-format button on Copy all, and Start commenting as a switch nearest the button. Comments show only in comment mode, while All comments is open, or while a comment is being written; there is no Hide comments, and selecting text offers commenting only in comment mode. Show resolved is a switch in the All comments panel, and the open panel moves the page over to make room (the one exception to never moving the page).
- 2026-10-06 — Opening a thread puts the cursor in its reply line.
- 2026-10-06 — Simplified copying and feedback: the menu has two plain rows, Copy all (Markdown for AI) and Copy all as text, with no copy-format setting and no `copyAs` option; Send feedback and Add feedback and dropping files are removed for now (feedback comes back by copying it), with sealed feedback files kept in the design for sharing later.
- 2026-10-06 — First public release prepared (0.3.0, alpha): open source under MIT, published on npm and public CDNs, with the website, Try pages and agent skills at a public address and a link to the source from the site. Phase 1's comments on this machine ship before rooms. The licence question is closed. Sample names in examples and tests are fictional.
- 2026-10-06 — Pre-releases: tried by exact version or the `next` tag, with their own marked copy of the website at a separate address; stable installs and the stable site are never changed by one.
- 2026-10-06 — Menu and picking fixes: the copy rows are named Copy as Markdown and Copy as Text; toggling Start commenting leaves the menu open, which closes on Esc, a click outside, or after the pointer has been away for 3 seconds; your name is edited in its own row, in place; no block is outlined while text is selected in comment mode; picking also finds page sections, lists, elements with accessible roles and boxes that lay out several things, and the website's showcase is commented on as one whole block.
- 2026-10-07 — Slides and hidden views (0.4): Pipeup follows the current slide by itself (frameworks and a deck's own hook can drive it); threads are here or elsewhere, the control counts those here and marks those elsewhere, All comments groups by slide or view, and choosing a thread elsewhere goes there first. Comments remember their view. Build steps are not tracked.
- 2026-10-07 — A new comment with words that stepped aside with its slide or view is returned to, not lost, when the reviewer opens or starts something else.
- 2026-10-07 — Keyboard and screen readers (0.4, part 2, step 1): turning comment mode on from the keyboard
  starts a block cursor — Tab between blocks at one level, ↑ and ↓ to the block around or inside, Enter to
  comment, Esc to put it away and then to leave — that tells screen readers what it is on and comes back
  to the same block after each comment. The naming bar gains Inside it and Pin; pins no longer use a
  two-finger tap (it opens links in a new tab, right-clicks on trackpads and pauses screen readers).
  Vertical slides wait while the block cursor is in use. Words selected with caret browsing or a screen
  reader can be commented on with Enter. Every thread can be opened from the keyboard, Esc returns focus to
  what opened it, and the comment control says when comment mode is on. Turning comment mode on from the
  keyboard closes the menu.
- 2026-10-07 — Keyboard follow-ups: Shift+Enter on the block cursor opens the block's comments one at a time
  in page order (or says there are none); the comment mode shortcut brings a put-away block cursor back and
  leaves comment mode when it is in use; with the block cursor not in use, Enter and Space on the page's own
  controls do what the page expects (clicks and taps are still only for commenting).
- 2026-10-07 — The keyboard and screen-reader block cursor is built. The page never hears the keys the cursor
  takes; Tab and the arrows never land on removed blocks; the shortcut leaves the menu open and, with nothing
  to land on, leaves comment mode; Resolve returns focus to the cursor (or the Comment control). Selecting words
  while the block cursor is out puts it away, so the words' comment icon shows. After Esc puts the block cursor
  away, the next Tab continues from where the cursor was, so it may reach Pipeup's own controls before the
  page's.
- 2026-10-07 — Keyboard review fixes: Enter in a page's form field submits the form while the block cursor
  isn't in use; moving the block cursor off a comment box's block leaves the box waiting; All comments and
  Copy use the same page order as the comments on the page.
