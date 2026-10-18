# Pipeup — Functional Specification

**Status:** Draft for review
**Owner:** Pipeup maintainers
**Last updated:** 2026-10-08 (add-ons built)

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

- **The page stays the author's.** Pipeup never changes how the page behaves outside comment mode,
  never changes how it looks when comments are hidden, and never covers its content.
- **Private by default.** Without any setup, comments stay on the reviewer's own machine. Pipeup itself
  never sends anything anywhere. Only add-ons the author chooses to include can send anything, and each
  one says what it sends.
- **No service to run.** Pipeup works without any server operated by the Pipeup project. Authors who
  want shared or live comments include an add-on that uses a free service they pick, or later a relay
  they own.
- **Untrusted services.** No service that carries comments can read or forge them. That covers a free
  sharing service, a meeting point between reviewers, and a relay and its hosting company.
- **Agent-ready.** Agents can add Pipeup to a page, verify they did it well, and read and act on
  the feedback.

> *Pipe up, right where the work is.*

## 2. Audiences and primary scenarios

**Authors** (people, or agents acting for them)

1. *I made an HTML deck and want feedback.* I add Pipeup to it, send the file or link, and get
   comments pinned to the exact slide and spot.
2. *Several people reviewed my file separately.* Each copies their comments (Copy comments › As Markdown) and sends
   them to me; I paste them into my AI agent, which knows exactly where each comment is.
3. *I want a live review session.* I create a room on my own relay, share an invite link, and
   everyone sees who is here, which slide they are on and where their cursor is.
4. *My page changed since people commented.* Comments follow the content they were about; the
   ones that can't are clearly flagged instead of landing in the wrong place.

**Reviewers**

5. *Someone sent me an HTML file.* I open it, choose "Comment", select a sentence and type. I
   don't need an account.
6. *I'm reviewing a deck.* I click anywhere on a slide to drop a pin and comment, Figma style.
7. *I'm done.* I press "Copy comments › As Markdown" and send what I copied back however I like — or, in a
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
- An author can add **optional features as add-ons**: shared comments, live review and dictation. Each
  add-on is one more line in the page, and the lines work in any order. Pipeup and its add-ons can
  also be included as **one combined file**, which can sit inside the page.
- Add-ons work whether the page is opened from disk, served locally or hosted on the web.
- A page without add-ons works exactly as before. It pays only for the small add-on support built into
  Pipeup.
- If Pipeup is included twice on one page, it runs once and the check reports the mistake.
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
| **Text** | In comment mode, select words. A small comment control eases in beside them. | Wording, specific claims |
| **Block** | In comment mode, hover: an outline glides to the most obvious thing under the pointer — a paragraph, card, image, table, chart or a single button. Click it and the comment box opens straight away. | Whole elements, including controls |
| **Pin** | In comment mode, Option-click an exact spot, or choose a block and press **Pin** on its naming bar. | Slides, charts, canvases, designs |
| **General** | Comment on the page or slide as a whole. | Overall reactions |

- **Selecting text offers commenting only in comment mode.** Outside it, selecting text offers
  nothing and the page behaves as normal. The control is a single comment icon, just past the end of
  the paragraph's text, level with the selection's last line. It never covers the selection or the words
  around it, such as a headline's line above; where there's no room beside the text it sits above the
  selection (below it at the top of the window).
- **Comment mode** is switched on and off from the comment control or with **⇧⌥C** on a Mac
  (**Shift+Alt+C** elsewhere) — a shortcut chosen not to clash with common browser and page
  shortcuts. **Esc** steps back out of it. Outside comment mode the page behaves exactly as normal.
- In comment mode the pointer becomes a **picking cursor** (an arrow over a dashed box, like a
  browser's element picker), except over areas the author marked to ignore.
- In comment mode, **links, buttons, toggles, menus and form fields become things to comment on**
  instead of things that act. Nothing on the page fires, submits or navigates when clicked or tapped.
  From the keyboard, while the block cursor (below) is not in use, Enter and Space on a focused control
  of the page do what the page expects, and Pipeup does nothing with them.
- **Holding Space pauses comment mode** for as long as it is held, on every platform. The outline and the
  picking cursor go and the page works as normal, so a reviewer can click through it to reach what they
  want to comment on. Letting go brings comment mode back as it was. Comment mode's hint says so. Space is
  the key because it changes nothing about a click (⌘, Ctrl, Shift and Option all make a click on a link do
  something else, such as open a new tab or download it). While Space is held the page doesn't hear it, so it
  doesn't scroll or turn a slide. Space keeps its usual job where it has one: typing in a field, and a link,
  button or other control reached from the keyboard (one that only has focus because it was clicked doesn't
  keep it). On the block cursor, Enter comments and Space pauses.
- **A click made while Space is held is the page's alone.** Pipeup never undoes what it did (such as switching a
  tab) and never counts it as a click elsewhere, and a click that started while paused finishes paused even if
  Space is let go first (one that started unpaused stays Pipeup's). Enter in a page's field after such a click
  submits the form, as the page expects.
- **Clicking a block opens the comment box at once** — no second click. A small bar above it names
  the block by what it is and its own words ("Button · Start free trial", "Checkbox · Email me updates",
  "Dropdown · Monthly"; a block with no words is a "Bar" or a "Shape") and offers three icons, each named on hover and to screen
  readers: **Around it** moves the comment to the block around it, **Inside it** to a block inside it,
  both keeping anything already typed, and **Pin** turns it into a pin at the block's centre (on touch
  screens, at the next spot tapped). The bar uses icons, not words. It never covers the block it names; where
  it has to sit over the page's words next to it, it fades while the pointer is over them.
- Clicking another block while the comment box is empty moves the box there, with the cursor in it.
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
  selection is cleared or its comment is started or cancelled. Double- or triple-clicking words selects them
  without choosing the block they are in, and Esc with words selected clears the selection first.
- Areas the author marked to ignore (navigation chrome, slide controls) are never targets and keep
  working in comment mode.
- Writing a comment: the box starts with who you are, then a line that says **"Comment or add others
  with @"**. **Cancel** and **Comment** buttons sit beneath it while you write. **Enter** also sends,
  **Shift+Enter** starts a new line and **Esc** cancels. Comment stays grey until there are words.
- **Typed words are never lost unless the reviewer chooses it.** Clicking or tapping elsewhere, moving to
  another block, opening All comments, resizing the window and the slide changing all keep what is typed in a
  comment or reply box. Only **Cancel**, or **Esc** in the box itself, throws words away, and then a message
  offers **Undo** for a few seconds, which brings the box back where it was with the words in it. **⌘Z** (Ctrl+Z)
  takes the Undo too, from anywhere but a field with words in it, so it can be reached from the block cursor;
  once the message has faded, its Undo is gone. Esc while an input method is still composing (Japanese, Chinese,
  Korean) only cancels the composition. On a deck, Tab or a click on nothing in particular leaves a waiting box
  where it is, on its own slide.
- **A name is never required.** A reviewer can comment straight away. At the top of the comment box,
  their avatar and name show who they are and invite them to add a name ("You're Otter · add your name").
- Comments are **plain text** with line breaks and clickable links. No formatting, images or
  embedded content.
- The writer of a comment can **edit** or **delete** it from the comment's **⋯** menu. Editing puts the
  words back in a box with **Cancel** and **Save**; edits are marked as edited. Delete asks once more
  before it deletes, and that second question can't be answered by the same double-click or double tap that
  asked it. **A deleted comment goes away**: nothing is left in its place, and deleting a thread's
  first comment removes the whole thread, replies and all.
- On touch screens: tap chooses a block, long-press selects text, and the naming bar's **Pin** waits for the
  next tap and drops the pin there. A tap on the page's blank space closes an empty comment box, as a click
  does. The selection's comment icon sits below the selection, clear of the phone's own selection menu.
- **On a touch screen everything Pipeup puts on the page is at least 44 px across**, for a finger: bubbles, the
  naming bar's icons, the selection's icon, a card's actions, menu rows, switches and close buttons. Bubbles,
  the naming bar, comment boxes and threads always fit the screen: the naming bar's words shorten before its
  icons go, and nothing sits under the comment control.
- **Comment mode on a touch screen says how to use it by touch** ("Tap what you want to comment on"), not the
  keyboard and mouse hints. Its hint stays beside the comment control while comment mode is on, with
  **Done**, which leaves comment mode in one tap. Only Done takes a tap: what is under the hint's words can
  still be tapped. A screen with only touch shows no keyboard shortcuts, in the menu or the panel's footer.

**From the keyboard and with a screen reader**

- Turning comment mode on **from the keyboard** (the shortcut, or Start commenting chosen with the
  keyboard) starts the **block cursor**: an outline on the block that has focus, or else the first block
  in view. Mouse users never see it until they press Tab.
- The block cursor only stops on blocks a reviewer can see and click: never on what is hidden, see-through,
  clipped out of view, hidden from screen readers, or set not to respond to the pointer (such as a
  moving demo); never on icons and other parts inside a link or button (the link or button is the stop);
  and never on words styled inside a line of text (keys, code, emphasis), or on tiny decorations, unless
  the author marked them with a stable identifier.
- **In comment mode, Tab and Shift+Tab always move between blocks**, however comment mode was turned on.
  With the block cursor not out (comment mode turned on with the mouse, or after a click, a selection or
  a mouse move took over), the first Tab starts it after the block last clicked, commented on or
  outlined under the pointer, and Shift+Tab before it; with none of those, both start on the first block
  in view. This holds from the page and from the Comment control and its menu (the menu closes). Inside
  a thread, the name field and All comments, Tab moves through their own buttons as usual.
- **From a comment box, Tab moves on.** From an empty box, Tab and Shift+Tab close it and move the block
  cursor to the next or previous block in one press: Enter sends and Esc cancels, so its buttons need no stop.
  From a box with words, Tab and Shift+Tab go through the box's own controls (add your name, Cancel,
  Comment) and then on to the next or previous block. The naming bar, bubbles and the comment control are not
  stops on the way, and Tab never leaves a comment box for the page.
  Tab never reaches the page's own links and fields in comment mode; turning comment mode off gives them
  back. The mouse hint says Tab moves between blocks.
- Moving the mouse onto another block while the block cursor is out hands the outline to the mouse; the
  next Tab carries on from the block under it.
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
- **Esc** steps back as with the mouse (a comment being written, then an open thread), then leaves
  comment mode, with focus back where it was before the block cursor started (the Comment control when
  that was nowhere on the page). Esc always gets a keyboard user out. Esc only steps back from what has focus:
  on the block cursor, a bubble or the naming bar it never throws away a waiting comment's words. After a click, a selection or a
  mouse move took the block cursor's place, the comment mode shortcut brings it back; otherwise the
  shortcut leaves comment mode. How to move, how to pause (holding Space) and how to leave are said when it
  starts.
- Words can be selected with the browser's caret browsing (F7) or a screen reader's own selection. The
  comment icon appears once the selection stops changing, and **Enter** comments on it. A mouse drag that is still going is not a settled selection, and selecting words
  while the block cursor is out puts it away.
- With the block cursor not in use, Enter on a focused page control does what the page expects, even when
  words are selected, and Enter in a page's form field submits the form. Moving the block cursor off the
  block a comment box is on leaves the box **waiting** there with its words: it stays beside its block,
  dimmed, and the block keeps a faint outline, so it is always clear where the comment will go. The cursor's
  keys move the cursor. Enter on another block, a click on another block, or Enter on a bubble takes the
  reviewer back to the waiting box: its block is outlined and named again, the page scrolls to it when it is
  out of view, focus is in the box, and Pipeup says "Finish or cancel this comment first". When the box is on
  another slide of a deck Pipeup can't turn, nothing of it is drawn over the slide showing, and Pipeup says which
  slide it is on ("Finish or cancel your comment on slide 1 first"). Modifier+↑/↓ are left to the page.
- **Keys Pipeup acts on stay with Pipeup.** Keys used in its menus, its panel, a card, a box or the block
  cursor never also reach the page, pressed or let go, so a deck never turns a slide because of them; keys
  Pipeup doesn't use always reach the page. The Esc that leaves comment mode is Pipeup's too.
- **Focus never drops to the page.** Resolving or deleting a thread returns focus to the block cursor when it is
  out; otherwise to the next thread where it was (the next card in the column or in All comments), or the
  Comment control when there is none. After React, choosing an emoji, Edit (saved or cancelled) and deleting
  a reply, focus stays on the same card. Send keeps focus in the reply line.
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
  so decks that use ↑ and ↓ for vertical slides wait while it is out (a click hands them back). ← and →
  always reach the deck.
- **A deck's own controls keep working in comment mode** (its arrows, progress bar and slide number) without
  the author marking them, as areas marked to ignore do.
- **Any slide that is showing can be commented on**, including slides scrolled into view on a deck that
  scrolls; the block cursor starts on what is in view.
- A comment being written on a slide that goes away leaves nothing drawn over the next slide: it steps aside
  with its words (§8), and comment mode carries on.
- **On a deck that fits itself to the window**, opening All comments makes the deck refit into the space
  beside the panel, and closing it gives the space back, even when the page sets its own width. Where a deck
  keeps its own controls in the bottom-right corner (a slide number, arrows), the comment control sits just
  above them, and stays in the corner in fullscreen, in a page's dialog and beside a layer over the window. A
  deck shown fullscreen can't be made smaller: All comments sits over its right side.
- On reveal.js, a comment is filed under the slide its content is on, and the block cursor leaves a slide as
  the deck turns, even while it is still sliding away.
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

- **Comments show whether comment mode is on or off.** Highlights, bubbles, pins and the column can be
  read, hovered and opened. Outside comment mode the rest of the page behaves as normal. Pages open with
  comments showing.
- **Hide comments** in the comment control's menu puts them out of sight until it is turned off. Highlights, bubbles,
  pins, the column and open threads all go; the comment control still shows the number of open threads.
  The choice is remembered for that page in this browser. Comment mode, the All comments panel and a
  comment being written still show the comments while they last, and the comments hide again when they end.
- Showing and hiding **eases**; nothing snaps. With reduced motion they only fade.
- Hovering a highlight previews its thread and clicking it opens the thread, unless a comment is being
  written. In comment mode that click opens the thread instead of choosing the block. Outside comment mode,
  a highlight on one of the page's links or controls leaves the click to the page.

**What you see at rest — compact cards**

- On documents, threads sit in a **column beside the content, level with what they are about**.
  When threads would overlap they stack, and they glide when space changes.
- Each thread is a **compact card**: the writer's avatar and name, **how long ago** it was written (just
  now, 5m ago, 2h ago, with the exact time on hover), the comment's words, and its reply count. Cards are
  close to the comment cards people know from other editors, with less padding.
- **A long comment shows its first few lines at rest**, ending with **more**; the open thread shows all of it,
  so one long comment never pushes the others out of reach.
- **The same card is used everywhere a thread shows**: in the column, beside a bubble, in All comments
  and in the drawer. In All comments the card also shows the words it is about; beside the page it sits
  level with them instead.
- On slides and rich pages without a free column, element and pin comments show as **small
  bubbles**; hovering one shows a one-line preview, clicking opens the thread beside it. Where there's
  no room beside it (on a phone, or near the window's edge), the preview and the thread sit **below what
  they're about, or above it, never over it**, and always on screen. Bubbles themselves are always wholly on
  screen, and threads on the same element each have their own bubble, never one on top of another. Turning a
  phone (or resizing the window) with a thread or new comment open brings what it is about back into view.
- **Text comments have no bubble.** The soft highlight on the text is itself what you hover and
  click; its thread opens just below the line so the words stay visible.
- A hover preview **waits for you**: it stays open while the pointer moves from the highlight or
  bubble onto it, and for a short grace period after leaving, so it can be reached and clicked.
  Clicking the preview opens the thread.

**Hover shows more**

- Hovering a card shows its **actions** at its top right; the open card always shows them. Nothing
  opens beneath the words or moves them.
- Hovering a comment or its highlight gives the commented content **one slow, soft pulse**, so you
  can see what it belongs to; the two light up together. The pulse stays on its content if the page scrolls
  meanwhile (as it does when a thread is opened from All comments).

**Opening a thread**

- Clicking a highlight, bubble, preview or card opens it: the card lifts slightly with a soft shadow,
  lines up with its content, and other threads dim and step aside.
- An open card, a new comment or a thread beside a bubble is **never under the comment control**, in the
  column or on a phone: when it would reach the control's corner, it moves up just enough to clear it, so its
  buttons can always be pressed. A new comment's box and buttons are always in the window, even on a page's
  last lines.
- Clicking again **never closes** a thread. An open thread closes with **Esc**, by clicking
  elsewhere on the page, or by opening another thread. **A reply being written is kept** when its thread
  closes, however it closes, and is back in its reply box when the thread opens again, until it is sent,
  cancelled or thrown away with Esc (§5), in All comments too: when its card closes, when another card opens, and
  when a thread open on the page moves into the panel. Esc in a reply box with words throws them away first (with
  Undo), in All comments as anywhere; the next Esc closes the thread. Opening All comments while writing a comment
  moves the box into the panel with the caret still in it. After Copy thread, focus stays on the comment's ⋯.
- An open thread always ends with a **reply box** ("Reply or add others with @"), with **Cancel** and
  **Reply** beneath it while you write. **Opening a thread puts the cursor in its reply box**, so the reader can type a reply straight away; Esc still closes the thread. On touch screens the reply box waits to be tapped, so the keyboard doesn't cover a thread opened just to read it. A new comment
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

**Actions** (icons with names at the card's top right, on hover and on the open card)

- **React**, **✓ Resolve** (or **Reopen**) and **⋯**, which holds **Copy thread** and, on your own
  comments, **Edit** and **Delete**. Replies have React and ⋯. Copy takes the **whole thread** (see §7a);
  resolving fades the thread and its highlight away.
- A card's actions can only be pressed while they show: on touch screens, the first tap on a closed card opens
  it. After Resolve, the card that moves into its place shows its actions only once the pointer moves, so a
  second click never resolves a different thread. React's quick row closes when its thread does.
- The **⋯** menu works from the keyboard like the comment control's menu (arrows move, Enter chooses), and Esc
  closes it before the thread.
- The thread is answered from its reply box, which lines up with the indented replies. Clicking
  anywhere on it puts the caret at the end of what is there.

**The comment control**

- The comment control is **one small square of frosted glass tucked into the page's bottom-right corner**:
  flush with the window's right and bottom edges, only its top-left corner rounded, with no border. What is
  behind it shows through, softened, so it covers as little of the page as it can. It is 32 px across (44 on
  touch screens, for fingers).
  - With no open threads it shows the comment icon, Pipeup's mark, drawn in a thin line.
  - With open threads it shows **their number inside the comment bubble**, which nearly fills the square: up to 9,
    then **9+**, so it is never more than two characters and fits in any font. The exact number is in its name for
    screen readers and in what it shows when pointed at.
  - In comment mode the glass turns the accent colour.
  - **Pointed at, it reaches left** after a moment, just far enough to show its shortcut (and anything an
    add-on says, such as who else is here, and the exact number when the bubble says 9+), opening and folding evenly; it folds back as soon as the pointer
    leaves, and while the menu is open. The control itself never moves. Its name, state and shortcut are read
    out by screen readers, and the menu shows the shortcut beside Start commenting.
- **While All comments is open, the comment control becomes the panel's footer**: your avatar and name,
  **Comment** with its shortcut and a switch, and **⋯** for the rest of the menu. Closing the panel draws
  the footer back into the control. Both shapes ease into each other.
- **Pipeup's short messages** (someone mentioned you, comment mode's hint, "Resolved", and the like)
  appear **beside the comment control**, never at the bottom centre where decks keep their slide controls and
  phones show the page's last lines. While All comments is open they sit inside the panel, above its footer, so
  they never cover the page beside it (nor a deck's own slide controls there). Nothing of Pipeup's covers a message: comment mode's hint waits
  until the menu has closed, then shows for its usual time.
- **In comment mode, clicking it opens All comments**, where the panel's footer holds comment mode's switch and
  **⋯** for the rest of the menu.
- **Otherwise, clicking it opens its menu**, which rises above the control. Each item is **one line**; what it
  does is explained in a **tooltip** that eases in after a short delay on hover or keyboard focus,
  never moves anything, and is read out by screen readers. From the top:
  - **who you are** — your avatar and name (your animal, such as "Red Fox", until you add one), with
    **Add name** or an edit mark at the end; choosing it turns that row into a name field in place
    (no separate box), with the cursor in it. **Enter** or leaving the field saves; **Esc** cancels
    and leaves the menu open; the row then shows the name and avatar again. The menu never closes
    while the name is being edited;
  - **Copy comments**, one row that opens to its two choices beneath it (a second click, or → from the
    keyboard; ←, Esc or a second click folds them away). **As Markdown** copies every open thread as Markdown for
    AI, in order, with where each one is (§7a); **As text** copies the same threads as plain text: where it is,
    then just the names and words (§7a). Each has a one-line tooltip, and the choices are folded each time the
    menu opens. There is no copy-format setting;
  - **Theme**, showing Automatic, Light or Dark; each press moves on to the next, and the menu stays open so
    the page is seen to change (*Which look*, §9);
  - **All comments**, with the number of open threads;
  - **Hide comments**, with a **switch**. When it is on, comments are out of sight (*When comments
    show*, above). Toggling it leaves the menu open, so the switch is seen to move;
  - nearest the button, **Start commenting**, with its shortcut and a **switch** that shows whether
    comment mode is on. Toggling it starts or stops comment mode and **leaves the menu open**, so
    the switch is seen to move — except that turning it on from the keyboard closes the menu as the
    switch moves and puts the block cursor on the page (§5).
  - The comment control's name tells screen readers whether comment mode is on.
- The menu works from the keyboard (arrows, Home and End move; Enter chooses; Space toggles a
  switch; Esc closes the menu), however it was opened, and by touch
  with no hover needed. Switches ease between their states. The menu always fits in the window; where it
  can't (a phone on its side, a page zoomed far in), it scrolls.
- Choosing a copy choice or All comments closes the menu. Otherwise the menu closes on **Esc**, on a
  click or tap anywhere outside the menu and the button, or once the pointer has been away from
  both for **3 seconds** (coming back sooner keeps it open). On touch screens, where there is no
  hover, only a tap outside or Esc closes it. In comment mode, a click outside the menu only closes
  it: it doesn't choose a block, drop a pin or reach the page. The comment mode shortcut toggles comment mode
  without opening the menu; with the menu open it leaves the menu open.
- **All comments** opens a **panel on the right** listing every thread, including ones in hidden
  views and ones whose content is gone (§8), with each author's avatar.
  - The page **moves over to make room** for the panel, easing into the narrower space and back when
    the panel closes, so the panel covers none of the page's content (§9).
  - The panel has no title. Its top line holds two **filters** and the close button. Each filter is a small
    pill with an icon and a word, so it reads as something that is on or off: **@ For you** shows only
    comments that mention me ("No comments mention you" when there are none), and **✓ Resolved** brings
    resolved threads back, muted, each with **Reopen**, in the panel and on the page. Both always show,
    whether or not there are any yet, and each has a **tooltip** that says what it does, easing in on hover
    and keyboard focus. Clicking a filter turns it on; clicking again turns it off. Off, it is grey words and
    icon with nothing behind them; on, it is filled with a soft tint of the accent colour, its words and icon
    in the accent colour, like a chosen filter in a mail or document app. Hovering an off filter shows a
    light fill, and every change between the states eases. Screen readers hear each filter's word and
    whether it is on. The light and dark looks both show the two states plainly. Nothing in the panel wraps
    onto a second line, at the panel's width or across a narrow screen.
  - Each thread is a **card** (§7, *compact cards*), with the words it is about. Choosing a card **opens it
    out in place**: its top line, the words it is about (once), its comments and replies, its actions and its
    reply box, all usable there. Clicking its top line closes it again. Nothing opens on the page.
  - **Hovering a closed card shows its actions** at its top right, as on any card (*Actions*, above), and so
    does moving keyboard focus into it: **React**, **✓ Resolve** (**Reopen** on a resolved thread) and **⋯**,
    with Copy thread, and Edit and Delete on your own comment. They work as they do on the open card, and
    using one never opens or closes the card: Resolve resolves the thread, which eases out of the list unless
    resolved threads are shown; React's quick row and Edit's box open inside the closed card. The actions
    ease in and out, and the card neither moves nor changes size when they appear. On touch screens, which
    have no hover, a closed card shows no actions; opening it shows them.
  - **A thread is never open in two places.** One open on the page when the panel opens moves into the panel,
    open there with the cursor in its reply box; while the panel is open, nothing opens beside the page.
  - **New comments are written in the panel while it is open.** Turning comment mode on leaves the panel
    open; choosing something on the page then adds a new card to the list where it falls in page order,
    joined to its place by the same line as an open thread. Sending turns it into a thread there.
  - Choosing a row also **reveals where the thread is**: the page scrolls to it, its words are marked,
    and a thin line eases in from the open row to that place, following scrolling, until the row is
    closed. Threads with no place to point at (content gone, or on another slide or view) open the
    same way with no line, and say where they are.
  - One thread is open at a time. Choosing another closes the first; choosing the open row, or Esc,
    closes it. A thread resolved while open stays open to be reopened, and goes when closed unless
    ✓ Resolved is on.
  - **The panel stays open until it is closed**, with its close button or Esc (after any open thread). A
    click on the page never closes it: in comment mode that click chooses something to comment on, and
    otherwise the page handles it.
    A click on a comment on the page (its highlighted words, bubble, pin or column thread) doesn't count as
    a click on the page: it opens that thread in the panel, as choosing its row does, and the panel stays open.
  - On narrow screens the panel takes the full width and opens threads out the same way, with no line. There,
    an open card keeps the words it is about and where it is, since the page can't be seen beside it.
  - From the keyboard, the panel's filters and close button come first, then its cards, then its footer.
    Screen readers hear the panel as a list of comments under a heading.
- **Every counted thread can be reached** through All comments, so a thread whose content is
  hidden, moved off screen or gone is never counted without a way to it.

## 7a. Copying comments for AI

- Copying a thread or copying all produces text an AI assistant can act on directly.
- **Copy comments › As Markdown** and a thread's own copy button give **Markdown for AI** — a heading per thread and,
  for each one: where it is (slide or section, then the element), the element's stable identifier,
  the exact quoted text or pin position, who started it and when, then the comment and its replies
  as a list. Copying all comments as Markdown adds the page title and address, the export time, the number of open threads
  (noting resolved ones are left out) and a one-line instruction to work through them and say what
  changed.
- **Copy comments › As text** gives **plain text** — where it is, then just the names and words.
- Where a thread is and the words it quotes are copied the same whether or not its slide or view is showing.
- There is no copy-format setting.
- Resolved threads are left out of both copy choices.

## 7b. Reactions

*Built (0.7).* The quick row opens inline under the comment, and the full picker is the `emoji` add-on.

- A reviewer can **react to any comment or reply with a standard emoji**, the same ones as on a phone.
  A reaction is a quick answer that needs no words ("seen", "agree", "thanks").
- **A reviewer has at most one reaction of each emoji on a comment.** Choosing it again takes it back.
  They can give several different emoji to the same comment.
- **Choosing an emoji:** a short row of common reactions (👍 ❤️ 😂 🎉 😮 🙏) is always offered. A "more"
  button opens the full standard set, in the groups phones use, with search, recently used and the
  skin-tone variants; the tone a reviewer picks is remembered. Only emoji the device can draw are offered.
- **What you see at rest.** Reactions are quiet, like the rest of a thread: a comment with reactions
  shows each emoji with a small count beneath its words; a comment with none shows nothing. The
  control to add one appears with the other details when the pointer is over the comment or focus is on
  it, and beside the reply and resolve controls inside an open thread.
- Your own reactions are marked. **Pointing at or focusing a reaction shows who gave it**, by name as
  shown elsewhere, with "You" first. On a touch screen a long press on it does the same, without taking
  your reaction back; the names go with the next touch.
- Adding, changing and removing a reaction **ease**; counts roll, as other counts do. Reduced motion
  turns them into soft fades.
- **Everywhere comments show:** the column, bubbles, the open thread and All comments (as counts,
  without the control). Copying for AI (§7a) and `Pipeup.comments()` (§15b) include reactions, as a
  line such as "👍 2 (Sam, Red Fox)" under the comment.
- **No forging.** A reaction comes from the reviewer who gave it and can't appear to come from
  someone else or be removed by anyone else. A thread's reactions are kept when comments travel
  through sharing, live review or an agent's replies file, and are checked as strictly as comments.
- **Limits.** A single comment keeps to a small number of different emoji so it can't be flooded.
- **Deleted and resolved.** Deleting a comment removes its reactions. A resolved thread still shows its
  reactions; they can be added or taken back again after it is reopened.
- **Agents** can react and are shown as AI assistants, as their replies are (§15b); they react to
  acknowledge, never to resolve.
- Older copies of Pipeup (and add-ons) that don't know reactions **ignore them and keep showing the
  comments**; they never reject a comment because of one.
- The **full emoji picker is an add-on** (`emoji`) so the core stays small; without it a page has the
  quick row and still shows every reaction anyone gave. See §19.
- Fully usable by keyboard and screen reader: each reaction is a button that says the emoji's name,
  how many people gave it and whether you did ("Thumbs up, 3 people, including you").

## 8. Staying attached on changing pages

- When the page changes, every comment re-finds what it was attached to. Each comment is in one
  of three states, shown to the reader:
  - **Attached** — found where it was;
  - **Moved** — found nearby or after the content changed; flagged so someone can confirm;
  - **Orphaned** — its content is gone; the comment remains in the panel with a **snapshot** of
    what the reviewer was looking at.
- Every comment remembers the view it was made in: the slide, and whatever the page reports about
  itself (such as the open tab or route), with a readable name when the page gives one. A comment belongs
  to a view only when what it is about is inside that view; content outside a tab panel or accordion shows
  its comments whatever is open. A comment whose content Pipeup finds and can see on the page shows there, even
  when the page now reports something else about itself (a new revision of a design, say), marked Moved when the
  content changed; only content that is hidden or gone counts as elsewhere.
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
  (Hide comments), while the All comments panel makes its own room, or when there is no room
  for the column, the gutter closes and the content eases back to the true centre.
  This happens only on pages that reserve the gutter (§4); Pipeup never shifts a page that doesn't.
- Pipeup takes on the page's **fonts, accent colour, and light or dark appearance**, so it reads
  as part of the page. It takes the page's accent colour (or the author's) only when words in it are readable
  on Pipeup's surfaces, at least 4.5 to 1; otherwise it uses its own.
- Pipeup never breaks the page's own behaviour, and the page's styles never break Pipeup.
- **Pipeup keeps working while a page's own dialog is open**, whatever kind it is: a browser's modal dialog
  (including one inside a web component), one from a library (which may stop the rest of the page taking clicks, hide
  it from screen readers, make it inert, trap focus or close on Escape), an overlay at the highest layer there is, or
  an element shown fullscreen. Pipeup's comment control, menu, comment boxes and All comments show above it and its
  backdrop and can be used; what is in it can be commented on (a web component counts as one block, as everywhere);
  and it never takes Pipeup's focus, nor the keys pressed in Pipeup (Escape doesn't close it, Tab doesn't jump into
  it), nor closes because of what is done in Pipeup. While a browser's modal dialog or a fullscreen element is open,
  Pipeup's own element sits inside it (the one change Pipeup makes to the page, and only while it is open), and goes
  back out when it closes, however it closes; a dialog that renders its own contents again leaves the caret where it
  was in Pipeup. While a modal dialog or an inert overlay is open, the block cursor only visits what is in it. A page's
  popovers (menus and tooltips that float above everything) still draw over Pipeup, and pressing Pipeup closes them as
  pressing anywhere else does; what is inside a frame can't be commented on, nor what is inside a web component's
  own dialog. A modal dialog that is moved, animated or drawn with a transform, a filter or containment (one centred
  with `translate`, say) would hold Pipeup inside its own box: Pipeup waits outside it until it closes, so it can't be
  used while that dialog is open. A page's own script clicking an element in comment mode is taken as a click there.
- **Pipeup looks the same on every site.** Whatever the page's styles say (sizes, colours,
  spacing, text direction, opacity, filters, blending, zoom, transforms, resets, `!important` rules, a
  page's own light/dark switch), every part of Pipeup keeps its own look. The two things it takes from the page
  are the page's font family and accent colour, as above; nothing else of the page's styling reaches it: text is readable, nothing is
  faded, stretched, flipped or restyled, and nothing is clipped by the page. This covers the column,
  bubbles, threads, the panel, menus, the composer, highlights, pins, tooltips, toasts and add-ons'
  own parts.
- **Pipeup has a light look and a dark look, and both work.** Each is designed and tested in full, on any
  page. They are not a filter over each other.
- **Pipeup is light or dark as a whole, never mixed.** Every part switches together, and changes with a
  fade.
- **Which look.** Pipeup follows the page's light or dark appearance when the page makes it clear, and is
  light when it doesn't. The reviewer can choose Automatic, Light or Dark with the Theme row in the menu; the choice is
  remembered in their browser and beats everything else. The author can set a look for the page (`data-pipeup-theme="light"` or `"dark"` on `<html>`), which
  beats detection. If the page changes appearance later (a switch on the page), Pipeup follows however
  the page makes the change, not only when it changes the page's top-level elements.
- **Pipeup's own surfaces never depend on the page's colours.** Every card, thread, panel, menu, composer,
  tooltip, toast and add-on part is drawn with its own solid background, text, border and shadow, chosen
  together so text is always readable (at least 4.5 to 1, and 3 to 1 for icons and outlines) in both looks.
  Words that sit directly on the page (a thread at rest in the column) keep their soft, boxless look but
  always sit on their own soft backing, so they stay readable whatever the page behind them is. The only
  parts that sit over the page's content (highlights and pins) are tuned so the page's own text stays
  readable under them in both looks, whatever colour is behind the words (a dark footer or button on a light
  page, or the reverse) and whichever look the reviewer chose.
- **Each comment is shown in its own text direction**, so Arabic and Hebrew read right to left whatever the
  page's direction; so is the box it is written in.
- **Pipeup says what the page does to it.** Styles on the page's top-level element that fade, filter, blend,
  transform or zoom everything under it reach Pipeup too, and can't be undone from inside it. Pipeup
  notes them once in the browser console, says when its words may be hard to read under them, and reports the same
  in the check (§15). It reads colours written in any modern format (`oklch()`, `color-mix()` and so on) when it
  works out the page's look.
- Pipeup is checked against pages with deliberately hostile styles, and against real sites that have
  shown a clash, before a release.
- Pipeup is fully usable with a **keyboard and screen reader**: every way to start a comment (§5),
  every thread, the menu and All comments can be reached and used without a pointer; focus is never
  lost after sending, cancelling or closing; and screen readers are told which block a comment is
  being written on, when it changes, when a comment or reply is sent, and when comment mode ends. Keyboard
  focus is always plainly visible on every part of Pipeup (at least 3 to 1). In high-contrast (forced
  colours) modes, focus marks, switches, the filters' on and off states, your own reactions and whether
  comment mode is on all stay visible.

**Motion — nothing switches on or off abruptly**

- Everything that appears, disappears, moves or resizes **eases**; nothing snaps or blinks.
- Outlines and bars **glide between targets** rather than vanishing and reappearing.
- Entrances ease out, movement eases in and out, with short durations and no overshoot or bounce.
- Pins settle into place; threads open smoothly and the ones around them shift to make room;
  counts roll; "typing" indicators breathe. Lists ease too: cards a filter takes away or brings back, a card
  opening out in All comments, and a new thread taking its comment box's place.
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
- Nobody can post a comment that **appears to come from someone else**, even in a shared or live
  document. Nobody can appear in live presence as someone else.
- When two people in a shared or live document use the same name, Pipeup shows a way to tell them
  apart.

## 10a. Mentions and notifications

*Built (0.7).* Names, mentions, the `@` list, *Mentions of me*, the seen marks, short tags for the same name, the recovery code and file, and contacts with the by-hand email offer are built; the GitHub add-on is `github`, and the inbox is the `inbox` add-on with the reference mailbox server.

Pipeup has no accounts and no server of its own, so a mention works in layers: it always works inside
the page, and reaches people outside the page only in ways the reviewer or the author chooses.

**Mentioning someone**

- Typing `@` in a comment or reply offers **people to mention**, narrowing as the reviewer types, chosen
  by keyboard or pointer:
  - everyone who has commented or replied in this document;
  - the agents the page lists (§15b);
  - people the page's author supplies (below);
  - people from an add-on's directory, when the page has one.
- A mention **points at a person**, not only a name: it keeps working if they rename themselves, and two
  people called Sam stay apart. It reads as the name, softly tinted, inline in the comment's words (a
  mention of you is also bolder); copying keeps
  `@Name`. An `@` that matches nobody stays plain words.
- Comment words are still text only; a mention is never a link, markup or a way to run anything.

**Being mentioned**

- When someone opens a page where they are mentioned, Pipeup **says so once** ("Sam mentioned you in 2
  comments") and All comments can show **only comments that mention me**. "Me" means this reviewer in
  this browser, or the signed-in person the page's author supplies.
- Mentioning an agent marks the comment as one that agent should answer first (§15b).

**Reaching people outside the page**

Pipeup itself sends nothing (§14). A mention can reach a person only through:

1. **The reviewer, by hand.** After sending, Pipeup offers "Let Sam know", which opens the reviewer's own
   mail or chat app with the words and a link to the comment filled in, when the reviewer knows how to
   reach them. The reviewer sends it; Pipeup never sends for them. This works on any page.
2. **An add-on**, chosen by the author and following §11a: first, a note in a GitHub issue or
   pull request; later, for example a message to a chat channel through the author's own webhook, or email through the
   author's own service. Each says in one sentence what it sends and to whom, and sends nothing before
   the reviewer agrees.
3. **The page's own system.** The author can give Pipeup the signed-in person and the people who can be
   mentioned, and a place to hand mentions to (the page's own notifications). Pipeup then shows those
   people as supplied by the page and sends nothing itself.

**Who someone is**

- By default a reviewer is still an animal in a colour with an optional name (§10): names are not
  proof. A mention of "Sam" does not show that the person who replies as "Sam" is the same Sam.
- A person can be **shown as verified** when the page's author supplies who they are (single sign-on
  stays the page's business; Pipeup does not talk to sign-in providers), or an add-on proves a handle
  (for example a GitHub name). Verified people are marked, and say who vouches.
- A reviewer may **add an email or handle** to their profile so others can reach them. It stays in their
  browser; it is shown to other people in the document only if the reviewer chooses, and it is never put
  into a comment, a copy for AI or any service without their agreement.
- **Everyone who comments is known by the name they gave**, and each person has a **durable ID** behind it
  that stays the same across their comments in a document and across documents. A short form of the ID
  (like "Sam · 4F2A") is shown only where two people share a name. Pipeup never merges two people because
  their names match.
- **An ordinary identity can't be exported** (its key never leaves the browser). **My identity** in the menu (from the identity add-on, §16a) lets a reviewer *make it portable*: Pipeup makes a new identity from a seed they keep as a recovery code or file; comments written before stay under the old one. Ordinary identities are unchanged. (The next paragraphs describe what portable identities can do.)
- **Keeping the ID.** Pipeup asks the browser to keep it from being cleared. For a portable identity, **My identity**
  has **Back up my identity**, which gives a recovery code and a file (the same secret in both forms) the person keeps
  themselves, and **Use my identity**, which
  restores it from either in another browser or device so earlier comments and mentions still count as theirs. Pipeup
  never keeps the recovery code anywhere else and never sends it.
- **Without a backup,** a cleared browser starts a new person. Comments made earlier stay under the old
  ID, mentions of it reach no one, and others see the old name marked "(earlier)". Pipeup says this
  plainly before the person can lose it, and never merges by name to hide it.
- **Two devices are two people until linked** with the recovery code.
- Pipeup never matches people across documents, and never builds a list of people beyond what one
  document shows.

**Picking up what was left behind**

- A comment, reply, reaction or mention is saved wherever the page's comments are saved, so **any copy of
  the page** (another browser, another device, an agent) that can open the comments **sees what was left**
  and marks it seen. When a person reads a mention on one device, it shows as read on their others.
- A person has an **inbox**, so a mention in a document they haven't opened still reaches
  them. The person who mentions leaves a small note for them ("Sam mentioned you", with a link), sealed so
  only they can read it. They collect their notes from any browser or device that holds their identity.
  The service keeping the notes sees only that something arrived, its size and its timing, and never
  who sent it, who it is for, or what it says. It is a choice the author makes (a page says whose inbox
  service it uses), and a reviewer agrees before anything is left. It is limited so it can't be used to
  flood someone.

**Everyone**

- Fully usable by keyboard and screen reader: the list of people is announced as it narrows, and the
  chosen person is read out.
- The list and the mention eases in and out like everything else, in light appearance.

## 11. Saving and sharing feedback

**On this machine (default)**

- Comments are saved automatically in the reviewer's browser and are there when they reopen the
  same document.
- Nothing is sent anywhere.

**Returning feedback (for now)**

- A reviewer sends feedback back to the author by pressing **Copy comments › As Markdown** and sending what they copied
  any way they like: a message, an email, or pasted straight into a conversation with an AI
  assistant.
- **Sealed feedback files** remain part of the design for sharing later: a single small file of the
  reviewer's comments, encrypted for the document's audience when the page has a document identity
  (§4), mergeable by the author with duplicates shown once, and readable by Pipeup's command-line
  tool. They have **no controls in the page yet**: no Send feedback, no Add feedback, and dropping a
  file on the page does nothing.

**Shared comments (sharing add-on)**

- An author can share a document's comments through a free, encrypted service that the author picks.
  Pipeup never picks a service by itself.
  - Everyone who has the page sees the comments others have chosen to share.
  - Comments last while nobody is online, for as long as the service keeps them.
  - New comments usually arrive within a minute while people are commenting, and within a few minutes
    otherwise. Pages in a background tab update more slowly.
- **The author sets up sharing with the command-line tool.** It writes the sharing line into the file,
  tells the author how long the chosen service will keep the shared copy, and shows a private stop key
  once, separately from the file. The stop key is never put in the page.
- An organisation can host the shared copy on its own server. That server only ever holds comments it
  can't read; it can see when and how much is sent, and from which network addresses. The organisation
  decides how long the shared copy is kept.
- Reviewers can't create a shared copy from inside the page.
- The sharing address and its key are **built into the file**, so anyone holding the file can read and
  add shared comments.
- Before a reviewer writes their first comment on a shared page, Pipeup tells them that comments there
  are shared with everyone who has the page.
- **Comments a reviewer wrote before the page was shared are not sent until they choose.** They can
  share those earlier comments or keep them on their machine.
- Each reviewer chooses whether **to send their own comments** to the shared copy. They still see
  everyone else's.
  - Comments written while they aren't sending stay on their machine, including later edits and replies
    in those threads.
  - What was already sent stays in the shared copy.
- Pipeup only ever sends a reviewer's own comments to the shared copy, never comments it received from
  someone else by file or live review. People who already received your comments could still pass them
  on themselves, and Pipeup says so where you choose whether to send.
- Pipeup says in words whether the shared copy is:
  - up to date;
  - waiting to send changes;
  - offline;
  - about to expire, and when;
  - gone.
- If the connection drops, a reviewer keeps working, and their changes are sent when it returns.
- In a browser that can't keep comments, the shared copy keeps the comments the reviewer sends, and
  Pipeup says so.
- An author can **stop sharing**. They can also **start again at a new address**: people who only hold
  the old file then can't read or add new comments. Reviewers who open the new file bring the comments
  they had already shared, without being asked again. Anyone who already had access keeps what they
  saw, and Pipeup says so plainly.
- Where the service only lets the author delete part of a large shared copy, stopping sharing says which
  parts remain and when they expire.
- The website states how much each reviewer downloads while a shared page is open, so authors can choose
  a suitable service.
- Shared comments can always be copied out.
- Deleting a comment hides it everywhere. Anyone who already received it keeps its words in their copy.

**Comments arriving while you read or write (shared and live)**

- Words being written are never lost when others change the comment: a reply being written stays, with
  its words, if the comment is resolved or deleted by someone else meanwhile.
- Comments arriving from others never move the reviewer's cursor, selection or scroll position, and
  never open or close a comment.
- Screen-reader users hear new comments from others as one short summary, such as "2 new comments from
  Blue Owl", at most every few seconds, never while they are writing and never while comments are
  closed. Live cursors are never announced.

**Live review (live add-on)**

- People viewing the same page at the same time can **go live**. Their new comments, replies, edits,
  deletions, resolves and reopens then appear for each other within about a second.
- Each reviewer chooses whether to go live.
  - Before they do, they are told that the other people who are live will see their network address.
  - An author can make going live the default for their page. Reviewers are still told before they are
    first connected, which happens only once they open Pipeup, and can turn it off.
- Live review works without a shared copy: people merge their comments when they meet. Without a
  shared copy, comments made while nobody else is live reach others only when they next meet.
- Up to 8 people can be live together.
- Only people with the same version of the file meet live. After the author starts sharing or changes
  the sharing address, people with the old file and the new one don't see each other, and Pipeup says
  when nobody else is here with this version of the page.
- **Some networks, often office networks, don't allow direct connections.** Then Pipeup says in words
  that it can't reach that person directly. With a shared copy, their comments still reach each other,
  more slowly.

**Rooms on the author's own relay (later add-on)**

- An author can turn a document into a **room** on a relay they own.
  - Everyone in the room sees comments appear as they are written.
  - Comments persist while nobody is online.
- The author shares an **invite**: a link, or a code to enter on a page opened from disk. Only people
  with the invite can read or write.
- An author can choose for the invite to be **built into the file**, or **shared separately** for
  sensitive documents.
- An author can **close a room** and start a new one, to remove everyone's access.

**What each kind of sharing keeps.** The website and each add-on's page state which of these promises
the add-on keeps:

- whether comments last while nobody is online;
- live updates;
- presence;
- who can read;
- who can write;
- whether missing comments can be detected;
- whether the author can list and delete what is stored.

A shared copy on a free service can't stop anyone holding the address from adding unreadable data,
which Pipeup discards. It also can't tell when something is missing.

## 11a. Add-ons

- Optional features come as add-ons. Authors include only the ones they want, and reviewers download
  only those.
- Each add-on states in one plain sentence:
  - whether it uses the network;
  - which services it contacts;
  - what those services, and other reviewers, can see.

  The website, the docs, the agent skills and the check repeat that sentence.
- Pipeup itself makes no network requests, with or without add-ons. Only an add-on sends anything.
- **Whatever add-on a page includes, Pipeup checks every comment arriving from elsewhere as strictly as
  one opened from a file.** No add-on can make Pipeup accept a comment that is forged, altered or meant
  for another document.
- **Add-ons published by the Pipeup project:**
  - send only to the services they name;
  - send nothing before the reviewer agrees, where they need agreement (going live, dictating);
  - never change the page's own content;
  - never post, edit or resolve anything on a reviewer's behalf; they may only fill in words that the
    reviewer then sends;
  - never send one reviewer's comments to a sharing service on another reviewer's behalf.
- **Add-ons from anyone else run with the page's full power.** Pipeup doesn't vouch for them, and the
  website says so.
- An add-on that can't work with the Pipeup version on the page stays off and says why. It never
  half-works.
- Authors and agents can see which add-ons a page has, and whether each one is on.
- Add-ons appear in Pipeup's own menu and comment boxes. They look like Pipeup, follow its light and
  dark appearance and reduced motion, and keep every rule that words being written are never lost.
- **While comments are closed (hidden with Hide comments, and nothing showing them), add-ons add nothing
  to the page except words in the comment control's label and tooltip.** A message an add-on raises meanwhile waits, and is shown once when the reviewer
  next opens Pipeup.

### Making your own add-on

Anyone can make an add-on and publish it under their own name, anywhere. Nothing needs the Pipeup project's
permission, a registration, or a place in its npm scope.

- **A guide, in plain words, on one page.** It explains, in this order: what an add-on is and what a page's author
  does to include one; what an add-on can do (add a row to the menu, open a panel, show a note on a thread, show a
  status, read the comments, and bring in other people's comments, which Pipeup checks as strictly as any); what it
  can't do (make Pipeup accept a comment that is forged, altered or for another document); the one plain sentence
  every add-on gives about what it sends and to whom, and that reviewers are shown it before anything is sent; how a
  page includes the add-on; how to try it and test it; and what the Pipeup project does and doesn't stand behind (it
  vouches for its own add-ons only). It ends with a small complete example the reader can paste and run.
- **A template to copy.** A folder, usable without the rest of Pipeup's source, holding a small working add-on (a
  menu row that opens a panel and says its one sentence), a page to try it on, a browser test of it, and a short
  README with the steps to publish it under the maker's own name. A copy works and passes its own checks before
  anything is changed.
- **Names.** An add-on's name is its own: letters, digits and dashes, 2 to 24 characters, written by the maker (a
  maker's name in front keeps it distinct, for example "myteam-translate"). The names of the Pipeup project's add-ons
  (share, voice, live, assist) are theirs, and the guide asks everyone else not to use them. Pipeup can't tell
  an add-on's maker from its name, so it doesn't refuse them: two add-ons with the same name on one page, the first
  is used, and the second is ignored with a message.
- **Nothing is taken on trust.** The guide, the template and the website say that add-ons from anyone else run with
  the page's full power and that Pipeup doesn't vouch for them.
- **Where to find it.** The guide is linked from the website's Add-ons page, the README and the add-ons folder, with
  one line saying what it is for. The page's list of Pipeup's own add-ons is unchanged.
- **Using add-ons inside a company.** The guide has a short section for companies that want their own add-ons (a
  link to their ticket tracker or document system, their own sign-in, their own review rules) without publishing
  anything under the Pipeup project's name. It says, in plain words: the add-on is one script file the company hosts
  itself (on its intranet or artifact store, through a private package registry under its own scope, or beside the
  page); the page pins it (a fixed version and an integrity hash) so it can't change underneath reviewers; the
  page's author decides which scripts run, so only the add-ons the company includes ever do; the company reviews the
  add-on like any code on its pages, because it runs with the page's full power; and the company's own sentence about
  what it sends (to its own servers) is what reviewers are shown first. Nothing leaves the company unless the add-on
  says so.
- **Two ways to send comments somewhere your company controls.** The guide starts its company section with the choice:
  1. **No new code**: use the Share add-on with the company's own mailbox (a server the company runs that keeps only
     sealed comments it can't read, speaking the published mailbox contract). This is the safe default for "comments
     must stay inside the company".
  2. **Your own add-on**: for what the mailbox can't do, such as turning comments into tickets, filing them in the
     company's document system, or using the company's sign-in. This is what the worked example shows.
- **What an add-on works with, written down.** The guide describes, in plain words, what an add-on is given and can
  rely on: the document's threads (each with where it is on the page, whether it is resolved, and its comments with
  who wrote them, when, and whether edited or deleted), a way to hear when they change, the signed comments underneath
  for add-ons that carry them somewhere, and a way to sign something as the reviewer. It says which parts are fixed
  from one Pipeup version to the next (the add-on's API number, and the form of a signed comment) and what an add-on
  must do when it meets a newer one (stay off and say why). The add-on's types, published with Pipeup, are the
  reference and the guide points to them.
- **Reading comments needs no encryption.** Comments are plain text in the reviewer's browser; Share seals them only
  while they travel through a service the company doesn't control. An add-on that sends them to the company's own
  system, over a secure connection, needs no crypto. The guide says so, and says when sealing is worth writing (a
  store the company doesn't control).
- **The review as a Markdown file.** Pipeup already writes a review as Markdown that says exactly where each comment
  is, ready for an AI to act on (what Copy comments › As Markdown copies). An add-on can ask Pipeup for that same Markdown, so a
  company's add-on saves exactly what its AI tools already know how to read, and nothing has to be reinvented.
- **A worked example from "another company".** The repository holds a complete example add-on written the way a
  company would write one, outside the Pipeup project's names and carrying no real company's name: "Send to Git". It adds one row to the menu, "Send
  to Git", that sends the review as that Markdown file to a service the page names, which saves it in the
  company's Git repository for later processing and AI work. Before anything is sent it asks, saying what it will
  send and to where. It sends over a secure connection only (or to the reviewer's own computer, for trying it), says
  in words how it went (including where the file was saved), and never posts, edits or resolves a comment on anyone's
  behalf. The add-on never holds a Git password or token: the company's own service does the saving. **Its side of
  the integration is written down as a small contract**, in the example's README: the address, the request (the page's
  title and address, when, and the Markdown), the answer it expects (the saved path and commit), and how it treats an
  error, so a company knows what its own service must accept. It comes with a tiny stand-in service that follows the
  contract: run on the same computer, it saves each review as a Markdown file in a local Git repository and commits it.
  The example is clearly labelled as not from the Pipeup project, and shows the three ways to hand the script out. The
  guide also lists the other ways to get a review into Git (the reviewer saves the file and commits it themselves; the
  add-on saves into a folder on the reviewer's computer where supported) and says why the company's own service is the
  better choice at scale.
- **Keeping add-ons intentional (best effort).** An add-on is a script on the page and runs with the page's full power,
  so nothing here can stop someone who can already edit the page. The aim is to stop add-ons the author didn't choose
  (a stray or copied-in script) and to help authors and companies lock down what runs:
  - **An allow-list the author sets.** The page's author can name the add-ons that may run, in one attribute on the
    page (`data-pipeup-addons="share,send-to-git"`). When it is there, only those add-ons run; any other is ignored,
    shows in the add-on list as off with the reason "this page doesn't allow it", and puts one plain line in the
    console. A value of "none" lets no add-on run. When the attribute is absent, every add-on runs as today, so
    existing pages keep working. Reviewers see no change.
  - **Pinned and checked scripts.** Authors are told to pin each add-on's script to a fixed version with its integrity
    hash (or to host one bundled file and pin that), and to set a content security policy that allows only the
    script and network hosts they intend, because an add-on's "what it sends" sentence is a statement and a policy is
    what enforces it. For Pipeup's own add-ons the guide gives the exact policy lines from their declared hosts.
  - **One bundled file.** For companies the guide recommends one file that holds Pipeup and the add-on together,
    hosted by the company and pinned. The template builds that file and prints its integrity hash.
  - **Said plainly.** The guide, the website and the agent files say this is best effort: it protects against stray
    scripts, not against a page that is already compromised, and an add-on's name can't prove who made it (the
    first add-on with a name wins).
  - **Agents do the setting up.** Everything an agent reads about adding an add-on tells it to add the pinned script
    with its integrity hash, to list only the add-ons the author asked for in the allow-list attribute, and to
    suggest the matching content security policy for the author to apply (never to apply one that could break the
    page without saying so). The surfaces are: llms.txt and llms-full.txt; the integrate agent skill; each add-on's
    Copy prompt and script-tag button on the Add-ons page; the Markdown copies of the Add-ons page, the guide page and
    the home page; the guide; and each add-on's README and the template's README.
  - **Not part of this change:** a list in the menu that shows reviewers which add-ons are active (and which are not
    from Pipeup), and running add-ons in a sandboxed frame; both are for later, and the first changes the core.
- **Setting up the company's side (GitHub).** The browser never talks to GitHub. A small service the company runs sits
  between: it knows who is sending (through the company's sign-in), checks the request, chooses the file's path itself
  so a request can't write elsewhere, limits size and rate, keeps a record, writes the Markdown to the repository, and
  answers with the saved path and commit (or pull request). The guide describes the ways to give that service access,
  best first: a **GitHub App** installed on only the review repository, writing to a branch and opening a pull request
  (never pushing to the main branch); a fine-grained access token on a bot account, limited to one repository, for a
  pilot; a GitHub Actions workflow started by a webhook for short reviews. It says why the add-on never holds a token
  and why the page never calls GitHub directly. GitHub Enterprise Server works the same at the company's own address.
  Parts shipped with the example, so a company starts from something that works:
  - **A GitHub-backed reference service**, beside the stand-in one, that follows the same written contract, written
    without outside code (like the mailbox reference server), so a company can read all of it.
  - **A contract checker**: one command that sends a sample review to a company's service and says, in words, whether
    it follows the contract (so a company knows its own version works before pointing a page at it).
  - **A setup skill for agents**, shipped with Pipeup's agent skills, that walks a company engineer's agent through:
    choosing the GitHub option, creating the GitHub App from a manifest the person approves (the agent can't approve
    permissions for them), generating the service from the reference one, setting its settings, giving the page the
    service address, the allow-list entry and the matching content security policy line, and running the checker. It
    never asks for a token to be pasted into a page or a chat.
- **Two worked examples, for two situations.** Both are written the way a company would write them, outside the Pipeup
  project's names, and clearly labelled as not from the project:
  1. **"Send to Git"** (needs the company's own service): the reviewer's comments go to a service the company runs, which
     files them in Git. For teams: sign-in, a record of who saved what, pull requests.
  2. **"Save to GitHub"** (needs no server and no token): one menu row opens GitHub's own "new file" page in a new tab with
     the review already filled in (the Markdown that Copy comments › As Markdown makes, in a file path chosen from the page's name
     and the time). The reviewer signs in to GitHub as themselves and presses GitHub's commit button (or "propose
     changes", when they can't write to the repository). It asks first, saying what will be filled in and where. The
     page names the repository, and optionally the branch and folder, and, for GitHub Enterprise Server, the host. When
     the review is too long to travel in an address, it copies the Markdown for the reviewer to paste and opens the same
     page with the file name filled in, and says so in words. It never holds or sees a token, and never posts, edits or
     resolves a comment.
- **Choosing a way, written down.** The guide's company section lists the ways to get a review into Git and when each fits: the
  company's service using the GitHub API (pull requests, sign-in, records); the same service running Git itself with a
  deploy key (any Git host); the host's API for another host (GitLab, Bitbucket, Azure DevOps, Gitea); GitHub's prefilled new-file or new-issue
  page (nothing to run); saving into a local clone; downloading the file and committing it; and Copy comments › As Markdown pasted to an
  agent or an issue. It names what needs a server and says which of them the examples show.
- **As little friction as possible: the agent does the setting up.** Each example has one Copy prompt that gives the person's AI
  agent everything it needs (the setup skill). The setup skill covers both examples and starts by asking which fits (no server,
  or the company's service) and which repository. For "Save to GitHub" the agent only edits the page and tells the person
  what to expect: the person has nothing to approve and no token to make. For "Send to Git" the agent does everything it
  can: it gets the example, builds it, and runs the service and the page; the few things only the person can do are kept
  to one click each: approving the GitHub App (the agent starts GitHub's own "create an app from a manifest" flow, which
  asks the person to press one button, and keeps the app's key in a private file on their computer, never in the chat or a
  page) and installing it on the repository. The skill says plainly which steps are the person's and why. It never asks for a
  token to be pasted anywhere.
- **Not part of this change:** a list of other people's add-ons, and a mark in the menu telling reviewers an add-on is
  not from Pipeup (both are for later, and the second changes the core).

## 12. Presence (live review)

- While live, avatars show **who is here now**. On decks they also show **which slide each person is
  on**.
- Live **cursors**, **selections** and **"typing…"** show where others are. Each person can turn
  cursors and selections off for themselves: they then neither send nor see them.
- A **follow** action jumps to the slide or place another person is looking at.
- Cursors and selections show only while comments are showing. While comments are closed, only the
  comment control's label and tooltip say who is live.
- Screen-reader users hear when someone joins or leaves, as a short summary, while comments are
  showing.
- Presence is never stored. It exists only while people are connected.

## 13. The relay

- As a later add-on, an author can **create their own relay with one step** on a free hosting
  account they own. The first supported host is Cloudflare.
- Running a relay on a free account **never produces a bill**: when free limits are reached the
  relay stops accepting new data and says so, rather than charging.
- The relay enforces limits per room — size, rate of writes, number of people — and rooms that
  are inactive for a chosen period **expire** and are deleted.
- The author can list their rooms, see their size and last activity, and delete any room.
- The relay keeps **no record of comment content** in a readable form and keeps no logs of its
  own beyond what the host requires.
- The Pipeup project runs **no relay** in the first release.

## 14. Security and privacy

- **Only people holding the page can read shared comments.** Later, for rooms shared separately, only
  people holding the invite can. That excludes every service carrying the comments and its hosting
  company.
- Services that carry comments see only:
  - that something is stored or exchanged;
  - its size and timing;
  - network addresses.

  They never see comment text, names, cursors, quoted text or the document. This holds for an
  organisation's own sharing server too.
- **Comments cannot be forged or altered** by other people or by any service. A service can at most
  withhold or drop data, or fill its storage. Pipeup shows that something is missing where it can
  tell; a shared copy on a free service can't tell.
- Comment content can **never run as code** or change the page.
- **Pipeup itself makes no network requests** and has no analytics, tracking or telemetry.
- Add-ons published by the Pipeup project send only what they declare, only to the services they name,
  and only encrypted so those services can't read it. **The one exception is dictation through a
  browser maker's speech service** (Google in Chrome, Apple in Safari): that service hears the
  reviewer's voice, and dictation uses it only after the reviewer agrees to a sentence saying so.
- Dictation may make the browser download a speech pack from its maker once; Pipeup says so first.
- With live review, the other people who are live see your network address. The services that help
  people find each other see it too.
- A reviewer's Pipeup identity is the same across documents in one browser.
- On pages opened from disk, other pages opened from disk in the same browser can read and change what
  Pipeup and its add-ons keep. Secrets used for sharing are never kept; they come from the file each
  time. Anything an add-on downloads and keeps is checked again every time before it is used.
- Add-ons from anyone other than the Pipeup project run with the page's full power; only the checks on
  arriving comments apply to them.
- Published builds are **verifiable**, including add-ons and combined files. An author can pin the
  exact versions they tested, and the browser will refuse a build that has been tampered with.
- Access to new shared comments can be removed by starting sharing again at a new address, or by
  closing a relay room. Anyone who already had access can still read what they saw before, and Pipeup
  says so plainly.

## 14a. Knowing about newer versions

*Built (0.7), except that the check does not exist yet (§15).* The console line, the signing tools and the `updates` add-on are built.

Pipeup itself makes no network requests (§14), so it can't look for updates. The person who needs to know is
the **author** who put Pipeup on the page, not the reviewers. Authors learn about newer versions in three ways.

**Pipeup itself, with no network**

- Pipeup knows when it was built. When that is **more than a year ago** it writes one line to the browser
  console, once per page load, saying so and where the changelog is. Reviewers see nothing. An author can switch
  it off (`data-pipeup-updates="off"`).
- It says nothing about security, because it can't know.

**The author's tools, with no visitors involved**

- `pipeup check` says whether the version a page uses is the latest, lists published security advisories that
  affect it, and says exactly what to change, including the new integrity hash when the page pins the script.
- Every release has notes, and a version with a security problem is marked in the release notes, in the package
  registry's own deprecation notice and in a published security advisory, so tools that watch dependencies
  (and people who watch the repository) hear about it.

**An add-on that checks for the author** (`updates`, off unless the author adds it)

- It fetches one small published file listing the latest version, the oldest supported version and security
  advisories, and compares it with the version on the page.
- **It runs only when the author is the one looking**: on a page opened from disk, on the author's own computer
  (localhost), or where the author has asked for it. **A reviewer's browser never makes the request** unless the
  author chooses to allow that, and says so (`data-pipeup-updates="everyone"`). The add-on says in one sentence
  what it contacts and what that service can see (§11a).
- The file can't be forged or replayed: Pipeup checks it was published by the Pipeup project, and has not expired,
  before showing anything from it.
  What it shows is plain words, and links go only to the project's own addresses.
- **What the author sees**:

  | What is found | Where |
  |---|---|
  | A patch or minor release | A line in the console |
  | A major release, or a recommended update | A line in the console and a small marker in the context menu |
  | A security issue, or a version no longer supported | A notice in the context menu that names the issue, the fixed version, where to read more and how to update |

- A notice can be dismissed for that version or advisory, and the choice is remembered in that browser.
- **It never changes the page, never installs or updates anything, and never gets in the way of writing a
  comment.** A notice raised while comments are closed waits and is shown once when Pipeup is next opened (§11a).
  If the file can't be reached it says nothing.
- A page that pins an exact version stays on it until the author changes it; no notice ever changes that.

## 15. Agent support

- **Agent skills** ship with Pipeup and teach agents to:
  - add Pipeup to a document or deck so it looks native;
  - **create content ready for review**, with guidance for each kind of page — documents with a
    centred reading area and a reserved comment gutter, sites with stable, named blocks for comment
    mode, decks with marked slides — and when to use each of Pipeup's options;
  - run the **check** and fix what it reports;
  - **summarise** feedback by theme, section and status;
  - **reply to** threads and mark them addressed (never resolve them), and **apply** approved changes to the page.
- **Check** loads a page with and without Pipeup and reports pass, warn or fail for:
  - any layout change caused by Pipeup;
  - closed Pipeup UI overlapping page content, at phone, tablet and desktop widths;
  - Pipeup UI overlapping the page's own controls;
  - blocks, charts and slides without stable identifiers;
  - colour contrast and keyboard reachability of Pipeup's UI;
  - which add-ons a page has, whether each is on, and what each sends;
  - Pipeup included twice on one page (a failure);
  - saved comments that couldn't be read.

  Its overlap checks include add-on surfaces.
- Check output is readable by people and parseable by agents, and the check fails clearly so an
  agent knows to keep fixing.
- Agents read comments a reviewer copied (Copy comments › As Markdown), and can read and reply in a page's shared
  copy. Later they will also read and write feedback files and, with an invite, take part in rooms on
  a relay.
- An agent taking part in a shared copy does so under **its own identity and a name that shows it is
  an agent**, never as the person it works for. Its identity is never put in the page.
- Agents add an add-on only when the author asks for that feature, and tell the author in plain words
  what it sends and to whom. They never pick a sharing service without asking.
- When an agent rewrites or regenerates a page, it keeps the page's document identity and sharing line
  unchanged. A new document made from an existing page or template gets a new identity and no sharing
  line, so comments of different documents never mix. Agents never put a stop key in a page.

### 15a. Installing the skills

Today an agent has to be pasted a prompt and fetch each skill. The skills become something a person
installs once, after which the agent uses them on its own whenever the task calls for it.

- **A Claude Code plugin.** One plugin holds every Pipeup skill. A person adds the project as a plugin
  source and installs the plugin with two commands, then asks for what they want ("add comments to this
  page") without pasting anything. Updates arrive the way any plugin's do.
- **One command for any agent.** A small installer, run with one command, puts the same skills where
  Claude Code and Codex look for them: for the person (every project) or for the current project only,
  the person's choice. It says in plain words what it will write and where, asks before replacing a
  skill the person has changed, and can update and remove what it installed. It never changes anything
  else on the computer, and it runs with no account and no network call beyond fetching itself.
- **Codex** reads the same skills through the installer. Anything more specific to Codex is added only
  after checking what Codex supports at the time.
- **Same skills everywhere.** The plugin, the installer, the website's copies and the copy-and-paste
  prompts all carry the same text, so they cannot disagree. Each says which Pipeup version it was
  written for.
- **A skill for adding Pipeup.** A new skill, "add Pipeup to this page", does what the prompts do
  today in one place: it adds Pipeup pinned to an exact version with its integrity hash, asks which
  add-ons the page wants (none by default), sets the allow-list for them and tells the author about a
  content security policy. The other skills point to it rather than repeating it.
- **The prompt stays** as the fallback for an agent with nothing installed, and for a chat that can't
  install anything. Each page that offers it shows the install commands first.
- **Out of date wording is removed.** The skills no longer say the command-line steps are "arriving
  later" when a step works today by copy and paste.
- The installer and the plugin hold no runtime code for a page: they carry text and nothing that runs
  on a reviewer's page. Neither sends anything about the person anywhere.
### 15b. Agents reading and answering comments

Today a person has to copy the comments and paste them to the agent, and an agent's answer can't come
back into the page. This section closes both gaps without a server. (A live link between the page and
an agent on the same computer is a later step and is not part of this one.)

**Reading**
- A page can give its comments to the agent looking at it, with no copy and paste: the same Markdown
  Copy all gives (every thread with its id, where it is on the page, and its words), and the open
  threads as plain data. Either can be asked for open threads only, or all of them.
- It carries nothing a person can't already see in the page, and it works for any agent that can run
  the page in a browser.

**Answering**
- An agent answers a thread by writing a reply into a **replies file** kept next to the page, named by
  the page. A reply names the thread it answers, carries the agent's words, and may say the thread is
  **addressed**, with a short note of what was done and where (for example "addressed in revision 41").
- A reply is signed by the agent's own identity, made once and kept on the agent's computer, never in the
  page or its folder. The identity has a name that shows it is an agent (§10, §15).
- The page shows the replies it finds in the file, inside the thread, under the agent's name and with
  the same marking as other AI replies. A reply can't be edited or removed by a later one, only
  followed by another.
- A page accepts replies only from agents its author has listed. Replies from anyone else are ignored,
  and the page says in words how many it ignored.
- Reading the replies file is done by the **agents add-on** (§15d), which the author adds (or which `pipeup watch` adds
  for them). With it, the page reads the file when it opens, then again every few seconds while the page is showing
  and when it comes back into view, so an agent's answer appears in the thread by itself; the person can also ask it to
  check at once. It makes no network request to do so when opened from a file on the person's computer, and when served
  from a website it reads only a file on that same site.

**Addressed, and who closes**
- **Addressed** is not resolved. A thread an agent says is addressed shows that plainly, with the note,
  and stays open until a person resolves it. A person can reopen it, and say what is still wrong.
- Agents never resolve, reopen, edit or delete a thread. (This replaces the earlier wording that let an
  agent resolve threads; §15 and the skills are updated to match.)
- A reply file can't make a person's comment change in any way.

**Showing that a page is ready for an agent**
- With the agents add-on, a page whose author has listed an agent says so in plain words in the comment control's menu, in one
  line that names the agent (for example "Claude can answer comments here"). A page with no agent listed
  shows nothing, so nothing is added for readers who don't need it.
- With the agents add-on, the menu's copy-for-AI row has a second choice, **Copy a prompt for my agent**, shown whether or not an agent is listed, which copies a short
  instruction that tells an agent where this page's comments are, how to read them and how to answer,
  and that it may mark a thread addressed but never resolve it. It carries no comments and no keys. Its commands
  name the version of Pipeup the page runs (`npx pipeup@0.8.0-beta.4 …`), so the agent runs the same release as the
  page and not whatever npm calls stable, and a pre-release's prompt points at the pre-release guide.
- With the agents add-on, All comments says in a sentence how the agent has answered ("Claude has answered 3 of 5 open
  comments; 2 are marked addressed") and the panel has a quiet **Check for replies** button.
- In a thread, an agent's reply keeps the AI marking (§10). A thread marked addressed shows the note and
  two plain choices, **Resolve** and **Still not right**, the second of which reopens it with a place for
  the person's words.
- Nothing here appears, moves or disappears abruptly; a new reply eases into the thread.

**What agents are told**
- Every agent-facing surface says the same things about comments, in the same words: the skills (apply,
  summarise, integrate and the install skill of §15a), `llms.txt` and `llms-full.txt`, the Markdown copy
  of each page, the prompts the site offers, and the prompt the menu copies.
- An agent that is given a page's comments: reads every open thread in order; for each one makes the
  change the author approved, or says why it did not; replies in the thread with what changed and where;
  marks it addressed; and leaves closing to the author. It asks the author before changing anything
  the author hasn't approved, and answers a question with an answer, not a change.
- An agent writes its replies in the replies file under its own named identity, and never puts its key
  in the page or the folder, never answers as a person, and never resolves, reopens, edits or deletes.
- When a thread is reopened with "Still not right", the agent treats the person's new words as the
  request, and replies again in the same thread.
- An agent that can't write the replies file (for example a chat with no files) says what it would have
  replied, in a form the author can paste, and does not pretend the page was updated.
- An agent that adds Pipeup to a page lists itself as an agent only when the author asks for replies,
  and says in words what that lets it do.

**Skills and checking**
- The apply skill tells the agent to read the comments, make each change the author approved, reply with
  what changed, mark it addressed, and leave closing to the author.
- Check reports a replies file that can't be read, and replies for threads that no longer exist.
- Comments written before this change, and pages with no replies file, behave exactly as they do now.

### 15c. A live link to an agent on this computer

Comments live in the reviewer's own browser, so an agent can only see them if the person pastes them or the agent
drives that browser. The live link lets an agent on the same computer read comments and answer them without either,
and only after the person clicks.
The page's side of the link is part of the agents add-on (§15d); `pipeup watch` adds it to the page it shows.

**Starting it**
- The author starts a link for a page file with one command on their own computer. The link shows the page from their
  computer, at an address that works only on that computer, and says in words where it is and how to stop it.
- Starting the link for a named agent (for example Claude or Codex) lists that agent for this page for as long as
  the link runs, so the author doesn't also have to edit the page. When the link stops, the page is as it was.

**Sharing is a click**
- On a page shown through a link, the comment control's menu has a switch, **Share with my agent**. It is off, on
  every load, until the person turns it on. Nothing is sent before then.
- Its hint says in plain words what it sends and where: this page's comments, to the program running on this computer,
  and nothing else. A page not shown through a link has no such switch.
- Switched on, the comments already on the page and every new comment, edit, resolve and reopen go to the link, and the
  menu and All comments say the page is sharing with the agent by name. Switching it off stops sending at once.

**What the agent can do**
- Read the page's comments at any time with one command, as Markdown or as data, open threads or all, each with its
  id and where it is. It needs no browser, and works while the page is closed (the comments are as the page last
  shared them).
- Answer a thread with one command; the reply, signed by the agent's own key, and any addressed note reach the open
  page within seconds, in the thread, as in section 15b. The same rules hold: an agent only replies and marks a thread
  addressed, never resolves, reopens, edits or deletes.
- Read the person's resolves and reopens, so it knows when "Still not right" has reopened a thread.

**Keeping it private and safe**
- Everything stays on the computer: the link talks only to the page it shows and to programs on the same computer, and
  nothing is sent to any server.
- Another web page or program can't read or write through the link: it accepts only the page it serves, and only after
  the person has turned sharing on.
- The link keeps the shared comments and replies in files next to the page, named plainly, so the person can see,
  keep or delete them. Stopping the link leaves them.
- If the link stops while the page is open, the page says so in words; the comments are safe in the browser and sharing
  can be turned on again.

**Skills and prompts**
- When a link is running, the prompt Copy a prompt for my agent tells the agent to read and answer with the link's
  commands instead of driving the browser. Without a link, section 15b's way still works and the prompt says so.
- The apply and integrate skills, `llms.txt` and the site's Markdown copies describe both ways, preferring the link
  when the author is on their own computer.

### 15d. The agents add-on

*Built (0.7).* Reading an agent's replies, the live link and the prompt for an agent are needed only by pages
that have an agent, so they move out of Pipeup itself into an add-on, `agents`, and every page without an agent no
longer downloads them. Everything §15b and §15c say about what a person sees and what an agent may do stays as it is.

**What stays in Pipeup itself**
- The page's comments for an agent that is looking at it (§15b, Reading): as Markdown, and as data, open threads or all.
- Copy comments, as Markdown or as text (§7a); the Markdown still ends with the one-line instruction to work through the
  threads and say what changed.
- A thread an agent has marked **addressed** shows its note with **Resolve** and **Still not right** (§15b), and an AI
  reply keeps the AI marking (§10), whichever add-on or file the reply came from.

**What the add-on does**
- Reads the replies file (§15b), keeps only replies from the agents the author listed, and says how many it ignored.
- Adds the line about the agent to the menu, the sentence and **Check for replies** to All comments, and **Copy a
  prompt for my agent** to the menu (§15b).
- Is the page's side of the live link: the **Share with my agent** switch, off on every load (§15c).
- Says in one sentence what it sends and to whom (§11a): "Reads a replies file next to this page. When the page is shown
  through `pipeup watch`, and only after you switch it on, it sends this page's comments to the program running on
  this computer. Nothing leaves this computer."
- Follows the rules for every add-on (§11a): nothing is added to the page while comments are closed except words in the
  control's label and tooltip, it looks like Pipeup, and it never posts, edits or resolves for anyone.

**Adding it**
- An author who wants replies from an agent adds the add-on and lists the agent (`data-pipeup-agents`); agents adding
  Pipeup do both only when the author asks for replies, and say in words what that lets the agent do (§15).
- **`pipeup watch` adds it for the page it shows**, from the copy that came with the command, so the live link needs no
  edit to the page. Nothing is changed in the page's file.
- **`pipeup watch` refuses a page whose Pipeup is too old.** Before it starts, it looks at which Pipeup the page uses.
  A page on a version before 0.6 can't take an agent at all, so the command doesn't start; it says in words which
  version the page uses and what to change. A page on 0.6.x already has agent support built in, so the command starts
  and doesn't add the add-on. A page it can't read a version from starts, and the page says in words if agents aren't
  available.
- It can be included on its own, or in a combined file with Pipeup, like any add-on (§4).

**Pages that already use agents (0.6)**
- A page that uses Pipeup 0.6 or earlier keeps its agent support exactly as it is; nothing in a published version changes.
- On a version that no longer has it built in, a page that lists an agent but has no agents add-on says so in
  plain words in the browser console and in the check, and does nothing else; its comments are unaffected.
- Replies files, signed replies and the command line (`pipeup agent`, `reply`, `comments`, `watch`) are unchanged, and
  the add-on reads the same files.
- If the add-on is put on a page whose Pipeup already has agent support, the add-on stays off and says why (§11a).

**Skills and checking**
- The integrate and add skills, `llms.txt` and the site's Markdown copies say that listing an agent also means adding
  the agents add-on, with its address and integrity hash like any add-on, and that `pipeup watch` does it itself.
- Check reports a page that lists an agent without the add-on, a replies file that can't be read, and replies for
  threads that no longer exist, and lists the add-on among the page's add-ons (§15).

### 15e. Setting a page up: `pipeup init`

*Built (0.8).* One command does what the `pipeup-add` skill asks an agent to do by hand, so an author (or an agent)
can add Pipeup to a page without looking anything up.

- **`pipeup init <page.html>`** adds Pipeup to the page: the script for the version the command comes with, pinned to
  that exact version and its integrity hash, and a **document identity** if the page has none. It never changes an
  identity the page already has, since that would orphan every comment.
- **It says what it will change before it changes anything**, in plain words, and asks; `--yes` goes ahead without
  asking and `--dry-run` only says. Afterwards it says what it changed. Every other byte of the file stays as it was:
  no reformatting, no reordering, nothing removed.
- **Running it again changes nothing.** On a page that already has Pipeup it says which version the page uses; with
  `--update` it moves the page to this version (script and integrity only) and says what that version changes. It
  never moves a page to an older version.
- **`--offline`** puts Pipeup inside the file instead, so the page works with no network at all (§4).
- **Add-ons on request only.** `--addon <id>` (once per add-on) adds that add-on, pinned like Pipeup, and adds it to the
  page's list of allowed add-ons (adding to the list, never removing from it). Before it does, it shows the add-on's
  one-sentence statement of what it sends and to whom. An add-on that needs something from the author (an inbox
  address, a repository) asks for it, or with `--yes` refuses and says what to pass; it never guesses or picks a service.
- **An agent, on request.** `--agent` lists this computer's agent (made with `pipeup agent`) on the page and adds the
  agents add-on (§15d).
- **It offers to mark the page's blocks, charts and slides** with stable names, so comments stay attached when the
  page changes (§4). It proposes a short name for each part it finds, says what it took each part to be, and the author
  accepts, renames or skips each one; nothing is marked without that. It never renames a mark the page already has.
  `--yes` skips this step (it marks nothing) and `--marks` goes straight to it on a page already set up.
- It makes no network request, works the same for a page on disk or in a project, and never writes a stop key or
  anything secret into the page.
- Exit codes: 0 done (or nothing to do), 1 a file couldn't be read or written, 2 the command wasn't understood or needs
  something first.

### 15f. Reading a page's comments without a browser: `pipeup read`

*Built (0.8).* `pipeup comments` (§15c) reads what an open page shares over the live link. `pipeup read` reads
the comments an author can reach **without opening the page**: what reviewers sent back, the page's shared copy, and an
agent's replies.

- **`pipeup read <page.html>`** prints the page's comments as Markdown, the same as **Copy comments › As Markdown**, or with
  `--json` as data in the same form as `Pipeup.comments()` (§15b). Open threads only, unless `--all`.
- **Where it reads from:**
  - **feedback files** the author passes with `--from <file or folder>` (once per file or folder): sealed feedback files
    (§11), opened with the page's document identity, and files of exported comments. Given a folder, it reads every
    feedback file in it (not in folders inside it unless `--deep`), says how many it read, and names any it skipped
    and why (not a feedback file, another document's, unreadable);
  - **the page's shared copy**, when the page has a sharing line (§11): it asks the service the page names, and only
    that service; `--no-share` reads nothing from the network;
  - **the page's replies file**, if there is one: replies from agents the page lists (§15b).
- **Every comment is checked as strictly as the page checks one** (§11a, §14): one that is forged, altered or meant for
  another document is left out, and the command says how many, and why, in words. The same comment from two sources
  is shown once.
- **It can't read what is only in a reviewer's browser,** and says so when it finds nothing: those comments reach the
  author by Copy comments › As Markdown, a feedback file or sharing.
- It never writes to the page, the shared copy or the files it reads. With `--out <file>` it writes one merged feedback
  file the page can open, sealed for the document like any other.
- Before it contacts a shared copy it says which service it is about to ask; nothing else is sent anywhere.
- Exit codes: 0 done (including no comments), 1 a source couldn't be read, 2 the command wasn't understood or needs
  something first.

## 16. Distribution

- Published to **npm as `pipeup`** and served by **common public CDNs**, with every release at a
  fixed, permanent version.
- Each release says which version to pin and how to verify it.
- Pipeup is **as compact as possible**: it adds as little as it can to a page's download, every
  release states the size of Pipeup, of each add-on and of each combined file, and a release where
  any of them grows past its size budget is not published. Any change to a size budget is stated in
  the release notes.
- **Open source under the MIT licence.** The source, issues and releases are public on GitHub, and
  the website (with its Try pages and agent skills) is published alongside it.
- Versions follow semantic versioning, and add-ons are released with Pipeup at the same version.
  Until 1.0 the project is in **alpha**: the API may change between minor versions, and each release
  says what changed. **Comments written by any released version stay readable by every later
  version**, including comments already saved in reviewers' browsers.
- When a page meets comments from a newer version of Pipeup that it can't show, it says how many in
  words, rather than dropping them silently.
- **Pre-releases** can be tried before a milestone reaches everyone: installed from npm and the CDNs
  by their exact version or a `next` tag, with their own copy of the website, Try pages and agent
  skills at a separate address, clearly marked as a pre-release and not indexed by search engines.
  A pre-release never changes what a plain install gets, the stable website or the stable CDN
  address.

## 16a. Keeping Pipeup small

Pipeup's size is part of what it promises (§16). It grew from 36.8 KB (gzip) in 0.4.1 to 52.3 KB in 0.7.0, because reactions, mentions,
portable identities and the one-look-everywhere work all landed in it, and the budget rose to 56 KB to make room. 0.8 starts with a size pass.

- **Nothing a person relies on changes.** Every comment saved by any released version stays readable and verifiable; every
  control, shortcut, export and add-on slot works as before; the page and its authors see no difference except a smaller
  download. A size pass that changes behaviour is a different change and is specified on its own.
- **A lower budget.** The size of Pipeup alone (and of the file that includes it) comes down to **at most 50 KB (gzip)**, and
  the budget is lowered to match, so a later release can't quietly grow back. The add-ons' budgets stay as they are, except
  where a feature moves into one (below).
- **Features that few pages or people use may move into an add-on**, as agent support did in 0.7, but only with the maintainer's
  agreement and only if the move is invisible to anyone who doesn't use the feature:
  - **Portable identities** (the *My identity* menu row, recovery codes and files, sharing a way to be reached) become an add-on (approved; built)
    that the author includes when they want it. Without it the menu has no such row, the ordinary identity works exactly as today,
    and comments written under a portable identity are still shown and verified by Pipeup itself.
  - Reactions, mentions and the appearance work stay in Pipeup: most reviewers use them, and they shape what every page looks like.
- **Growth has to be paid for.** A change that adds more than 1 KB (gzip) to Pipeup says in its pull request what it removes or
  why it can't live in an add-on, and a budget increase is stated in the release notes (§16).
- **The size is reported in words.** Each release says the size of Pipeup, of each add-on, and of each combined file, and what the
  change was since the last release.

## 17. Out of scope for now

- Standalone images and PDFs as review targets.
- Accounts, sign-in by Pipeup itself, and email or push notifications sent by Pipeup itself (mentions
  and notifications through the page, the reviewer or an add-on are §10a).
- A relay run by the Pipeup project, and hosts other than Cloudflare.
- Rich text or attachments in comments (reactions are §7b).
- Drag-to-select an area as a comment target.
- Replies to a reply (every reply answers the original comment).
- Suggesting edits to the page text (tracked changes).
- Editing the page's own content together, live.
- Creating a shared copy from inside the page.

## 18. Release phases

1. **Comments on this machine** (shipped: 0.3 and 0.4): documents, slides and rich pages; all ways to
   start a comment (§5); reading, replies, resolve and copy for AI (§7, §7a); anchoring (§8);
   placement and motion (§9); check; agent skills.
2. **Public release** (shipped: 0.3.0): npm and CDN publication, verification guidance, open-source
   licence.
3. **Add-ons** (shipped together in 0.5, after tests with real services showed they work from a page opened from
   disk):
   - shared comments through a free service the author picks;
   - dictation;
   - live review and presence.
4. **Agents** (shipped: 0.6): reading and answering comments (§15b), the live link (§15c), installing the skills (§15a).
5. **Touch and narrow pages, and agents as an add-on** (0.7): §15d.
6. **The rest of the command-line tool** (0.8): `init` (§15e) and `read` (§15f) (`check` shipped in 0.7). **A size pass** (§16a).
7. **The author's relay** (later):
   - rooms on a relay the author owns;
   - invites shared separately;
   - closing rooms;
   - detecting missing comments.

## 19. Open questions

- How long inactive rooms live before expiring by default.
- How long shared copies last on free services, which services Pipeup suggests, and how much traffic
  is fair to ask of volunteer-run services.
- Whether dictation may ever use a browser maker's speech service, with the reviewer's agreement.
- Reactions: whether the quick row of six is right; whether the full picker should be an add-on or part of
  Pipeup if the size budget allows; whether agents' reactions should be shown at all.
- Update notices: whether the age line in the console is worth its bytes; what counts as the author's own
  context besides a file, localhost or the attribute (§14a).
- Mentions: whether a reviewer's email may be shown to others by default; how an inbox is kept from being
  flooded;
  whether any decentralised identity (a signed key, a handle on an open network) is worth supporting
  before the sign-in the page supplies.
- Agents add-on: whether the warning for a page that lists an agent without it should also appear in the menu for
  the author's own browser.

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
- 2026-10-07 — Roadmap renumbered: 0.4 shipped slides, views and keyboard; touch and drawer move to 0.5, the CLI to 0.6, add-ons to 0.7.
- 2026-10-07 — Tab in comment mode (0.4.1): Tab and Shift+Tab always move between blocks in comment mode,
  including when it was turned on with the mouse and after a click; the first Tab carries on from the block
  last clicked, commented on or under the pointer. Esc no longer puts the block cursor away: after a comment
  box and an open thread it leaves comment mode. The block cursor skips what can't be seen or clicked, the
  parts inside links and buttons, words styled inside a line of text, and tiny decorations.
- 2026-10-07 — Add-ons. Optional features are add-ons, each one more line or one combined file, and
  they work from disk:
  - shared comments through a free encrypted service the author picks, set up from the command line;
  - live review with presence, which each reviewer chooses to join;
  - dictation.

  Pipeup itself sends nothing. Each add-on says what it sends and to whom, and asks before sending
  where it needs agreement; while comments are closed, add-ons only change the control's words.
  Comments from elsewhere are checked like comments from a file, whatever add-on brought them; other
  promises cover the project's own add-ons, and add-ons from others run with the page's power. Each
  reviewer sends only their own comments to a shared copy, and comments written before sharing wait
  for their choice. Comments arriving from others never lose words being written or move the reader,
  and are announced briefly. Deleted words stay in copies others already received. Live review shows
  your network address to others who are live, and some networks can't connect directly. Comments
  from any released version stay readable. Rooms on the author's own relay become a later add-on.
  Peer to peer is now in scope; editing the page together is not. Phases renumbered to show what has
  shipped.
- 2026-10-07 — Roadmap renumbered: each add-on gets its own release, so one add-on waiting on its tests
  never holds back another: shared comments 0.7, dictation 0.8, live review 0.9; touch and narrow
  pages stay 0.5 and the command-line tool 0.6.
- 2026-10-08 — Add-ons built, so the spec now describes what ships on the add-ons branch: a resolved thread
  stays open, with a sentence saying so, while words are half-written in its reply line (§11); an add-on that
  can't work on a page (no speech engine, nothing configured) stays off and says why (§11a); an add-on's own
  spoken words ("Listening") are heard at once, while comments show.
- 2026-10-08 — Add-ons ship together in 0.5 (not in separate releases); touch and narrow pages move to 0.6 and the command-line tool to 0.7.
- 2026-10-08 — Comment boxes (popovers) are wider when the window has room (about 400 px on windows 900 px wide or more, 300 px otherwise); All comments keeps its own width. The comment control stays readable on a page whose accent colour is pale (its icon turns dark in comment mode), and Pipeup follows a page that switches between light and dark after it has started.
- 2026-10-09 — An open thread's popover always shows who wrote each comment, when, and Copy and Resolve, so it no longer grows under the pointer when hovered; and while a thread is open the chosen block's outline and naming bar step aside instead of sitting over it. (In the document column, details still ease open on hover.)
- 2026-10-09 — All comments is interactive: a row is a preview, and choosing it opens the thread out in the panel (reply, resolve or reopen, copy), scrolls the page to its place and draws a line from the open row to it; one thread open at a time; nothing opens on the page.
- 2026-10-09 — The name "AI assistant" is kept for AI replies (a person can't choose it), and a reply under it is drawn with a gently glowing ring, so it is plain at a glance that a model wrote it. An add-on can show a reply as it is being written at the end of a thread.
- 2026-10-09 — Assist reads the whole page, deck and notes a section at a time, keeps a short summary of each on the device, and checks likely sections in full before replying (see docs/design/assist.md).
- 2026-10-09 — Proposed (not built): a guide and a copy-ready template for making your own add-on, own-name publishing and names, the project's names reserved (section 11a).
- 2026-10-09 — Built: the guide (docs/ADDONS_GUIDE.md) and the template (libs/ts/addons/template). The project's add-on names are asked for, not enforced: a name can't prove who made an add-on, and refusing them would refuse the project's own.
- 2026-10-10 — Proposed (not built): a guide section for using add-ons inside a company, and a worked example add-on from "another company" (Send to Git, sending the feedback as Markdown to be filed in Git), not under the Pipeup project's names (section 11a).
- 2026-10-10 — Proposed (not built): an allow-list the author sets for which add-ons run, pinning and content-security-policy guidance, one bundled file for companies, and every agent-facing surface updated to apply them (section 11a). Said plainly as best effort.
- 2026-10-10 — Proposed (not built): how a company sets up the GitHub side of Send to Git (a GitHub App and a small service, or a bot token, or a webhook-started workflow), with a GitHub-backed reference service, a contract checker and a setup skill for agents (section 11a).
- 2026-10-10 — Built: the allow-list attribute, the guide and its page, the template's bundled file, the Send to Git example (stand-in and GitHub reference services, contract checker, try page), the setup skill, and every agent surface updated (section 11a).
- 2026-10-10 — The setup skill starts with a fast path to try Send to Git against a real GitHub repository on one computer (the person makes and keeps the token and starts the service themselves), and a copy-and-paste prompt starts it from the Add-ons page.
- 2026-10-10 — Proposed (not built): a second worked example, Save to GitHub (no server, no token: opens GitHub's new-file page filled in), a written guide to the ways of getting a review into Git, and one setup skill that covers both and keeps the person's own steps to one click each (section 11a).
- 2026-10-10 — Built: the Save to GitHub example (no server, no token), the guide's ways of getting a review into Git, the GitHub App helper (two button presses), and one setup skill for both examples (section 11a).
- 2026-10-11 — Proposed (not built): the skills are installed once as a Claude Code plugin or with one command for Claude Code and Codex, plus a skill for adding Pipeup that the prompts and other skills point to (section 15a).
- 2026-10-12 — Proposed (not built): pages hand their comments to an agent without copy and paste, agents answer in a replies file kept next to the page and signed by their own identity, and an agent can only mark a thread addressed, a person resolves it (section 15b). A live link on the same computer is left for later.
- 2026-10-12 — Loading the replies file is part of Pipeup itself, not an add-on; and a page says plainly when an agent is listed, offers a prompt to copy for the agent, summarises the agent's answers in All comments and offers Resolve or Still not right on an addressed thread (section 15b).
- 2026-10-12 — Proposed (not built): every agent surface (skills, llms.txt, Markdown copies, site prompts, the copied prompt) tells agents how to read and answer comments the same way: reply, mark addressed, never resolve (section 15b).
- 2026-10-12 — Approved. The prompt for an agent is offered on every page (section 15b).
- 2026-10-12 — Built: reading with `Pipeup.comments()`, the replies file and the agents the page lists, addressed notes with Resolve and Still not right, the prompt on every page, and `pipeup agent` / `pipeup reply` for agents; the size budget is 45 KB gzip (section 15b).
- 2026-10-12 — Replies appear by themselves: a page with a listed agent looks for new replies every few seconds while it is showing (and when it comes back into view), as well as on Check for replies (section 15b).
- 2026-10-12 — Proposed (not built): a live link between a page shown from the author's computer and an agent on it, started by one command and switched on by a click (Share with my agent), so the agent reads and answers comments without a browser or pasting (section 15c).
- 2026-10-12 — Built: the live link (`pipeup watch`, `pipeup comments`, the Share with my agent switch, replies reaching the open page), with the size budget at 46 KB gzip (section 15c).
- 2026-10-12 — The one-command installer (section 15a) can be part of the `pipeup` command line that agents already use (`pipeup agent`, `reply`, `watch`, `comments`), instead of a separate package; the skills it installs include answering comments (15b) and the live link (15c).
- 2026-10-12 — Built: the Claude Code plugin, `pipeup skills install|remove|list` (for you or one project, Claude Code and Codex, asking before replacing anything you changed), the pipeup-add skill, the version line on every skill, and the stale "arriving later" wording removed (section 15a).
- 2026-10-12 — Release phases: agents ship in 0.6; touch and narrow pages move to 0.7 and the rest of the command-line tool to 0.8.
- 2026-10-12 — Proposed (not built): Pipeup looks the same on every site; it has a light look and a dark look that both work, never mixed; the reviewer can choose Automatic, Light or Dark; its own surfaces never depend on the page's colours; and it falls back to its safe look if it can't read itself (section 9).
- 2026-10-12 — Approved: threads at rest in the column always sit on their own soft backing (section 9).
- 2026-10-12 — Clarified: Pipeup takes the page's font family and accent colour and nothing else of its styling; the reviewer's choice is the Look row in the menu; the author's setting is `data-pipeup-theme` on `<html>` (section 9).
- 2026-10-12 — Changed: no fall-back look. Under a faded page both looks lose about the same contrast, so switching can't help; Pipeup reports what the page does to it instead, in the console and in the check (section 9).
- 2026-10-12 — Proposed (not built): everyone is known by their name with a durable ID that can be backed up and restored, a cleared browser is a new person (marked "earlier"), two devices are linked only by the recovery code; a copy of the page picks up what was left behind and marks it seen; a person's inbox for mentions in documents they haven't opened (section 10a).
- 2026-10-12 — Approved: the GitHub add-on comes first for notifications, and an identity is backed up and restored with either a recovery code or a file (section 10a).
- 2026-10-12 — Proposed (not built): how an author learns of newer versions without Pipeup making any request of its own: an age line in the console, `pipeup check` and release notices, and an opt-in `updates` add-on that runs only in the author's context and shows console lines and, for major releases and security issues, a context-menu notice (section 14a).
- 2026-10-12 — The update list is signed by the maintainer from their own computer, and goes out of date after a set time, so a forged or old copy is ignored (section 14a).
- 2026-10-12 — Proposed (not built): agent support moves out of Pipeup itself into an `agents` add-on (reading replies, the live link, the prompt and the menu and All comments lines); comments for an agent, the addressed note and the AI marking stay; `pipeup watch` adds the add-on itself; pages on 0.6 are unchanged (section 15d, in 0.7).
- 2026-10-12 — Approved: the agents add-on ships in 0.7; `pipeup watch` refuses a page whose Pipeup is before 0.6, doesn't add the add-on to a 0.6.x page, and adds it to a newer one (section 15d).
- 2026-10-12 — Built: the agents add-on, `pipeup watch` adding it and refusing pages before 0.6, and the skills and site pages (section 15d).
- 2026-10-13 — Built (0.7): reactions with the `emoji` add-on; mentions, seen marks, same-name tags, portable identities (an ordinary identity still can't be exported, so *Make it portable* makes a new one), contacts and the by-hand email offer; the `github` add-on; the age line, the signing tools and the `updates` add-on. Not built: the inbox (section 10a) and `pipeup check`.
- 2026-10-13 — Built (0.7): the inbox, as the `inbox` add-on and the reference mailbox server's `pm2` (section 10a). Not built: `pipeup check`.
- 2026-10-13 — Draft for review: a size pass for 0.8 (section 16a): Pipeup alone down to 50 KB gzip, behaviour unchanged, portable identities possibly moving to an add-on. 0.8 also lists `check` as shipped in 0.7.
- 2026-10-13 — Approved: the 0.8 size pass (section 16a), with portable identities moving to an add-on.
- 2026-10-13 — Built (0.8): portable identities moved into the identity add-on (sections 10a and 16a); Pipeup alone is 49.9 KB gzip and its budget is 50 KB. The My identity row now sits with the add-ons' rows in the menu.
- 2026-10-13 — Draft for review: `pipeup init` (section 15e) and `pipeup read` (section 15f), the rest of the command line for 0.8.
- 2026-10-13 — Approved: `pipeup init` offers to mark blocks, charts and slides, the author accepting, renaming or skipping each (section 15e); `pipeup read` reads a folder of feedback files (section 15f).
- 2026-10-13 — Built (0.8): `pipeup init` (section 15e). Add-ons can't yet go inside the page with `--offline`; the command says so.
- 2026-10-13 — Built (0.8): `pipeup read` (section 15f). Without the page open, a thread's place comes from what the comment saved (slide, block name, quote), not from the page's layout.
- 2026-10-14 — Comments show whether comment mode is on or off, and **Hide comments** (a menu switch, remembered per page in this browser) puts them out of sight; this reverses the 2026-10-06 rule that comments show only while reviewing. Holding ⌘ (Ctrl elsewhere) pauses comment mode so the page can be used. With All comments open, clicking a comment on the page opens it in the panel instead of closing the panel (sections 5, 7 and 9).
- 2026-10-14 — All comments becomes the hub: the round button becomes the panel's footer while it is open, new comments are written in the panel, and comment mode leaves it open. Every thread is the same compact card (avatar, name, how long ago, words; actions at its top right, with ⋯ for Copy thread, Edit and Delete), in the column, beside a bubble, in the panel and in the drawer. The comment and reply boxes say "Comment (Reply) or add others with @" and have Cancel and Comment (Reply) buttons. The panel's header has no title: @ and ✓ are icon toggles (sections 5 and 7).
- 2026-10-14 — Built: the hub, the cards, Edit and Delete from ⋯, and the comment and reply boxes (sections 5 and 7). They add 1.6 KB to Pipeup (50.8 KB gzip), so its budget rises from 50 to 51 KB (section 16a): it is Pipeup's own UI, which every page shows, so it can't move to an add-on.
- 2026-10-14 — From review of the build: the panel stays open until it is closed (× or Esc), and a click on the page never closes it. @ and ✓ always show, with tooltips. An open card shows its quote once. A deleted comment goes away, and deleting a thread's first comment removes the thread. The pulse follows its content while the page scrolls (sections 5 and 7).
- 2026-10-14 — A thread open on the page moves into All comments when it opens, so the same thread is never shown twice (section 7).
- 2026-10-14 — Fixes from the walkthrough of every feature in every format: a mention of you stays inline in its sentence; Pipeup's messages appear beside the round button instead of the bottom centre (over decks' slide controls and phones' text); an open card or new comment in the column moves up clear of the round button; with no room beside a bubble (a phone, or the window's edge) the preview and thread sit below or above what they're about, never over it; the selection's comment icon sits past the end of the paragraph's text, so it never covers the line above. They add 0.4 KB to Pipeup (51.1 KB gzip), so its budget rises from 51 to 52 KB (section 16a).
- 2026-10-15 — All comments' two filters read plainly as on or off: each is a pill with an icon and a word, **@ For you** and **✓ Resolved**, grey when off and tinted with the accent colour when on. Hovering a closed card in the panel, or focusing into it, shows its actions (React, ✓ Resolve and ⋯) at its top right, as on every other card; they work without opening the card (section 7). They add 0.5 KB to Pipeup (51.6 KB gzip), inside its 52 KB budget.
- 2026-10-15 — The menu gets shorter and plainer: **Copy comments** is one row that opens to its two choices (As Markdown, As text), a second click instead of two rows, and **Look** is renamed **Theme** (section 7). Comment mode's pause moves from holding ⌘ (Ctrl elsewhere) to holding **Space** (section 5): ⌘-click opens a link in a new tab, Option-click pins (and downloads a link in some browsers), and Space is the one key that leaves a click alone. On the block cursor Space now pauses; Enter comments.
- 2026-10-15 — The comment control becomes a small square of frosted glass tucked into the bottom-right corner (flush with the edges, its top left rounded, no border), with the count inside a larger bubble; pointed at, it reaches left to show its shortcut instead of a tooltip above it (section 7). It covers much less of the page than the round button did.
- 2026-10-15 — In comment mode the comment control opens All comments (its footer has the switch and ⋯ for the menu); outside it, the menu as before. In All comments' filters, the @ and ✓ icons stand the same height, and each sits on the middle line of its word.
- 2026-10-15 — From the click-path review of 0.8.0-beta.2 (six testers: keyboard, mouse, slides, websites, touch,
  looks and assistive settings). **Tab from a comment box moves on**: an empty box closes on Tab or Shift+Tab and
  the block cursor moves in one press; a box with words goes through its own controls, then waits beside its
  block, dimmed, with a faint outline, and Enter or a click elsewhere takes you back to it. **Typed words are
  never lost** unless Cancel or Esc in the box throws them away, with Undo; replies being written are kept
  when their thread closes. Keys Pipeup acts on never reach the page; focus never drops to the page after an
  action; Delete can't be confirmed by a double-click; a card's hidden actions can't be pressed. On touch: 44 px
  targets, things fit the screen, Pin waits for the next tap, a touch hint with **Done**, and threads open
  without the keyboard. Decks: their own controls keep working in comment mode, any showing slide can be
  commented on, and decks that fit the window refit beside All comments. Long comments show a few lines at
  rest. Highlights stay readable over any colour, a page's accent is used only when readable, comments keep
  their text direction, and high-contrast modes keep every state visible (sections 5, 6, 7, 7a, 8 and 9).
- 2026-10-15 — Built from the click-path review's deck and website findings: a deck's own controls (reveal.js's arrows,
  progress bar and slide number) keep working in comment mode, any showing slide of a deck that scrolls can be
  commented on, decks refit beside All comments, the comment control sits above a deck's bottom-right controls, and
  copying reads the same whether or not a slide shows. On websites a click made while Space is held is the page's
  alone, Moved is shown, comment mode's hint waits for the menu and says how to pause, a new comment's box stays in
  the window, a comment outside a tab panel shows whichever tab is open, where-labels take the right section, and the
  naming bar names controls plainly (section 5); each thread has its own bubble, and All comments is a list under a
  heading (sections 5, 6, 7, 7a and 8).
- 2026-10-15 — Touch details found while building the phone fixes: only Done takes a tap on comment mode's touch
  hint, a screen with only touch shows no keyboard shortcuts, turning a phone brings an open thread or new comment
  back into view, and a long press on a reaction shows who gave it (sections 5, 7 and 7b).
- 2026-10-15 — The comment control's count stops at **9+** (it went to 99+), so it is never more than two characters
  and stays clear of the bubble's outline in any font; the exact number is in its name and its slide-out (section 7).
- 2026-10-17 — Pipeup keeps working while a page's own dialog is open, of any kind (a browser's modal dialog, a library's
  focus-trapping or inert-making dialog, an overlay at the top layer); while a browser's modal dialog is open, Pipeup's
  element sits inside it. While All comments is open, messages sit inside the panel above its footer, so they never
  cover a deck's own slide controls beside it (sections 7 and 9).
- 2026-10-17 — Pipeup also works in a web component's modal dialog and in an element shown fullscreen, and keys pressed in
  Pipeup never reach a page's dialog (Escape doesn't close it, Tab doesn't jump into it); page popovers and frames
  are named as limits (section 9).
- 2026-10-17 — The agents add-on's prompt names the page's Pipeup version in its commands, and a pre-release's guide (section 15b).
- 2026-10-17 — A comment whose content is found and showing shows on the page even when the page's reported view differs in some other way (a new revision), marked Moved when its content changed (section 8).
- 2026-10-18 — From the regression pass on 0.8.0-beta.5: on a deck, the comment control stays in its corner in fullscreen, in a page's dialog and beside a layer over the window; a page that sets its own width still makes room for All comments; on reveal.js a comment is filed under its own slide; a waiting comment on a slide Pipeup can't turn to says which slide it is on (sections 5, 6).
- 2026-10-18 — Also from the regression pass: ⌘Z (Ctrl+Z) takes the Undo after Esc or Cancel; Esc while an input method composes keeps the words; replies are kept in All comments, and its Esc throws them away with Undo; opening All comments keeps the caret in a comment being written; the block cursor stays inside an open modal dialog; Pipeup leaves a web component's dialog however it closes, keeps the caret through a dialog's re-render, and waits outside a dialog that is moved with a transform (sections 5, 7, 9).
