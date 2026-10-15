# Changelog

All notable changes to Pipeup are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pipeup uses
[semantic versioning](https://semver.org/). Until 1.0 the project is in alpha: a minor version can
change the API and the stored comment format.

## [Unreleased]

### Changed

- **Comments show whether comment mode is on or off.** Highlights, bubbles and the column can be read and opened without turning comment mode on, and the rest of the page works as normal. **Hide comments**, a new switch in the menu, puts them out of sight; the choice is remembered for that page in this browser.

### Added

- **Hold ⌘ (Ctrl elsewhere) to pause comment mode.** While the key is held, the outline and picking cursor go and the page works as normal, so you can click through it to what you want to comment on. Letting go brings comment mode back.
- **A standby signing key for the update list.** The `updates` add-on also trusts `k2`, kept offline, so if the current key is ever lost or leaked the list can be signed with `k2` without a new add-on release.

### Fixed

- **All comments no longer closes when you click a comment on the page.** Clicking a comment's highlighted words, bubble or column thread while the panel is open now opens that thread in the panel. Before, the panel closed: depending on the case, the thread opened on the page instead, or nothing opened at all.

## [0.8.0-beta.1] - 2026-10-13

This pre-release is about a smaller Pipeup and the rest of the command line: Pipeup alone is 48.8 KB gzip (52.3 KB in 0.7.0), portable identities are an add-on, and `pipeup init` and `pipeup read` join `check`. It is a beta: try it from the `next` channel and tell us what breaks.

### Changed

- **Portable identities are an add-on, `@pipeup/identity`.** *My identity* (making an identity portable, its recovery code and file, using it elsewhere, and sharing a way to be reached) moved out of Pipeup, so pages that don't need it download less: Pipeup is 49.9 KB gzip (52.3 KB in 0.7.0) and its budget drops from 56 to 50 KB. A leaner build (the classic script without CommonJS interop, the stylesheet after the code, ASCII-only output) brings it to 48.8 KB, with no change in behaviour. Comments written under a portable identity are still shown and verified, with or without the add-on, and a browser that holds one keeps writing as it. With the add-on, the *My identity* row sits with the other add-ons' rows in the menu. `pu.document.identityCode()` is gone; `pu.document.seed()` returns a portable identity's seed.

### Added

- **`pipeup init <page.html>`** adds Pipeup to a page in one step: the script pinned to this version and its integrity hash, and a document identity if the page has none (it never changes one). It says what it will change and asks first, and leaves every other byte as it was. `--update` moves a page to this version, `--offline` puts Pipeup inside the page, `--addon <id>` adds an add-on (saying what it sends, and asking for what it needs), and `--agent` lists this computer's agent. It then offers stable names for the page's headings, figures, tables, images and slides, one at a time, for you to accept, rename or skip (`--marks` goes straight there). Nothing is fetched.
- **`pipeup read <page.html>`** prints a page's comments without opening it, as Markdown (like Copy as Markdown) or `--json`: from feedback files and folders of them (`--from`, `--deep`), the page's shared copy (with `@pipeup/share` installed; it sends nothing) and its replies file (only from agents the page lists). Every comment meets the page's checks; what was read, skipped or left out is said on standard error. `--out` writes one merged feedback file.
- Two add-on slots: `host.openDialog(content, label)` (capability `dialog`) and `host.identity` (capability `identity`).

## [0.7.0] - 2026-10-13

This release is about talking to each other: reactions, mentions, identities that can move, and agents as an add-on; plus Pipeup that looks the same on every site, works with a finger, and a check for pages. It folds the two betas, 0.7.0-beta.1 and 0.7.0-beta.2.

### Fixed
- **Pipeup follows the page's light or dark look wherever the page makes the change**, not only on `<html>` and `<body>`: it reads the background actually painted behind its column and panel, and the page highlights now switch together with the rest of Pipeup (they used to keep the look they started with). An author can set the look with `data-pipeup-theme="light|dark"` on `<html>`.
- **Pipeup reads modern colours** (`oklch()`, `color()`, `color-mix()`) when it works out whether the page is light or dark, so pages written with them are no longer misread.
- **It tells you what the page does to it.** Styles on `<html>` that fade, filter, blend, transform or zoom everything under it can't be undone from inside Pipeup, so Pipeup says so once in the browser console, and says when its words may be hard to read. `pu.appearance()` returns the same facts (its look, who chose it, the contrast, the effects) for `pipeup check` and agents.
- The AI avatar's ring no longer pulses and the "writing" dots are gone; an agent's reply still shows as it is written, with "AI assistant · writing now" under it. Add-ons that want their own flourishes can add them with `host.addStyles`.
- Threads in the column always sit on their own soft backing, so their words stay readable on any page.
- A right-to-left page no longer flips Pipeup's layout.
- **A Look choice in the menu** (Automatic, Light or Dark), kept in the browser, beats the author's setting and the page. The size budget rises from 46 KB to 56 KB gzip, for this and for the reactions, mentions and touch work.
- Faint grey text is darker (light look) and lighter (dark look) so every text colour reaches 4.5 to 1 on its surface.

### Changed
- **On touch screens the menu's rows are at least 44 px tall and buttons at least 36 px**, so they are easy to hit with a finger.
- **Agent support is now an add-on, `@pipeup/agents`.** Reading an agent's replies file, the live link started by `pipeup watch`, and **Copy a prompt for my agent** moved out of Pipeup into it, so pages without an agent no longer download them. What stays in Pipeup: `Pipeup.comments()`, Copy as Markdown, the addressed note with Resolve and Still not right, and the AI marking. A page that lists an agent (`data-pipeup-agents`) without the add-on says so once in the browser console. Replies files, signed replies and the command line are unchanged. Pages pinned to 0.6.x keep their built-in support. **`pipeup watch` adds the add-on itself** to the page it shows (from the copy that ships in the `pipeup` package; the page's file is not changed), refuses a page whose Pipeup is before 0.6 with a message saying what to change, and adds nothing to a 0.6.x page, whose Pipeup already has agent support.

### Added
- **`pipeup check <page>`** says what Pipeup changes or covers on a page, at three widths, and warns when the page has no viewport setting (phones would show it zoomed out).
- **The update list is signed**, and the first signing key is published in `tools/updates-keys.json`, so the `updates` add-on can verify it.
- **Mentions.** Typing `@` in a comment or reply lists the people in the document (everyone who has commented or reacted), the agents the page lists, and people a page or add-on supplies (`Pipeup.setPeople`); the choice is stored with the comment, signed with it, and shown as a tinted name. When a comment names you, Pipeup says so once ("Sam mentioned you in 1 comment"), All comments gets a **Mentions of me** switch, and opening the thread marks it **seen** (a signed `seen` op, so your other devices know). Two people with one name show with a short tag (`Sam · 4F2A`) so they can be told apart, in comments, reactions and exports.
- **Portable identities.** **My identity** in the menu: an ordinary identity can't leave the browser, so *Make it portable* makes a new one from a 32-byte seed you keep as a recovery code (`PU1-…`, with a checksum) or a `.pipeup-id` file; *Use a recovery code* brings that identity to another browser or computer. Comments written before stay under the old identity. Ordinary identities are unchanged and still can't be exported.
- **Let people reach you.** In **My identity** you can share an email address or a GitHub name (`gh:name`) with everyone who has the comments (two new signed op kinds, `contact` and `uncontact`; you can stop sharing). After a comment that mentions someone who shared an email, Pipeup offers to open your own mail with the words and the page filled in; it sends nothing itself.
- **The mentions inbox.** `@pipeup/inbox` leaves a sealed note for each person you mention at an inbox service the page names (`data-pipeup-inbox`), so they find it from any browser that holds their identity (**Mentions waiting** in the menu). The service is the reference mailbox server, which now speaks a second contract, `pm2` (`PUT/GET /i/<inbox>/key`, `POST/GET /i/<inbox>`, `DELETE /i/<inbox>/<note>`): it stores ciphertext it can't read, from senders it can't name, with a small proof of work per note, a note limit per inbox, and deletion only by the owner's signature. `pm1` is unchanged.
- **`@pipeup/github`**: when a comment mentions someone reachable on GitHub, a menu row opens GitHub's new-issue page on the page's repository (`data-pipeup-github-repo`) with their @name, the words and the page filled in.
- **`@pipeup/updates`** and the **update list**: on the author's own computer (a file, localhost, or `data-pipeup-updates="on"`), the add-on reads the project's signed `updates.json` once a day and says in the console, and in the menu for security fixes and major releases, when a newer Pipeup is out. A Pipeup over a year old also says so once in the console, with nothing sent. `tools/make-updates.mjs` and `tools/sign-updates.mjs` (a key in the macOS Keychain) make and sign the list.
- **Reactions on comments.** A **React** button in a comment's details opens a quick row of six emoji (👍 ❤️ 😂 🎉 😮 🙏); each emoji shows under the words with how many gave it, yours marked, and pointing at one says who. Choosing one again takes it back. Resolved threads show their reactions but don't change them. A person has at most one of each emoji on a comment, and a comment holds at most 12 different ones. Reactions travel with the comments (two new signed op kinds, `react` and `unreact`, that older copies of Pipeup ignore), appear in Copy as Markdown and Text, in `Pipeup.comments()` and in All comments, and a listed agent may react. The full emoji picker is the new `@pipeup/emoji` add-on (search, the groups phones use, recently used, a skin tone; 31 KB gzip, nothing sent anywhere), which adds a **More** button to the quick row; it relies on a new add-on slot, `host.setReactionPicker` (capability `reactions`).
- **Add-ons can add a line under the All comments header**, with one optional text button (`host.setListNote`, capability `listnote`). It eases in and out and goes with the add-on. An add-on that needs it stays off, with its reason, on a Pipeup that doesn't have it.

## [0.6.0] - 2026-10-12

This release is about agents: they can read a page's comments, answer them, and be installed in one step.

### Added
- **Install the skills once.** A Claude Code plugin (`/plugin install pipeup --marketplace pipeup-ai/pipeup`) and `npx pipeup skills install` for Claude Code and Codex (`~/.claude/skills`, `~/.agents/skills`, or `--project`). It says what it will write, asks first, never replaces a skill you changed (unless `--replace`), and `skills remove` takes them out. The skills ship inside the `pipeup` package and make no network request.
- A new skill, **pipeup-add** ("add comments to this page"): the short, ordered steps (pinned script with its integrity hash, document identity, no add-ons unless asked, the allow-list). The integrate skill is now the full reference. Every skill says which Pipeup version it was written for.
- `tools/sync-skills.mjs` keeps the plugin's copy of the skills equal to their one source; a test fails if they differ or a version is stale.
- **Agents can read and answer comments.** `await Pipeup.comments()` gives an agent that can run the page the same Markdown as Copy as Markdown, plus the threads as data (`{ all: true }` for resolved ones). An agent answers in a replies file next to the page (`report.html` → `report.replies.js`), signed with its own key; the author lists the agent with `<html data-pipeup-agents="<key>">`, and the page ignores replies from any other key (and says how many).
- **`npx pipeup agent` and `npx pipeup reply`**: the command line for an agent. `agent` makes its key (kept in `~/.pipeup/agent.json`, never in the page) and prints the public key to list; `reply --page report.html --thread <id> "words" --addressed "note"` writes the signed reply.
- Replies from an agent show under its own name ("Claude", "Codex") with the AI marking, and a page with a listed agent looks for new replies every few seconds, so they appear without pressing anything.
- **Addressed**: an agent can mark a thread addressed, with a note. The thread stays open, shows the note, and offers **Resolve** or **Still not right** (which reopens it); agents can never resolve, reopen, edit or delete.
- The comment control's menu has **Copy a prompt for my agent** on every page, and says "Claude can answer comments here" when an agent is listed. All comments says how many open comments the agent has answered, with **Check for replies**.
- The apply, summarise and integrate skills, `llms.txt` and the site's Markdown copies tell agents the same thing: read with `Pipeup.comments()`, answer, mark addressed, never resolve.
- **A live link to an agent on the same computer.** `npx pipeup watch report.html --agent Claude` shows the page from your computer (address works only there) and lists the agent for it while it runs; the page's menu gets **Share with my agent**, off on every load. Switched on, the page sends its comments to the link, and the agent reads them with `npx pipeup comments report.html` (no browser, `--all`, `--json`) and answers with `pipeup reply`, which reaches the open page within seconds. The link accepts only the page it serves, from the same computer, and keeps comments in `report.comments.json` next to the page.

### Changed
- The skills no longer say the command line is "arriving in 0.6" where a step works today.
- The README, `llms.txt`, the walkthrough page and the Markdown copies lead with the install commands; the prompt stays as the fallback.
- All comments: the line from an open comment now ends at the comment's bubble on the page when there is one (no dot), instead of at the middle of its block. When an agent's replies are for comments this page doesn't have, the panel says so.
- Pipeup's size budget is 46 KB gzip (was 42 KB); agents reading and answering added 2.6 KB and the live link 0.4 KB.

## [0.5.4] - 2026-10-10

### Added
- A page can list the add-ons that may run: `<html data-pipeup-addons="share,my-addon">` (`none` lets none run; without it every add-on runs). Any other add-on stays off, with the reason "this page doesn't allow it". Best effort: it stops add-ons the author didn't choose, not a page that is already compromised.
- A guide page for making your own add-on (`addons-guide.html`, from `docs/ADDONS_GUIDE.md`), including using add-ons inside a company, what an add-on works with, and keeping add-ons intentional; a Make-your-own card on the Add-ons page; the template now builds one bundled, pinned file.
- **Send to Git**, an example of an add-on a company writes for itself (not from the Pipeup project): it sends a review as Markdown to a service the company runs, which files it in Git. It comes with a stand-in service, a GitHub reference service, a contract checker and a try page, and the agent skill `pipeup-send-to-git-setup`.
- Send to Git's card on the Add-ons page has a Copy prompt: paste it to an AI agent and it sets Send to Git up with you (the skill has a fast path for trying it on your own computer first).
- **Save to GitHub**, a second example add-on (not from the Pipeup project) that needs no server and no token: it opens GitHub's own new-file page with the review filled in. With a try page, a card and a Copy prompt on the Add-ons page.
- Send to Git: `service/create-app.mjs` makes the GitHub App with two button presses (GitHub's manifest flow) and keeps its key in a private file; the service reads it. The setup skill now covers both examples.
- Send to Git can be tried against a real GitHub repository on your own computer: `README` steps, `DEV_USER` for the sign-in stand-in, and `SERVICE_URL` for the demo page.
- The Add-ons page's prompts, `llms.txt`, the integrate skill and each add-on's README tell agents to pin add-on scripts with their integrity hash, list the add-on in `data-pipeup-addons`, and tell the author about a content security policy.

### Changed (the website)
- The file in the walkthrough scenes looks like an HTML file: a larger page icon with a code mark and an orange HTML badge.
- The two walkthrough pages are denser: briefer words and four one-line steps beside the animation, so each fits one screen with no scrolling.
- The two walkthrough pages' footer matches the Add-ons page: a rule above it and the Add-ons and For agents links on the right (For agents offers that page's Markdown copy).
- The footer's Add-ons link is a soft violet pill with a puzzle-piece icon so it stands out.
- The home page's two buttons open their own pages (Add comments to an HTML; Create comment-enabled HTML), each with a back link, instead of scrolling; their text is top-aligned with the animation.
- The home page keeps the feature showcase on the first screen and adds two buttons (Add comments to an HTML; Create comment-enabled HTML) that scroll to an animated walkthrough for each; the footer and For agents menu are unchanged.
- The website's home page is rebuilt around the two ways people meet Pipeup: someone sent me an HTML file, and I'm making a page to share. Two animated scenes on the first screen, a walkthrough with a Copy prompt for each.

## [0.5.3] - 2026-10-09

### Added
- A Try it page for Voice, Live and Assist (with a practice mode and a slides version) from the Add-ons page; Share points to a local demo, and the mailbox has no online try.
- A guide (docs/ADDONS_GUIDE.md) and a copy-ready template (libs/ts/addons/template) for making and publishing your own add-on under your own name.
- The Add-ons page now covers Assist (demo, Copy prompt, script tag) and the optional mailbox server that Share can use; llms.txt and the Markdown copy match.

### Changed
- Assist reads every slide of a deck (marked slides and reveal.js alike), the one showing, the one commented on and all the others, instead of lumping unmarked content into the slide on screen.
- "Reviewed by AI · nothing to add" has a small Check again that makes Assist look at the thread afresh; threads checked by an older Assist are looked at once more.
- Assist shows related information as pills only, under "This may be related:"; hovering or focusing a pill shows the sentence it points to.
- Assist reads the whole page, deck and notes once, a section at a time, keeps a short summary of each on the device, and checks the likely sections in full before replying, so a goal on a far-off or short slide is found. The menu row shows how far reading has got.
- Assist reads every slide as a whole (short bullets included), so a goal on a slide can be found and pointed to with a slide pill.
- The line from an open All comments row now runs down the margin beside the panel and turns in to the far right of the marked words' row, or along the gap above the block, instead of cutting across the page.

### Fixed
- An AI reply's ring sits at the top right of the reply, like any avatar, instead of over its words, and it pulses outward inside its own box, so nothing is cropped.
- Assist shows what a reply relied on as small reference pills (at most three, never an address): "[1] Risks" for a passage, "Slide 5" with a slide icon for a slide, a notes heading; pressing one goes there. It reads every slide of a deck, so the answer can come from slides other than the one commented on.
- A thread the AI assistant has looked at and had nothing to add to says so ("Reviewed by AI · nothing to add"), and says "AI assistant is reading this…" while it does. `host.setThreadMark` is the add-on slot for it.
- The "Assistant replies" row shows in the menu only while commenting is on.
- Assist no longer replies with what the commented words already say, and shows a link as a numbered reference ("[1]"), not an address.

## [0.5.2] - 2026-10-09

### Added
- **`@pipeup/assist`**: short replies to comments from a small AI model running on the reviewer's own device (the browser's built-in model by default; a page can supply its own engine). Turned on by the reviewer, it decides for each comment whether a reply would help (ambiguity, related information or tone), streams a short reply into the thread under the name "AI assistant (on this device)", links to the author's Markdown notes where it used them, and remembers what it has looked at so it looks again only when something is added.
- For add-ons that write AI replies: `host.setThreadNote` shows a reply as it is being written at the end of a thread; the name "AI assistant" is kept for AI replies and they are drawn with a gently glowing ring; `signOp`, `computeOpId`, `AI_NAME` and `isAiName` are exported.

### Changed
- **All comments is interactive.** A row is a preview; choosing it opens the thread out in the panel, where you can reply, resolve or reopen, and copy it. The page scrolls to its place and a thin line joins the open row to it. Nothing opens on the page, and the side popover is gone.

- An open thread's popover always shows who and when, with Copy and Resolve, so it no longer jumps in height when hovered; the chosen block's outline and naming bar step aside while a thread is open.
- The bundles go through a second minifier (terser) after esbuild: 3% smaller, 40.2 KB gzip for the script (41.5 KB before), 35.4 KB brotli.

## [0.5.1] - 2026-10-08

### Fixed
- The comment control's icon is readable when a page's link colour is pale (on a dark page, the icon was white on pale blue in comment mode).
- Pipeup follows a page that switches between light and dark after it has loaded.

### Changed
- Comment boxes are wider (400 px) on windows 900 px wide or more.

## [0.5.0] - 2026-10-08

### Added
- **Add-ons.** One core plus optional add-ons, each one more script (or one combined file such as
  `pipeup+share.min.js`), working from a page opened from disk in any script order:
  - `@pipeup/share`: comments shared through an encrypted service the author picks (PrivateBin, or an HTTP
    mailbox an organisation runs itself), set up from the command line (`npx @pipeup/share create`).
  - `@pipeup/voice`: a microphone button in the comment box for dictating, with the browser's own speech engine
    and a plain consent sentence.
  - `@pipeup/live`: live comments and presence between people on the same page, peer to peer.
  - `@pipeup/mailbox`: the reference server for the shared-copy mailbox contract (`pm1`) and its `check` command.
  Each add-on says in one sentence what it sends and to whom. The core still makes no network requests.
- `Pipeup.use(addon)` and `Pipeup.addons()`, and the add-on host (menu rows, notices, announcements, a note above
  the new-comment box, composer tools, side panels, styles, status, overlay, frame and UI callbacks), typed and
  versioned (`ADDON_API` 1).
- `PipeupDocument.ops()`, `merge(ops, source)` and `sign(purpose, data)`, and `onChange` now also hears the added
  ops and where they came from. Ops from elsewhere go through exactly the checks a feedback file's do.
- Public `--pu-*` style tokens for add-ons.
- A website page for the add-ons (what each sends, a short animated demo and a Copy prompt for each), linked from the footer. The home page and its Copy prompt stay core only.

### Changed
- Tab on the page closes an empty comment box left open, as a click elsewhere does.
- A resolved thread stays open, with a sentence saying so, while words are half-written in its reply line.
- Ops are stored and exported as `{ body, sig }` only, and each is bounded in size. A saved change that can't be
  read is kept, left out and counted in one console warning.
- A second copy of Pipeup on a page warns and hands over to the first.
- The bundle is 40.5 KB gzip (36.8 KB in 0.4.1): add-on support cost 3.8 KB, and the min and esm budgets are now 42 KB.

### Fixed
- **The guidance for AI agents no longer tells them to download a file.** `llms.txt` and the integrate skill now say to add the pinned CDN script tag by editing the HTML only; saving a local copy for offline pages is left to the user. Some agent permission classifiers blocked the old `curl` step.

## [0.4.1] - 2026-10-07

Shipped first as pre-release 0.4.1-beta.1.

### Fixed
- **Tab in comment mode always moves between blocks**, including when comment mode was turned on with the mouse
  and after clicking a block. The first Tab carries on from the block last clicked, commented on or under the
  pointer (Shift+Tab goes back from it); from the Comment control's open menu it closes the menu first.
- The keyboard's block cursor no longer stops on tiny or decorative parts: icons inside links and buttons, keys
  and words styled inside a line of text, hidden or clipped parts, and parts set not to respond to the pointer
  (such as a moving demo). What the author marked with `data-pipeup-id` still counts.
- Moving the mouse onto another block while the keyboard's cursor is out hands the outline to the mouse.

### Changed
- **Esc on the block cursor leaves comment mode** (after a comment box and an open thread), with focus back
  where it was, or on the Comment control. It no longer puts the cursor away and gives Tab back to the page.
- The mouse hint mentions Tab. The bundle is about 37 KB gzip (budget 40 KB).

## [0.4.0] - 2026-10-07

Shipped first as pre-releases 0.4.0-beta.0 to beta.3.

### Added
- **Slides and hidden views.** Pipeup follows a deck's current slide by itself (slides marked
  `data-pipeup-slide`, or reveal.js) and shows only that slide's comments; they ease out and in as the slide
  changes. New comments remember their slide and the page's view.
- `Pipeup.setViewState({ tab, label })` lets a page report its view (a tab, a route); comments made there show
  only there. `Pipeup.onReveal(fn)` lets the page go to a view or slide when a reviewer chooses a comment there.
- `mount({ slides: { current, go } })` for decks that drive Pipeup themselves.
- All comments groups threads by slide in deck order ("Slide 3 · 2 open", this slide marked) or by view.
- Copy as Markdown names a non-slide view in each thread's "Where" line.
- **Keyboard and screen-reader block cursor.** Turning comment mode on from the keyboard (⇧⌥C or Shift+Alt+C,
  or Start commenting chosen with Enter) puts a cursor on the page: Tab and Shift+Tab move between blocks at one
  level, ↑ and ↓ go to the block around it or inside it (Modifier+↑/↓ pass through), Enter comments, Shift+Enter
  opens the comments already there one at a time, and Esc puts the cursor away. The shortcut brings a put-away
  cursor back, and leaves comment mode when it is in use or nothing is landable. Screen readers hear the kind of
  block, its place, its comments and its own words; Pipeup writes nothing into the page. After each comment, and
  after Resolve, focus is back on the same block (or on the Comment control when there is no cursor).
- The naming bar's **Inside it** and **Pin** (a pin at the block's centre, from any input).
- Words selected with caret browsing (F7) or a screen reader show the comment icon once the selection settles,
  and Enter comments on them.
- Closed threads in the column open from their own button. Screen readers are told what Pipeup does in a hidden
  live region (separate from the toast).
- `--pipeup-panel`: while All comments is open, its width is published so a page's fixed bars can move
  clear of it (the rest of the page is already moved over).
- `pipeup/package.json` can be imported (it is in the package's `exports`).

### Changed
- The control's number counts the open threads here; a small dot and its label ("2 here · 5 on other
  slides") say how many are elsewhere. Its name says when comment mode is on.
- Choosing a thread on another slide or view in All comments goes there first, then opens it; if it can't, it
  opens beside the panel with a snapshot.
- The menu's copy rows are called **Copy as Markdown** and **Copy as Text**.
- Flipping **Start commenting** leaves the menu open so you see the switch move (chosen from the keyboard, it
  closes the menu); the menu closes on Esc, a click outside, or 3 seconds after the pointer leaves it.
- Your name is edited right in the menu's identity row; Esc cancels and keeps the menu open.
- Comment mode picks more of a page: sections, articles, navigation, forms, lists, captions, elements
  with an accessible role, and boxes that lay out several things in a row or grid. No block is outlined while
  text is selected.
- The naming bar's expand button is named "Around it" and the bar is a group; bubbles are named after their block
  ("Comment on Paragraph · …: …") and come in page order.
- All comments and Copy list comments in the same page order as the bubbles, the column and Shift+Enter, which
  also orders several comments on one element by where their words start (pins top to bottom).
- While the block cursor isn't in use, Enter and Space on the page's own controls do what the page does in
  comment mode (clicks are still only for commenting), and Enter in a page's form field submits the form.
- `pipeup.min.js` and `pipeup.esm.js` may be up to 36 KB gzip (was 32 KB).
- Pre-releases have their own channel (the npm `next` tag and a marked copy of the site at `/next/`). The site
  is deployed after a release is published, so it never points at a version npm doesn't have yet. Release
  tooling sets the version everywhere and smoke-tests npm, the GitHub Release, the CDNs and the site.

### Fixed
- A comment being written on a slide or view that has gone is no longer lost or stuck: opening another thread,
  choosing one in All comments, or commenting on selected words goes back to it.
- A deck's hook that reports no slide number, or a saved slide that is not a plain slide number, is ignored.
- Focus is no longer lost after sending a comment, and Esc in a thread opened from a bubble or the column
  returns there.
- In forced colours, Pipeup's buttons and the cursor's outline show a Highlight focus ring.
- The empty draft's hidden Send button no longer takes a Tab stop.

## [0.3.2] - 2026-10-06

### Changed
- Pre-releases have their own channel: the npm `next` tag and a marked copy of the site at
  `/next/`, so a milestone can be tried before it reaches everyone.
- The site is deployed after a release is published, so it never points at a version npm doesn't
  have yet.
- Release tooling: one command sets the version everywhere, and a smoke test checks npm, the
  GitHub Release, the CDNs and the site after each release.
- Workflows run on Node 24 and a pinned Ubuntu 24.04 runner.

No change to the library's behaviour.

## [0.3.1] - 2026-10-06

### Changed
- Releases publish to npm with trusted publishing: the release workflow proves its identity to npm,
  so no npm token is stored. Provenance is unchanged.
- The pinned CDN address in the README, the integrate skill and llms.txt points to 0.3.1.

No change to the library's behaviour.

## [0.3.0] - 2026-10-06

The first public release.

### Added

- **One script tag.** `pipeup.min.js` is one file with no dependencies (at most 32 KB gzip). It
  mounts itself on any page whose `<html>` carries `data-pipeup-doc`, and works when the page is
  opened from disk. Published on npm as `pipeup`, with an ESM build for bundlers (`mount`,
  `unmount`, `flush`) and a headless core at `pipeup/core`.
- **Comments on text.** Select words to comment; highlights stay level with their text. Threads
  have one level of replies, and can be resolved and reopened.
- **Comment mode** (Shift+Alt+C, or ⇧⌥C on a Mac, or the control's menu): comment on any block
  (buttons, charts, cards, images) and drop pins with Option-click or Alt-click. The page's own
  controls are paused while it is on; elements marked `data-pipeup-ignore` keep working.
- **The comment control:** one round button showing the number of open threads, with a menu for
  your identity, Copy all, Copy all as text, All comments and Start commenting.
- **All comments:** a panel listing every thread in page order, including threads whose content is
  gone ("No longer on the page"), with a Show resolved switch.
- **Placement:** comments sit in a column beside documents, or as bubbles on dense pages. Pages
  designed for review can reserve a comment gutter with `data-pipeup-reserve` and
  `var(--pipeup-gutter)`. Authors can force either layout with `data-pipeup-layout`.
- **Anonymous identities:** nobody has to give a name. Each reviewer is an animal in a colour
  ("Red Fox"), the same on every page, and can add a name at any time.
- **Anchoring:** comments follow their content when the page changes, using `data-pipeup-id`,
  `data-pipeup-label` and the quoted text; ones that can't be placed are flagged, never misplaced.
- **Copy all** as Markdown for AI agents (with where each comment is, thread and comment ids) or
  as plain text.
- **Signed comments:** every comment, reply and resolve is signed by its reviewer's key, so
  comments can't be forged or altered when they are merged.
- **Local storage:** comments are kept in the reviewer's browser (IndexedDB). Pipeup makes no
  network requests and has no analytics or telemetry.
- **Agent skills:** `pipeup-integrate`, `pipeup-summarise` and `pipeup-apply`, published with the
  website along with `llms.txt` and `llms-full.txt`.
- **Website** with Try pages for a document, slides and a website.

### Known limitations

- Slide-aware comments and keyboard use for blocks come in 0.4; touch and the narrow-page drawer in 0.5.
- The `pipeup` command line (`init`, `check`, `read`, `reply`) comes in 0.6.
- Shared rooms and presence come later; for now feedback travels by Copy all.

[Unreleased]: https://github.com/pipeup-ai/pipeup/compare/v0.8.0-beta.1...HEAD
[0.8.0-beta.1]: https://github.com/pipeup-ai/pipeup/compare/v0.7.0...v0.8.0-beta.1
[0.7.0]: https://github.com/pipeup-ai/pipeup/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pipeup-ai/pipeup/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/pipeup-ai/pipeup/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/pipeup-ai/pipeup/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/pipeup-ai/pipeup/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/pipeup-ai/pipeup/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/pipeup-ai/pipeup/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/pipeup-ai/pipeup/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/pipeup-ai/pipeup/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/pipeup-ai/pipeup/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/pipeup-ai/pipeup/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pipeup-ai/pipeup/releases/tag/v0.3.0
