# API first: a micro-core, with the UI as an add-on

**Status:** Proposal for review, not scheduled. Nothing here is built.
**Visual spec:** [micro-core-mockups.html](micro-core-mockups.html) (published for review:
https://claude.ai/artifact/F6odcki9rAT3BAa9xd1hM5)
**Spec:** proposed wording for a new FUNCTIONAL_SPEC §4b and changes to §4a and §11a is in the visual spec; the spec
itself changes only once this is agreed.

## Why

Pipeup's core (`pipeup/core`, about 10.7 KB gzip) holds the comments model, signing, sealing, anchors and storage. Its
UI is the other 54 KB, and it holds more than drawing: how a page is started, its settings, slides and views, the
re-anchoring loop, mentions, the add-on registry, and even what an agent reads (`comments()` reads the UI's list). So
anything that wants Pipeup without Pipeup's look has to work around it. The 0.8.2 itinerary page did exactly that:
faked key presses, a class name polled in the shadow root, a remount to change the name ([one-tap-page-api.md](one-tap-page-api.md)).

Agents now write most of the pages Pipeup sees. An agent that builds a report in its own design should be able to draw
the comments in that design too, a margin note in the report's own type, or a Feedback tab in a deck's own toolbar,
and keep everything that makes Pipeup trustworthy: signed comments, anchors that survive edits, sharing, agents' replies.

## The idea in one line

**Everything Pipeup does is an API; Pipeup's own interface is one add-on that uses only that API.**

## Layers

| Layer | What it is | Ships as | Draws anything? |
|---|---|---|---|
| **Core** | Comments, ops, signing and sealing; anchors and re-anchoring; the page (settings, document id, slides, views, editions); storage and identity; the add-on registry; what add-ons contribute (actions, status, notes, marks, messages); exports for people and agents | `pipeup/core` (ESM), `pipeup.core.min.js` (new classic script) | No. It reads the page and never writes to it. |
| **Data add-ons** | share, github, updates; and the data half of agents, inbox, identity, assist, live | `@pipeup/*`, as today | No |
| **The UI add-on** | Pipeup's interface: the control, comment mode, cards, the panel, menus, highlights, the block cursor, themes | `pipeup/ui` (ESM), inside `pipeup.min.js` | Yes, in its shadow root |
| **UI extensions** | Add-ons that draw: emoji, voice, inline, live's cursors | `@pipeup/*` | Through the slots a UI offers |
| **`pipeup`** | Core + the UI add-on + automatic start: what one script line loads today | `pipeup.min.js`, `pipeup` (ESM) | — |

The page's script line, its file names and its `Pipeup` global don't change. A page that wants its own interface loads
`pipeup.core.min.js` (or imports `pipeup/core`) instead.

## Principles

1. **One API, two callers.** The UI add-on imports only the core's public entry. A lint rule enforces it
   (`no-restricted-imports` on `src/ui/**` for anything but `src/core/index.ts`). If the UI needs something, it is
   public, typed and documented; nothing is reachable only through the UI.
2. **Data, not DOM.** The core returns plain data: threads, placements (a `Range` or an `Element`, never markup),
   actions, signals. It reads the page; it never adds, moves or styles anything in it.
3. **Headless works.** Everything except placements and views runs in Node (the CLI's `read`, tests, agents).
4. **One version number.** `API` replaces `ADDON_API` and covers the core API and the add-on contract together. The op
   format stays the other fixed point: every comment written by any released version stays readable (§16).
5. **One event shape.** `on(event, fn)` returns `off`. Today there are three (`doc.onChange`, `instance.on("change")`,
   `host.onUi`).

## The core API (sketch)

```ts
import { open, use, addons } from "pipeup/core";

const pu = await open({ root, doc, store, name, slides }); // reads page settings; no UI; once per page

// The comments
pu.threads(); pu.ops(); pu.name; pu.setName("Sam");
pu.on("change", ({ threads, added, source }) => {});

// Writing as the reviewer: refused unless the reviewer just pressed or typed (see Trust)
await pu.comment(target, "Make Q4 the only coloured bar"); // target: Range | Element | { element, point } | Anchor
await pu.reply(id, text); pu.edit(id, text); pu.remove(id);
pu.react(id, "👍"); pu.unreact(id, "👍"); pu.resolve(thread); pu.reopen(thread); pu.seen(ids);

// Where each thread is now (browser only; the re-anchoring loop runs while someone listens)
pu.placements(); // Map<thread, { state: "attached" | "moved" | "lost" | "elsewhere" | "earlier", range?, element?, point?, label, view }>
pu.on("placement", (changed) => {});
await pu.reveal(thread); // goes to its slide or view, scrolls it into view; false when it can't

// The page's views
pu.view(); pu.where(node); pu.go(view); pu.on("view", fn);

// Reading out
pu.markdown({ as: "ai" | "text", thread }); // Copy comments
pu.comments({ all, edition });              // what agents read (no longer through the UI)
pu.segments(comment);                       // [{ text } | { link } | { mention }]: safe pieces to render as text

// Bringing comments in
pu.merge(ops, source); pu.exportFile(); pu.importFile(json);

// What add-ons contribute, for any interface to show
pu.actions();  pu.on("actions", fn);  // [{ id, addon, label, hint, icon, checked?, count?, run }]
pu.signals();  pu.on("signals", fn);  // { status, messages, listNote, composerNote, threadNotes, threadMarks, commentMarks }

pu.close();
```

The pure helpers stay where they are: `describeElement`, `describeRange`, `resolveAnchor`, `locate`, `formatAgo`,
`nameOf`, `createIdentity`, `signOp`, `checkOp`, `computeOpId`, `newDocumentAttribute`, `readFeedbackFile`.

### What moves from `src/ui` into the core

| Today | Lines (about) | Why it is core |
|---|---|---|
| `ui/mount.ts` start-up: document id, store with its timeout and memory fallback, profile, name | ~80 of 300 | Any interface needs it; headless needs it |
| `ui/settings.ts`: `data-pipeup-*` on `<html>`, the loading line or `open()`, in that order | 24 | Page settings, not looks |
| `ui/here.ts`: slides, views, editions, `setViewState`, `onReveal`, `navigate` | 330 | The page model; add-ons already use it through `host.where/isHere/go` |
| `ui/app.ts` re-anchoring: the MutationObserver, 40 ms passes, the deferred fuzzy pass, here/elsewhere sorting | ~150 of 1,588 | Every interface needs attached, moved and lost |
| `ui/mentions.ts`: people, `peopleFor`, `mentionsMe`, `unseenMentions`, listed agents | ~70 of 121 | Data about people |
| `ui/addons.ts`: `use`, the queue, the allow-list, `firstCore`, capability checks, `AddonInfo` | ~240 of 1,071 | The registry isn't UI; `Surface` (the slots) stays in the UI |
| `ui/dom.ts` link and reference parsing | ~130 of 190 | Safe pieces of text for any interface (`segments`) |
| `ui/order.ts` page order (`byPage`) | 19 | All comments, Copy and agents share one order |
| `mount().comments()` reading `ctx.menu.all()` | — | Agents read the core, not the UI's list |

Estimated core after the move: **15–17 KB gzip** (from 10.7). The full `pipeup.min.js` stays inside its 63.5 KB
budget: code moves, little is added. Public names can't be mangled, so the boundary costs roughly 0.5–1 KB; the first
step of building this is a spike that measures it.

## Add-ons: contributions instead of UI slots

Most of what add-ons ask the UI for today is data. Those become **contributions** the add-on gives the core; any
interface shows them. Only the slots that really draw stay with the UI, renamed `ui:*`.

| Today (`host.`) | Becomes | Pipeup's UI shows it as |
|---|---|---|
| `addMenuItem` | an **action** | a menu row |
| `notify`, `announce` | a **message** (notice, or spoken) | a toast; the live region |
| `setStatus` | **status** (words, and who is here) | the control's label, the panel's status |
| `setListNote` | **list note** | the line under All comments' header |
| `setComposerNote` | **composer note** | the line in the comment box |
| `setThreadNote` | **thread note** (a reply being written) | the streaming reply |
| `setThreadMark`, `setCommentMark` | **marks** | the quiet line; the glyph and its tip |
| `merge`, `sign`, `paste`, `identity`, `where`, `isHere`, `go`, `document` | the core API, scoped to the add-on | — |
| `openPanel`, `openDialog`, `overlay`, `onFrame`, `addStyles`, `avatar`, `place`, `post`, `addComposerTool`, `setReactionPicker`, `onUi` | `host.ui.*`, needs `ui:panel`, `ui:dialog`, … | as today |

A slot is offered by **whichever interface is on the page**. Pipeup's UI offers all of them. A page's own interface
offers none, or the ones it chooses to implement (a composer tool, say, so voice works in its own box). An add-on whose
`ui:*` needs aren't offered stays off and says why, as an add-on meeting an older Pipeup does today.

| Add-on | Needs today | With the micro-core |
|---|---|---|
| share | sync, menu, notify, note, commentmark | **Any interface, or none** (its headless half already serves `pipeup read`) |
| github, updates | menu, notify | **Any interface, or none** |
| agents | menu, status, notify, listnote, dialog, styles, paste | Data anywhere; its paste dialog needs `ui:dialog` |
| inbox, assist | … panel, sign | Data anywhere; settings need `ui:panel` |
| identity | menu, styles, dialog, identity | Needs `ui:dialog` for the recovery code |
| live | menu, notify, status, overlay, here, panel, styles, sign | Presence is a signal; cursors need `ui:overlay` |
| emoji, voice, inline | reactions / composer / place, post | UI extensions: need their `ui:*` slot |

## Trust: what any interface must keep

The rules that keep reviewers safe today live partly in the UI. With other interfaces, they have to live in the core
or be checked.

- **Writing as the reviewer takes the reviewer's own action.** The core refuses `comment`, `reply`, `edit`, `remove`,
  `react`, `resolve` and `reopen` unless the browser counts a user activation (`navigator.userActivation.isActive`), as
  `host.post` does today. It holds for every interface and every add-on. Best effort: page code can always script a
  click on itself; the rule stops stray add-ons, not the page's author. Headless, there is no reviewer: writes need an
  explicit identity (an agent's).
- **Comment text is never markup.** The core returns strings and `segments()`, never HTML. It can't stop an interface
  from using `innerHTML`, so `pipeup check` probes it: it adds a comment whose words look like markup to a throwaway
  copy and fails if the page grows an element.
- **The page stays the author's.** The core never writes to the page. Pipeup's UI keeps every rule it has (AGENTS.md).
- **Checked as strictly as a file.** Unchanged: every op from anywhere is verified on merge.
- **No network.** Unchanged: the core sends nothing; only add-ons do.

## Packaging

**Recommendation: one package, three entries.** `pipeup` (core + UI, no auto-start), `pipeup/core`, `pipeup/ui`; CDN
files `pipeup.min.js` (as today) and `pipeup.core.min.js` (new). The UI is an add-on in how it is built and
registered, not a separate npm package: it is the default, it ships with every release, and a second package would
only add a version to keep in step. `mount()` stays and means `open()` plus `use(ui())`, returning today's
`PipeupInstance` shape, so pages and add-ons written for 0.9 keep working until the add-on API number moves.

Alternative, close but not chosen: `@pipeup/ui` as its own package. Choose it if the UI ever releases on its own
schedule.

## `pipeup check` for a page with its own interface

The overlap and layout checks are about Pipeup's UI, so they are skipped when the page loads only the core. Instead:
Pipeup is loaded once; a comment survives a reload; every marked block resolves; comment words render as text (the
probe above); and each add-on that needs a slot no interface offers is listed as off, with its reason.

## The agent's feedback loop

Agents are Pipeup's main users: they put it on the web pages they build, ask people for feedback, read it, act and
answer. People are where the feedback comes from, and on a web page it is mostly visual. A comment today keeps its
words, element, pin and view (`model/types.ts` `Anchor`) but nothing about how the person was seeing the page, so an
agent fixes "the title wraps on my phone" at its own window size and look. What follows is arranged by the stage of the
loop it serves. Web pages only for now; agents in terminals already hear from people in their own chat.

**1. Set up the page (the agent).**
- The integrate skill (3,489 words) becomes a short skill that picks the path (Pipeup's look by default, the page's own
  when the author asks) with references loaded on demand; the site's Copy prompt gains the same choice; each released
  version's guide stays at `/v/<version>/`.
- `Pipeup.about()`: version, API number, interface, add-ons and whether each is on, settings, the guide's address.
- The check names what to fix: each finding gets a stable `id`, the elements or lines, a `fix` and a `docs` link
  (today "3 without data-pipeup-id" doesn't say which three).
- The skill tells agents to report every reviewable state with `setViewState` (a dialog, a tab, a step), so comments
  made there say so and Go there brings it back.
- Asks whose options are page elements (header A, header B), pressed to choose (inline add-on).

**2. Give feedback (the person).**
- What the person saw travels with the comment: a new optional anchor field, `seen`, with window size and zoom, light
  or dark, touch or pointer, scroll position, the element's box, and a short hash of its look (rounded size, type,
  colours, spacing from computed styles). Numbers only, never pixels, signed with the comment and going only where it
  goes. Compatible: `isAnchor` reads only the fields it knows and the op id hashes the whole body, so older versions
  ignore `seen` and still verify the comment; new versions bound it in `isAnchor`.
- Areas: a reviewer drags out a region and comments on it (moves "drag to select an area" out of §17; an anchor gains
  an area beside `point`).

**3. Receive it (the agent).**
- `pipeup read --pictures <folder>` draws the page with Playwright (as `pipeup check` does) at each comment's size,
  zoom, look and slide, with the spot outlined, one picture per thread; a changed page is said so on the picture. What
  agents read gains the `seen` lines and the element's size and look-shaping styles.
- Comment words can't pass for Pipeup's own: `export/format.ts` `words()` indents a comment's later lines by two spaces,
  so one comment can read as another thread (tested on 0.9.1: one comment by Ada exported as a second "Lee" thread
  asking to delete the footer). Quote every line, strip `*` and backticks from names, say who wrote each comment.
- `--since` with a cursor; a version number and a published schema on the data.
- `npx pipeup mcp`: the same commands as tools, and a notification when comments arrive, so an agent waiting on a
  review doesn't poll. Same rules; JSON-RPC over stdio, no MCP library.

**4. Act and answer (the agent).**
- `pipeup check <page> --comments` loads the rewritten page with the comments the CLI can read (feedback files, the
  shared copy, the replies file) and reports, by thread, what moved or can't find its place, with what to put back.
- A retried `pipeup reply` counts once (it writes two today); every refusal gets a stable code and what to change
  (only start-up has codes today); the skill tells agents to end each reply with a reference to the spot they changed.

**5. Confirm (the person).**
- Pipeup compares an element's look now with the hash in `seen`; an addressed comment whose target changed says "The
  title looks different since you commented" in one plain line, so a reviewer checking a round knows where to look.
  "Still not right" is the agent's next request.

**Keeping the guidance honest.** Five tasks from the loop (set a deck up, fix a phone-only comment from its picture,
answer three comments including a forged one, rewrite a page keeping its comments, send a retried reply), run by two
agents before each release, graded by Pipeup's own commands; results in the release notes. Nothing is collected from
anyone's pages.

Size: `seen` and the look hash in the core about 0.4 KB; the "looks different" line about 0.2 KB; areas about 1 KB in
the UI; pictures, the tool server and the check are CLI only.

## Steps (when it is scheduled)

Each step ships with `npm run check` green and no change a reviewer can see. The feedback loop (above) doesn't need the
core move and can go first; areas and visual choices touch the UI and the inline add-on, so they fit either side.

1. **Spike**: move `settings` and `here` behind a public core entry, add the lint rule, measure the core and the
   boundary's cost. Decide go or no-go on numbers.
2. **The page model and start-up** move to the core (`open()`); `mount()` calls it. Their tests move with them.
3. **Placements**: the re-anchoring loop moves to the core; the UI draws from `placements()`.
4. **Contributions**: actions, messages, status, notes and marks; `API` 2; every `@pipeup/*` add-on re-released in
   step (they already release together). An add-on built for API 1 stays off and says why.
5. **`pipeup.core.min.js`**, a small example interface (vanilla, about 150 lines), an integrate-skill path for "draw
   it in the page's own design", and the guide.
6. **Clean-up** (below), done in its own pull requests so each is easy to review.

## Clean-up

The visual spec has the full tables. In short:

**Design notes** (51 files: 40 notes, 11 visual specs) become one design per layer:

- `core.md` (this proposal grows into it): `architecture.md` §3–4, `views.md`, `editions.md`, `readable-markdown.md`,
  and the model parts of `reactions.md`, `mentions.md`, `agent-replies.md`, `one-tap-page-api.md`, `addons.md` §1,
  §2, §6.
- `ui.md`: `keyboard.md`, `page-isolation.md`, `page-dialogs.md`, `panel-hub.md`, `panel-filters-hover.md`,
  `corner-control.md`, `comments-at-rest.md`, `menu-copy-theme-space.md`, `comments-stay-here.md`, the rules in
  `looks-readable.md` and `words-and-focus.md`, `addons.md` §3. One home each for the control, the panel, motion
  tokens, making room and focus.
- One note per add-on (agents, assist, inline, voice, share, live, updates, inbox and github), `cli.md` (from
  `cli-init.md` and `cli-read.md`), and the website's `one-front-door.md`.
- `docs/design/archive/`: `agents-addon`, `decks-and-sites`, `phones-touch`, `iphone-taps-keyboard`,
  `walkthrough-fixes`, `size-pass`, `prerelease`, `release-safeguards`, `architecture.md` §7 and §11, `addons.md` §10,
  §15, §18, the seven built visual specs, and the relay drawings.
- Delete `quick-start-mockups.html` (superseded, unlinked). Redraw `images/architecture.svg` and `images/addons.svg`.

**Things the docs say that aren't so**, to fix in the same pass: `architecture.md` names `apps/cli`, `services/relay`,
slide adapters, six op kinds (there are 12), 26–40 KB budgets and axe-core in the check; spec §9 promises a narrow-page
drawer (there is none; the panel covers the page); spec §14a says `pipeup check` reports versions and advisories (it
doesn't); spec §13 and §18 describe an unbuilt relay and phases that end at 0.8; `ADDONS_GUIDE.md` says add-ons are
light mode only (AGENTS.md requires both looks) and lists 13 of 19 slots; `corner-control.md` says a click opens All
comments (it toggles comment mode); four notes still say "draft" or "nothing is built".

**The functional spec** splits by who it is for: Pipeup (authors, agents, interface builders), Pipeup's interface,
add-ons, agents and the command line, and later (relay, out of scope, open questions).

**Tests** (389 unit in 4 s; 702 browser): about 50 browser tests really check core behaviour through the UI, about 23
command-line tests run under Playwright without a page, and about 45 repeat another test or check removed features.

- Into the core's unit tests: `test/registry`, `test/ui/here`, `test/ui/order`, the model half of `test/ui/mentions`;
  and first direct tests for start-up (`ui/mount.ts`: document id from the address, settings order, the store's
  memory fallback, the name option, error codes), here/elsewhere sorting (`app.ts` `classify()`), editions, resolve
  timing (40 ms passes, deferred fuzzy pass), the add-on host's rules, and the change event's de-duplication.
- A new real-browser core suite with no UI (~15 tests): anchors on real layout, which jsdom can't do (`innerText`
  keeping blocks apart, `checkVisibility` on hidden tabs, labels from boxes).
- Out of Playwright: `agent-cli`, 7 of 8 in `init`, `read`, `init-addons`, `read-share`.
- Go: `review2.spec` (12 tests from one review: 6 repeat others, 5 move); `menu.spec`'s tests for removed rows and file
  drops; `touch.spec`'s 40 px assertion (the spec says 44); duplicates of `here.test` in `here`, `elsewhere`,
  `go-there`; in-file duplicates in `control.spec`.
- Regroup by behaviour: `focus`, `focus-reply`, `words-focus`, `survive` → focus after actions, words never lost;
  `menu` + `menu-rows`; `rail` into `hub`. Rename `finish` → page-untouched, `one-tap` → page-api, `core-slots` →
  host-api.
- A fake clock instead of sleeps (`menu-rows` waits 9.1 s on a 3 s timer; `decks` 5.4 s; `live-connect` 8 s); share
  runs one backend in the browser; the two example tests that skip when the example isn't built fail instead.
- The UI's e2e helpers (tied to class names) become the UI add-on's page object; core tests never import them. Each
  core `describe` names its spec §.
- Not part of the redesign, worth fixing now: `e2e/one-tap.spec.ts:110` uses a real person's name (AGENTS.md).

Rough totals after: core unit ~290, core browser ~15, UI unit ~105, UI browser ~465, CLI ~45 unit + 9 browser, add-ons
~243 unit + ~116 browser: about 105 fewer browser tests and 75 more fast ones.

## Open questions

1. Should reviewer writes be refused without a user activation (recommended), or only flagged?
2. Do small add-on dialogs (agents' paste box, identity's recovery code) become a declarative prompt any interface can
   show, so those add-ons need no UI slot? Recommended: not yet; start with `ui:dialog` and revisit when there are
   custom interfaces in the wild.
3. Does the core keep CSS highlights (they write only an adopted stylesheet, never the DOM) so every interface gets
   the same highlight for free, or are they the UI's? Recommended: the UI's; a `placements()` range is enough to draw
   one.
4. One interface per page, or several (a page's own sidebar plus Pipeup's control)? Recommended: one `ui` provider;
   a second is refused with a reason.
5. Is keeping how the reviewer saw the page acceptable by default? Recommended: yes, coarse (sizes to the nearest
   10 px, no browser or device name), and said on the reviewer help page.
6. Pictures drawn by the agent or taken by the reviewer? Recommended: drawn by the agent from the page's file; a page
   whose content depends on the reviewer's own data shows the agent's version, and the picture says so.
7. Areas now or later? Recommended: now; visual feedback is often about a region.
8. Where does the tool server live? Recommended: in the CLI (`pipeup mcp`), not a separate `@pipeup/mcp`.
9. Which agents run the evals, and how often? Recommended: two (Claude and Codex), before each release.

## Change log

- 2026-11-01 — First proposal: layers, the core API, contributions instead of UI slots, trust rules for any
  interface, packaging, check for own interfaces, steps, clean-up and open questions.
- 2026-11-01 — Made for agents: comment words quoted in the export (a forged thread shown on 0.9.1), "where" as file
  and line, a check for comments an edit lost, check fixes, `about()`, error codes, safe retries, `--since`, a tool
  server, split skills, versioned guides, and evals before each release; open questions 5–7.
- 2026-11-01 — Refocused on people's feedback on web UI: "Made for agents" becomes "Feedback on what people see" (what
  the person saw kept with the comment, pictures for the agent, areas, visual choices, "looks different", a check for
  a new round); terminal tooling (tool server, `about()`, evals) left out; open questions 5–7 replaced.
- 2026-11-02 — One loop: "The agent's feedback loop" puts the agent tooling back (skills, `about()`, check fixes,
  `--since`, the tool server, codes, retries, evals) beside the person's side, arranged by stage; questions 8–9.
