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
2. **The showcase**: a looping demo that swipes between a **document**, **slides** and a
   **website**, changing every 10 seconds, each showing a comment being added, with a cursor that
   moves only to act and holds still while the comment is typed. Each scene's page is laid out at
   full width; when the comment opens, the view slides sideways to make room, like a horizontal
   scroll. Visitors can **pause** it, jump to any of the three, or swipe on a touch screen. With
   reduced motion it doesn't move on its own. In comment mode the showcase is commented on as one whole block (its moving parts are never
   picked on their own), while its tabs, pause and Try keep working.
   Beside the showcase controls, a **Try** link follows the current scene (its accessible name says which:
   "Try the document", "Try the slides", "Try the website") and opens that example as a real page in the same tab.
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
   works from disk) on the left and one **For agents** link on the right. Clicking
   it opens llms.txt; hovering or focusing it (or a first tap on touch screens) shows a short
   menu of every agent file. That is the only agent link on the page. The
   page doesn't describe the project's release status.

There is no separate set-up section: the two actions cover it.

**For agents**: the site serves, at stable addresses and linked from the page and its footer:
a short guide (llms.txt), the guide and all agent skills in one file (llms-full.txt), the page
itself as Markdown, the agent skills, the script, a robots.txt that welcomes every agent, and
structured data describing Pipeup as software.

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
