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

## 3. Content (a home page that fits one screen, dense but calm, and a few pages one click away)

1. **First screen**, which is the whole home page: the footer follows it, with nothing else to scroll to on a
   1280 × 800 window. The headline "Feedback for any HTML.", one sentence on the value that also says comments stay
   in each person's browser until they send them, and the **showcase** beside them (tops aligned). Under the sentence,
   **four numbered steps**, in few words, take an author from their HTML file to their reviewers and back:
   - copy the prompt;
   - paste it into an AI (Claude, ChatGPT or any chat) with the HTML file, and save the file it gives back;
   - send that file with the AI's note; people comment in their browser and send their comments back;
   - paste their comments into the AI, which makes the changes.
   Each step is at most two lines on a computer. The first step holds the page's one main button, **Copy prompt**,
   with "One copy per page" and a quiet link ("What it says") that opens What your AI does. The third step ends with a
   quiet link to the reviewer help page ("How reviewing works"). The first screen has no other button and no choice
   of paths.
   **Copy prompt** copies exactly the prompt What your AI does shows, with a fresh document key made in the visitor's
   browser; every copy carries a key of its own, for one page. Its icon becomes a check and its label "Copied" for two
   seconds, then it eases back; screen readers hear that the prompt was copied. If copying isn't allowed, the button
   doesn't say "Copied": it opens What your AI does with the prompt's words selected.
   Under the steps is a line to **try it on this page**: the comment shortcut, shown the way the visitor's keyboard
   labels it; on a touch screen, the comment button in the bottom-right corner, then Start commenting, then a tap on
   anything. Under that, a quiet line for people adding Pipeup themselves ("Adding it yourself? The script tag,
   licence and size.") opens The details.
   At phone width the order is: headline, sentence, the try line, the showcase, then the steps, with Copy prompt at
   full width. Reading and keyboard order follow what is shown, and nothing scrolls sideways. The page's Markdown copy
   and llms.txt say the same in words.
   **The showcase**: a looping demo that swipes between a **document**, **slides**, a
   **website** and the **keyboard**, changing every 10 seconds, each showing a comment being added, with a cursor that
   moves only to act and holds still while the comment is typed. The keyboard scene uses no pointer
   at all: Pipeup's block cursor (its outline and naming bar) moves through a small page while each
   key pressed appears on screen with what it does, like a screencast's key overlay: the comment
   shortcut (Comment mode), Tab (Next block) twice, ↑ (Around it), ↓ (Back in), Enter (Comment, and
   a comment is typed), Enter (Send) and Esc (Done). Key captions ease in and out; the shortcut is
   shown the way the visitor's keyboard labels it. Each scene's page is laid out at
   full width; when the comment opens, the view slides sideways to make room, like a horizontal
   scroll. **It has a smallest size**, so its scenes are never cut off or squeezed: beside the headline it is never
   narrower than 440 px (a narrower window puts it under the headline instead), its scenes are never shorter than
   400 px, and its frame is a thin margin, so the scenes get the room. On a screen too narrow even for its
   smallest width (under about 350 px) it scrolls sideways rather than shrink further. Visitors can **pause** it, jump to any of the four, or swipe on a touch screen. With
   reduced motion it doesn't move on its own. In comment mode the showcase is commented on as one whole block (its moving parts are never
   picked on their own), while its tabs, pause and Try keep working.
   Beside the showcase controls, a **Try** link follows the current scene (its accessible name says which:
   "Try the document", "Try the slides", "Try the website"; the keyboard scene opens the document) and opens that example as a real page in the same tab.
   Only the scene on show reaches a screen reader, as one sentence saying what happens in it; the scenes not on show
   are hidden from it. It stops moving on its own while keyboard focus or the pointer is on it, and while the visitor
   is commenting on the home page, so a real comment never sits on a pretend one. On a touch screen its pointer is
   drawn as a fingertip. Focus rings on its controls are never cut off.
2. **What your AI does**, a page of its own (`prompt.html`), opened from the first step. It has the site's header (the
   logo leads home) and footer and its own Markdown copy; its words sit on the left, top-aligned with the prompt on the
   right (at phone width, the words first, then the prompt). One sentence (the prompt asks the AI to add Pipeup to the
   HTML file and change nothing else; there is nothing to install), then four short lines:
   - it adds one script line, and a key that keeps this page's comments apart from the author's other pages;
   - it gives back the whole file, which the author opens in a web browser: a comment button in the bottom-right
     corner means it worked;
   - it writes a note for reviewers, and for when it didn't, **a note for reviewers** in a labelled box with its own
     **Copy**. The note says:
     open the file in a web browser, since a preview in email, chat or a drive may not show the comments; turn on
     commenting from the comment button in the bottom-right corner (Start commenting); click or tap anything, or select
     some words, and type; when done, choose Copy comments › As Markdown and paste it into a reply. It says comments
     stay in the reviewer's browser until they send them, and ends with a link to the reviewer help page;
   - when the author pastes the comments people send, it makes the changes and gives the file again.
   A quiet line under them says each person sends their own comments, and that gathering everyone's in one place needs
   a service to hold them, with a link to Share.
   Beside them, **the prompt** in full in a labelled box: exactly the words Copy prompt copies, showing the key the copy
   carries, with its own **Copy prompt** that behaves the same way (if copying isn't allowed, its words are selected).
   The prompt asks the AI:
   - to add the pinned script, with its integrity hash, just before `</body>`, editing only the HTML file;
   - to add this copy's key to `<html>` and keep it as it is; the key is for this one page, and every other page needs
     its own;
   - to mark stable blocks, label charts and images, mark navigation, and leave the layout alone;
   - when it can't change the author's file, to hand back the whole new file and say to share that one, not the old one;
   - to tell the author to open it in a web browser and check for the comment button;
   - to give the note for reviewers word for word;
   - to add the agents add-on (an AI agent answering comments in the page) or the inline add-on (questions asked
     right in the content) only when the author asks, and if they asked for neither, to say in one line when it is
     done that both exist;
   - later, to apply each pasted comment, say what it changed, and give the whole file again.
2a. **The details**, a page of its own (`details.html`), opened from the first screen's quiet line, with the site's
   header and footer and its own Markdown copy; it fits one screen. One sentence (for adding Pipeup yourself, and what
   it does to your page), then five paragraphs of one or two sentences each, in plain words, each led by a few bold
   words and each saying its drawback; never a facts row, chips or tiles:
   - **By hand**: the two lines go on the page, and each page needs its own key. Browsers load Pipeup from jsDelivr,
     pinned by its integrity hash, or from a copy kept next to the page, which the site links.
   - **What it sends**: nothing. Comments stay in each reviewer's browser until they send them, so clearing browser
     data removes the ones not yet sent.
   - **What it does to your page**: it adds one element of its own and never restyles or moves the page, including
     pages a framework renders.
   - **Claude Code or Codex**: the install command, run once (it asks first), then "add comments to this page".
   - **Licence and version**: free and open source under the MIT licence, on GitHub; the version, linked to what
     changed; one file of its compressed size, with no dependencies. The version and size always match the copy of
     Pipeup the site carries, so they can't go out of date.
   Beside them, a box, **For your page**, with the two lines (the key on `<html>` and the pinned script line) and its
   own **Copy**: each copy carries a fresh key, it says "Copied" the same way, and the words are selected if copying
   isn't allowed. Its Copy sits above the code, never over it.
3. **The reviewer help page**, `add-comments.html`, for people who were sent a page. It is linked from the first
   screen's third step, the note for reviewers and the reviewer prompt; it is not a door on the home page. It has the
   site's header and footer (the logo leads home; there is no separate back link) and its own Markdown copy. Its
   heading ("Someone sent you a page to comment on.") and sentence ("Comment right on it in your web browser, then
   send your comments back. No account needed.") sit on the left, top-aligned with an animated scene on the right,
   above four one-line steps:
   - open it in a web browser (Chrome, Safari, Edge or Firefox); a preview inside email, chat or a drive may not show
     the comment button;
   - turn on commenting: the comment button in the bottom-right corner, then Start commenting, or the comment shortcut;
   - comment: click anything, or select some words, and type;
   - send them back: the comment button, then Copy comments › As Markdown, pasted into a reply to whoever sent the page.
   On a touch screen the steps say tap (and press and hold on words). Under them, a quiet line says comments stay in
   this browser until they are sent, nobody else sees them, and clearing the browser's data or closing a private
   window removes them. A last quiet line covers a page with no comment button: ask the sender for the version with
   comments built in, or add it to your own copy. That eases open two options, each shown in full before copying: the
   reviewer prompt for an AI ("only if you're allowed to share the file with an AI"), with its Copy prompt, and the
   pinned script line to paste before `</body>`, with its Copy. The reviewer prompt asks the AI for the whole new file
   when it can't change the reviewer's copy, and to say to open it in a web browser.
   The scene shows two stories in turn, an email and then a Slack message, each ending with the reviewer replying: the
   file opens in a browser tab, the pointer chooses the comment button and Start commenting, a comment is typed on a
   paragraph, Copy comments › As Markdown is chosen, and the comments are pasted into a reply. The pointer always moves
   to what it acts on before it presses. The scene can be paused; it is light, eases everything, pauses when out of
   view, and with reduced motion shows its finished moment. The whole page fits one screen with no scrolling.
   `create-html.html` is retired: its address opens the home page's steps by itself, and shows one plain line ("Making
   a page to share? Adding Pipeup is now on the home page.") with a link, in case it can't. Its Markdown copy points to
   the home page's.
4. **Try pages**: one real example each, running Pipeup, each with a very different look so
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
5. **Footer**: always at the bottom of the window, with no facts line (The details and the Markdown copy say
   what matters), and on the right an **Add-ons** link shown as a soft violet pill with a puzzle-piece icon (so it stands out) and one **For agents** link. Clicking
   it opens llms.txt; hovering or focusing it (or a first tap on touch screens) shows a short
   menu of every agent file. That is the only agent link on the page. The
   page doesn't describe the project's release status.

Set-up is the first screen's steps, with What your AI does and The details one click away; there is no other set-up
section. The one other page on the path is the reviewer help page, for people who were sent a page.

**Add-on safety, for agents**: wherever the site tells an agent to add an add-on (llms.txt, llms-full.txt, the integrate
skill, the Add-ons page's prompts and its Markdown copy, the guide page and its Markdown copy), it also tells the agent to pin
the script with its integrity hash, to put only the add-ons the author asked for in the allow-list attribute, and to
suggest a content security policy to the author. It says this is best effort.

**For agents**: the site serves, at stable addresses and linked from the page and its footer:
a short guide (llms.txt), the guide and all agent skills in one file (llms-full.txt), the page
itself as Markdown, the agent skills, the script, a robots.txt that welcomes every agent, and
structured data describing Pipeup as software.

**Link previews**: a link to the home page or a Try page shared in a chat app or social site
unfurls with a large preview image (the Pipeup mark, the name and "Feedback for any HTML", in the
site's light look), a title and a description. The pre-release copy's previews use its own image.

### Add-ons page

Optional add-ons have a page of their own, reached from a quiet "Add-ons" link in the footer. The first screen is
about the core, which is what most people use; the one exception is the prompt (What your AI does), which names
Agents and Inline for an agent to add when the author asks. The page:

- Says first that the core needs none of them and sends nothing anywhere, and that an add-on is an extra step the page's
  author chooses, never something a reviewer is moved into.
- **Is a page of small cards, not one long scroll.** Each add-on is a card with its **title**, **one sentence** on what it
  does, and a **picture** of it at work, in the site's look. The cards sit in a grid in three groups: **From Pipeup** (Share,
  Voice, Live, Assist, Agents, Inline, Emoji, Inbox, GitHub, Identity, Updates), **Run your own** (Your own mailbox, Make your own)
  and **Examples from another company** (Save to GitHub, Send to Git, each labelled "Example: not from Pipeup").
- **Each card has a Copy button.** With one thing to copy it copies it straight away (Copy prompt, Copy command); with more,
  it opens a small menu to choose from: **Copy prompt**, **Copy script tag**, and for Share **Copy command to try it here**.
  The button says "Copied" for a moment. The menu works from the keyboard (arrows, Esc) and closes on a click elsewhere.
- **Clicking anywhere else on a card opens that add-on's own page** (Make your own opens the guide page). The whole card
  responds to the pointer, and its title is the link for the keyboard and screen readers. Old links to an add-on's place on
  the long page (`addons.html#voice`) land on its card.
- **Each add-on has a page of its own** (`addons/<id>.html`), with a back link ("← Add-ons") and, in plain words: what it
  does, **what it sends and to whom**, what the reviewer is asked first, what it needs, its buttons (Copy prompt, Copy script
  tag, Try it, and where they apply Read the guide or Read the source), and its animated demo or, for one without, its
  picture. Each page has its own Markdown copy (`addons/<id>.html.md`), and the Add-ons page's Markdown copy lists every
  add-on in one line with a link to its own.
- What some add-on pages also say: Share, that the author picks the service (a
  PrivateBin or their own mailbox) and that it never picks one for them; Live says it is peer to peer and asks each
  reviewer before connecting; Voice says speech is handled by the browser's own engine, which may send audio to its
  maker; Assist says nothing is sent (the model runs on the reviewer's device, and the browser may download it once) and that each reviewer is asked first.
  Inline says nothing is sent (answers are ordinary comments, kept and sent like the page's others), that nothing is
  asked of the reviewer first, that the author writes each question into the page with a fallback for anyone without the
  add-on, and that each reviewer sees others' answers counted only after answering.
  - **Your own mailbox** (no demo), for the small server that Share can use instead of a public service: what it sends (sealed comments, to a server the author runs), what it needs (Node 22 or newer, an HTTPS proxy), a Copy command button and a link to its guide. It says it is not a page script and that Pipeup runs no mailbox for anyone. Share's page links to it.
- Shows the add-ons that have one with a short looping animated demo on their page, in the same style as the home page's showcase (a cursor that moves only to act, comments typed out, gentle easing): Share (two browsers, a comment sealed and passed across), Voice (a comment dictated and checked), Live (two named cursors and the people present), Assist (a comment, then inside its card, under the comment as Pipeup shows replies: the assistant's quiet reading line, then its reply, only a short line and a slide pill whose card shows the related sentence). Each has a "Copy prompt" button that copies a ready-to-paste prompt for an AI agent to add that add-on by editing only the HTML file (nothing to download or run; the sharing address is asked of the person, never invented). With reduced motion each demo shows its finished moment.
- Says, in one line near the top, that people can make and publish their own add-ons, and links the guide (docs/ADDONS_GUIDE.md); Pipeup's own list is unchanged.
- Has a **Try it** link on each add-on's page, leading to a try page for that add-on (see "Add-on try pages" below), whose bar leads back to the add-on's page.
- Flows the full width of the window like the home page: the cards fill the width in as many columns as fit (one on a phone),
  and an add-on's page has its words beside its demo or picture.
- Carries a "beta" note while the add-ons are pre-releases, and says the core alone stays the stable choice.
- The **Make your own** card leads to the guide page, and its Copy button copies the template command. The guide says: who it is for (anyone, including a company
  with its own add-ons), that nothing needs the Pipeup project's permission and that Pipeup doesn't vouch for add-ons
  from anyone else; a **Read the guide** button to the guide page, and a **Copy command** button that copies the one
  command that makes a copy of the template.
- The **two examples from another company** are each clearly labelled "Example: not from Pipeup"; each one's page has a
  short animated scene of its menu row and consent note, a **Try it** link to its try page, a link to its source in the
  repository, and a **Copy prompt** button (a prompt for the person's AI agent that sets the example up with them, following
  the setup skill: it asks which repository, never asks for a token in the chat or a page, and leaves approvals to the
  person):
  - **Save to GitHub** (needs no server and no token): opens GitHub's new-file page with the review filled in. Shown first,
    because it is the quickest to start.
  - **Send to Git** (needs the company's own service): sends a review's feedback to the company, where it is filed in Git as a
    Markdown file. Its prompt asks whether to try it on this computer first or set it up for a team.
- Is light mode, eases like the rest of the site, can be commented on like the rest of the site, and works without
  scripts of its own.
- Gives agents the safe way to add an add-on on every surface: each add-on's Copy prompt and Copy script tag add the
  pinned script with its integrity hash and list only that add-on in the page's allow-list attribute, and say what
  to tell the author about a content security policy; the Markdown copy of the page, llms.txt and the agent skill say
  the same.
- Is described in llms.txt: add an add-on only when the author asks, tell them in plain words what it sends, and never
  choose a sharing service for them. llms.txt names each add-on's own Markdown copy, so an agent reads only the one it needs.
- llms.txt and the integrate skill name Agents and Inline as the two add-ons authors most often want (an AI agent answering
  comments; questions asked right in the content), still added only when the author asks.

### Add-on try pages

Each add-on on the Add-ons page can be tried for real, on a page of its own that runs Pipeup with **that add-on and
no other**. They are made like the existing Try pages (a short example, a slim bar back to the site, commentable like
the rest of the site) and are reached from a **Try it** link on the add-on's card.

- **A short "what to do" at the top** of each page: the two or three steps to see the add-on work, what it sends and
  to whom (the same sentence as its card), and what it needs (a browser, a second window).
- **The add-on is the site's own copy**, the same version the card shows, so a try page never changes under a
  visitor. The pre-release copy's try pages use the pre-release add-ons.
- **Commands that run Pipeup work anywhere an agent does**: on the stable site they are `npx --yes pipeup@0 …`, which
  never stops to ask and takes any release npm will give (some computers only accept packages a few days old). On the
  pre-release copy every such command names its version (`npx --yes pipeup@0.8.0-beta.4 watch …`), in the pages, their
  Markdown copies, the skills and `llms.txt`, since any stable release wouldn't match the pre-release a page there uses.
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

### The guide page

The guide for making your own add-on has a page on the site, `addons-guide.html`, reached from the Add-ons page's "Make
your own" card, and kept focused like the Add-ons page: the same header and footer, a back link ("← Add-ons"), and its
own Markdown copy (`addons-guide.html.md`) that says the same as the page (it is the repository's guide, shown two ways,
so the two never differ). It:

- Reads top to bottom in the guide's order: what an add-on is; what it can do (a small table of the slots, one line
  each); what it can't do; **what an add-on works with** (the document's threads and comments, hearing changes, the
  signed comments, signing, and what stays fixed between versions); saying what you send; names; trying and testing it
  with the template; **using add-ons inside a company** (first, whether the Share add-on with the company's own
  mailbox is enough; then hosting your own script, pinning it, who decides what runs, reviewing it, the sentence
  reviewers see); the worked example and its integration contract; and what the project stands behind.
- Has, in its company section, how to set up the GitHub side of Send to Git (the options, best first, and what the company's own
  service does), links to the reference service and the contract checker in the repository, and a line telling people
  they can hand the setup skill to their agent. The skill is served like the other agent skills and listed in llms.txt
  and llms-full.txt.
- Shows its code in readable blocks that can be copied, and links the template and the example in the repository.
- Says plainly, near the top and again at the end, that add-ons from anyone else run with the page's full power and
  that Pipeup doesn't vouch for them.
- Is light mode, eases like the rest of the site, can be commented on, and works without scripts of its own beyond
  copying a command. llms.txt, the agent skill and the npm README point to it, so an agent asked to make an add-on
  finds it.

### The example add-ons' try pages

Each example has a try page like the other add-ons' (a short example document, the comment shortcut, a "what to do" box). It
runs Pipeup with the example loaded from the site's own copy, standing in for a company. The page says this is an example of
an add-on from another company, and that the reviewer is asked first as with any add-on.

- **Send to Git**: the service address it is given is a demonstration one: pressing **Send to Git** shows, in a panel,
  exactly what would be sent and says nothing left the browser.
- **Save to GitHub**: pressing **Save to GitHub** shows, in a panel, the address it would open and the file it would fill in
  (nothing is opened in demonstration mode), and offers **Open it for real** in a repository the visitor names, to see GitHub's own page.

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
- **The animations show Pipeup as the version the site carries draws it.** In the home showcase and the add-on demos,
  the comment box, the card a sent comment becomes, the selection's comment icon, the block outline and its naming bar
  look and sit where Pipeup puts them: today the box with its rounded line and Cancel and Comment, the compact card
  (who, how long ago, its actions at the top right, the words, and a line to reply), the icon just past the end of the
  paragraph's text, and the naming bar with Around it and Pin. When Pipeup's look changes, the animations change with it.

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
- 2026-10-09 — Built: Try it pages for Voice, Live, Assist and Assist on slides; Share's card gives a local-demo command. Live's page asks for a second browser or private window (two tabs of one browser are one person), not a second window of the same browser.
- 2026-10-10 — The home page is rebuilt around the two ways people meet Pipeup (someone sent me a file; I'm making a page to share): two animated scenes on the first screen and a walkthrough for each, with a Copy prompt written for each. The showcase and the Install menu are gone from the first screen; the footer, For agents menu and GitHub link are unchanged.
- 2026-10-10 — The home page goes back to the feature showcase on the first screen, with two buttons (Add comments to an HTML; Create comment-enabled HTML) that scroll to a walkthrough and animated scene for each way people meet Pipeup. It replaces the two animated doors; the footer, For agents menu and GitHub link are unchanged.
- 2026-10-10 — The two scenario buttons lead to pages of their own (Add comments to an HTML; Create comment-enabled HTML), each with a back link, instead of scrolling the home page; the text is top-aligned with its animation.
- 2026-10-10 — The footer's Add-ons link is a soft violet pill with a puzzle-piece icon so it stands out; the icon tilts a little on hover.
- 2026-10-10 — The two walkthrough pages are denser: briefer words and four one-line steps beside the animation, so each fits one screen with no scrolling.
- 2026-10-10 — On the walkthrough pages, the file in every scene is drawn as an HTML file: a larger page icon with a folded corner, a code mark and an orange HTML badge (bigger still on the Slack file card).
- 2026-10-10 — Proposed (not built): a guide page on the site with a Make-your-own card on the Add-ons page, a worked example add-on from another company (Send to Git) with its own card and try page, and a company section in the guide.
- 2026-10-10 — Proposed (not built): every agent-facing surface tells agents to pin add-on scripts, set the allow-list attribute and suggest a content security policy.
- 2026-10-10 — Proposed (not built): the guide page covers setting up the GitHub side of Send to Git and points to the setup skill, the reference service and the contract checker.
- 2026-10-10 — Built: the guide page (addons-guide.html, one source with its Markdown copy), the Make-your-own and Send to Git cards on the Add-ons page, the Send to Git try page, and the add-on prompts and Markdown copies carry the integrity hash, the allow-list and the policy advice.
- 2026-10-10 — Send to Git's card has a Copy prompt that has the person's AI agent set it up with them; the setup skill has a ten-minute fast path to try it on one computer first.
- 2026-10-10 — Proposed (not built): the Add-ons page shows two examples (Save to GitHub, Send to Git), each with a Copy prompt, and each has a try page.
- 2026-10-10 — Built: the Add-ons page shows Save to GitHub and Send to Git (each with a Copy prompt, a scene and a try page).
- 2026-10-11 — Proposed (not built): the install commands (plugin and one-command installer) come first wherever the site offers the copy-and-paste prompt, which stays as the fallback; llms.txt and the Markdown copies lead with the install line too (FUNCTIONAL_SPEC 15a).
- 2026-10-12 — Proposed (not built): llms.txt, llms-full.txt, the Markdown copies and the site prompts carry the same instructions for answering comments (FUNCTIONAL_SPEC 15b).
- 2026-10-12 — Built: the install commands in the README, llms.txt and the Markdown copies lead with the prompt as the fallback; on the "create HTML" walkthrough the one-command install sits as a quiet line under the steps, below the Copy prompt step, so the page still fits one screen.
- 2026-10-15 — The home showcase and the add-on demos draw Pipeup as the current version does: the comment box with its rounded line and Cancel and Comment, settling into the compact card once sent (how long ago, actions at the top right, a line to reply); the selection's icon just past the end of the paragraph's text; the naming bar with Around it and Pin. In the Assist demo the reading line and the reply sit inside the comment's card, not in boxes of their own. A new rule keeps the animations in step with Pipeup's look (section 5).
- 2026-10-15 — The Add-ons page becomes a page of small cards in three groups (From Pipeup, Run your own, Examples from another company): each card has a title, one sentence, a picture and a Copy button (straight away for one thing to copy, a menu for more); a click anywhere else opens the add-on's own page. Each add-on's page holds what the long page said about it (what it sends, what it asks, its buttons and demo), with its own Markdown copy; llms.txt and the Markdown copies point to them, and the add-on try pages lead back to their add-on's page.
- 2026-10-15 — The showcase has a smallest size: never narrower than 440 px beside the headline, scenes never shorter than 400 px, a thinner frame, and a sideways scroll on screens too narrow for it, so no scene is cut off or squeezed. The keyboard scene's heading has room for the naming bar beneath it.
- 2026-10-15 — The footer and the home page's Markdown no longer state Pipeup's size: it changes with every release, and it had fallen out of date. The facts line keeps "One file".
- 2026-10-15 — The footer's facts line goes altogether (One file, No dependencies, Works from disk, Stays on your device): it read as marketing. The footer keeps only its Add-ons and For agents links, on the right.
- 2026-10-17 — On the pre-release copy, commands that run Pipeup (`npx pipeup …`) name the pre-release's version, so an agent following its skills runs the same release as the page.
- 2026-10-19 — Commands that run Pipeup are `npx --yes pipeup@0 …` on the stable site (never asking, any release npm will give), and name the pre-release on the pre-release copy (FUNCTIONAL_SPEC 15b).
- 2026-10-24 — A Quick start section on the home page, under the first screen: three steps and the prompt shown in full, with one Copy prompt button. It reuses the "Create comment-enabled HTML" prompt, whose first line now fits an existing page too; every Copy prompt button eases back from "Copied".
- 2026-10-27 — Each Copy prompt carries a document key of its own, and the prompt and the steps say a key is for one page only ("one copy per page"): reusing one prompt for several pages gave them all one key, so one page's comments showed on another (usability study, 27 October).
- 2026-10-27 — One front door again (usability study, 27 October; visual spec docs/design/one-front-door-mockups.html). The first screen's two buttons become four numbered steps with one Copy prompt, covering the whole trip from the author's file to reviewers and back, and the sentence under the headline says each person's comments stay in their own browser until they send them. Quick start becomes What your AI does, with a note for reviewers that has its own Copy, and the prompt asks the AI for the new file, a reminder to open it in a browser, and that note. A new The details section gives the two lines to add by hand, what Pipeup sends and does to a page, the skills, and the licence, version and size, which always match the copy the site carries. add-comments.html becomes the reviewer help page, linked from the steps and the note; create-html.html is retired and its address opens the home page's steps. The showcase reads one sentence per scene to screen readers, holds still under focus, the pointer or while the visitor comments, and draws a fingertip on touch screens.
- 2026-10-27 — The home page fits one screen (visual spec docs/design/one-screen-home-mockups.html): What your AI does and The details become pages of their own (prompt.html, details.html), opened from the first screen's quiet links, and the first screen and The details say the same in fewer words. If copying the prompt isn't allowed, What your AI does opens with its words selected.
- 2026-10-31 — The home page's prompt (What your AI does), llms.txt and the integrate skill name Agents and Inline as the add-ons authors most often want, added only when the author asks; if they asked for neither, the agent says in one line that both exist. This ends "the Copy prompt stays core only" (2026-10-08) for that one prompt: answering comments with an agent and asking questions in the content are what most authors who make a page want next. The Add-ons page gains an Inline card and page (sends nothing, asks nothing first). Live with the release that ships Inline.
