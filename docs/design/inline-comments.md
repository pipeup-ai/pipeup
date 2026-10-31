# Inline comments

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §11b (proposed), and the two additions to §11a. Status: **built** (2026-10-31),
with the decisions and the differences from the proposal below.

Asked for from Designup's review rounds: a design workspace wants to ask its reviewers specific questions ("Is this one
journey or two?", "Agree with this requirement?") in the page, and get the answers back as ordinary Pipeup comments,
with everything comments already have.

## The author's markup

```html
<!-- an ask: the author's fallback content stays for anyone without the add-on -->
<div data-pipeup-id="q-journeys" data-pipeup-ask="Is “Go through every comment” one journey or two?"
     data-pipeup-ask-kind="choice" data-pipeup-ask-options="One|Two" data-pipeup-ask-other data-pipeup-ask-needed>
  <p>Is “Go through every comment” one journey or two? Comment on this with ⇧⌥C.</p>
</div>

<!-- agree, on a requirement block -->
<section data-pipeup-id="FR-012" data-pipeup-ask="Agree with this requirement?" data-pipeup-ask-kind="agree">…</section>

<!-- a block whose comments show in place -->
<figure data-pipeup-id="home-hero" data-pipeup-inline>…</figure>
```

- The ask's name is the block's `data-pipeup-id`, which Pipeup already uses to anchor comments (§8). It is required for
  an ask: without it the add-on draws nothing and writes one console line naming the element.
- Kinds: `open` (default), `agree`, `choice` (`data-pipeup-ask-options`, two to six, `|`-separated;
  `data-pipeup-ask-other` adds Other).
- The page includes the add-on like any other (`data-pipeup-addons`, or its script tag); the add-on's id is `inline`.

## Where the add-on draws (the `place` slot, new)

- `host.place(element)` returns a shadow root inside a `<pipeup-place>` element that Pipeup appends as the last child
  of `element`, only when `element` carries `data-pipeup-ask` or `data-pipeup-inline` for this add-on. Anything else
  is refused (the call throws, and the add-on's `needs` check fails early).
- The add-on never touches the author's nodes. The author's fallback is hidden by Pipeup's own stylesheet, injected
  once:
  `[data-pipeup-ask][data-pipeup-placed] > :not(pipeup-place) { display: none }`, with `data-pipeup-placed` set by
  Pipeup on the marked element. This is the one attribute Pipeup sets on a page element, and it removes it on
  teardown.
- This is an exception to AGENTS.md's "never mutate the host page's DOM", like the `<dialog>` exception: limited to
  elements the author marked, removed on teardown, styles inside the shadow root. AGENTS.md is amended only when the
  spec is agreed.
- Comment mode treats a `<pipeup-place>` as Pipeup's own UI: not a block to pick, and its controls act.

## Posting what the reviewer sent (the `post` slot, new)

- `host.post({ anchor: element, text, replyTo? })` creates a thread on the block, or edits the reviewer's own answer
  (`edit: threadId`). It is accepted only during a user activation that started inside the add-on's own
  `<pipeup-place>` or panel (`navigator.userActivation.isActive` plus the event's composed path), so an add-on can't
  post on its own.
- The comment is the reviewer's, signed with their identity, in the fixed signed form: **no format change**. What
  makes it an answer is where it is (the anchor's `data-pipeup-id` is the ask's name) and its first line:
  - choice: the option's words exactly (`One`), or `Other: <words>`;
  - agree: `Agree`, `Agree: <words>` (the words are optional), or `Needs change: <words>`;
  - open: the words.
  The quoted excerpt the anchor already saves keeps the question's words, so "Asked as: …" needs nothing new.
- One answer per reviewer per ask: the add-on finds the reviewer's own earlier thread on that anchor
  (`host.document.threads()`, `author === me`) and edits it.

## Counting

- From `host.document.threads()` and `onChange`: threads on the ask's anchor, each author's latest answer, grouped by
  first line. Others' answers are counted only once the reviewer has their own on the anchor.
- "2 of 5 asks answered" is a `menu` row with a count; the list opens in a `panel`.

## Size

- Core: the `place` and `post` slots and the injected rule, about 0.8 KB gzip, inside the current budget's headroom
  or with a raised budget agreed with the maintainer (as for Only in this browser).
- The add-on: its own budget, proposed 6 KB gzip.

## Tests

- Unit: answer parsing (each kind, Other, Needs change), one answer per reviewer, counts with merged comments, "Asked
  as" when the question changes.
- Browser: an ask drawn in place with fallback hidden; answering by keyboard and touch; `post` refused without a user
  activation inside the add-on; Hide comments shows no counts or threads; teardown restores the page exactly
  (DOM snapshot before and after); light, dark and reduced motion.

## As built

- **Core** (`libs/ts/pipeup/src/ui/addons.ts`): two capabilities, `place` and `post`, on `Surface`.
  - `host.place(el)` refuses (throws "not an element marked for add-ons") anything that isn't `[data-pipeup-ask]` or
    `[data-pipeup-inline]` inside the comment root, or is already placed by another add-on; the same element gives the
    same root. The one rule (`ASIDE`) goes in a constructed sheet on `document.adoptedStyleSheets`, so no element is
    added (a `<style>` in `<head>` only where constructed sheets are missing), and goes when the last place does.
  - A place's shadow root carries `:host{all:initial;…}` and Pipeup's public look: the core copies the layer's
    `--pu-text`, `--pu-muted`, `--pu-faint`, `--pu-line`, `--pu-surface`, `--pu-soft`, `--pu-hover`, `--pu-shadow` and
    `--pu-ease` onto the `<pipeup-place>` as it is made and whenever the look turns light or dark (checked each frame).
    STYLES must stay one literal, so the tokens can't be shared as a constant.
  - `host.post({ anchor, text, excerpt?, replyTo?, edit? })`. Accepted only when the reviewer's latest trusted press
    or key (`pointerdown`, `pointerup`, `keydown` or `click`, seen on window in the capture phase) had one of this
    add-on's places, or its panel or dialog (`data-addon`), in its composed path, and `navigator.userActivation` (where
    the browser has it) is still active. A new thread is `describeElement(anchor)` with `excerpt` as its snapshot.
  - `<pipeup-place>` is in `IGNORED`, so comment mode never picks it and its presses reach the add-on.
  - Threads whose `anchor.id` is a placed block's leave the margin views (bubbles, column); the control's count and All
    comments keep them.
  - `labelOf` names an ask's block `Ask "<question>"`, so Copy for AI and the panel say what was asked.
- **How an answer is recognised.** The add-on posts with `excerpt: "Asked: <question>"`. A thread on the ask's block is
  an answer only when its snapshot starts with `Asked: ` and its first line reads as one for the ask's kind; a comment
  made in comment mode on the block keeps the block's words as its snapshot, so it is shown but never counted. "Asked
  as" compares the rest of the snapshot with the question now.
- **The add-on** (`libs/ts/addons/inline/`): `asks.ts` (markup, answers, counting: pure) and `addon.ts` (drawing).
  Choice options answer with one press; Agree, Needs change and Other open a box (Agree's words optional); Enter sends,
  Shift+Enter starts a line. The controls redraw only when the reviewer's answer or mode changes, so words being written
  are never redrawn away, and reply boxes are kept per thread while the list redraws.
- **`pipeup read`** (`cli/asks.mjs`): reads the asks from the page's markup and every reviewer's latest answer, and
  adds `## Asks` to the Markdown and `asks` to `--json`. The answer rules are repeated there in plain JavaScript (the
  CLI is outside both budgets).
- **Size**: core +1.0 KB gzip (61.7 → 62.7 KB), budget 62 → 63 KB, agreed with the maintainer; the add-on 4.4 KB gzip
  of its 6 KB budget.
- **Tests**: `addons/inline/test/asks.test.ts` (markup, each kind's words both ways, refused words, counting with merged
  and repeated answers, deleted answers, "Asked as"); `pipeup/test/read-asks.test.ts`; `addons/e2e/inline.spec.ts`
  (drawn in place with fallback hidden, an unnamed ask left alone, choice and Change as one edited answer, agree by
  keyboard, an open ask by touch with 44 px targets, others' counts only after answering and none while hidden, threads
  out of the margin, "Asked as", comments in place with a reply, comment mode leaving the controls to the add-on, `post`
  and `place` refused, teardown's DOM snapshot, light, dark and reduced motion).
- **Not built yet**: dictation and other add-ons' tools in an ask's box (the core would have to lend its composer tools
  to an add-on's own box); asks added to the page after Pipeup starts (the add-on reads the page once, at setup).

## Decisions (the maintainer, 2026-10-31)

- **Others' answers first: never.** No per-ask switch; counts and others' threads appear only once the reviewer has
  their own answer on the anchor.
- **No third agree answer.** Agree and Needs change stay; Agree may carry words too (`Agree: <words>`), because an
  agreement can confirm or steer. Counting groups by the leading `Agree` or `Needs change`, not by the words.
- **Asks stay in the add-on.** The core keeps only the general `place` and `post` slots; answer parsing and counting
  never move into the core's budget, even when a second add-on uses asks.
- **AGENTS.md exception agreed**: Pipeup may append one `<pipeup-place>`, set `data-pipeup-placed` and inject the one
  rule, only inside elements the author marked, all removed on teardown.

## Change log

- 2026-10-31 — Proposed, with §11b.
- 2026-10-31 — The three open questions answered (see Decisions) and the AGENTS.md exception agreed.
- 2026-10-31 — Built: the `place` and `post` slots, threads on placed blocks out of the margin and an ask's label in the
  core (budget 62 → 63 KB, agreed); the `@pipeup/inline` add-on; `pipeup read`'s asks; tests, README, guide entry and
  worked example (`libs/ts/addons/examples/inline/`). Answers are recognised by their `Asked: ` excerpt. Dictation in an
  ask's box and asks added after start are not built yet.
- 2026-10-31 — Remove an answer: `post` takes `remove` (the reviewer's own comment, deleted as Delete does, replies and all), refused unless a press in the add-on's place started it. The add-on asks once more inside the ask (Remove / Keep, ignoring a press within 500 ms of the one that asked), and changing an answer shows one Cancel, in the button row for choices and agree, under the box for open asks.
- 2026-10-31 — Agents never answer an ask, enforced: the add-on and `pipeup read` skip a thread on an ask whose first comment is by an agent the page lists (`data-pipeup-agents`) or under an AI name. It stays on the block as a comment, never counted. Agents' own routes (replies file, link, paste, Share) already carry only replies, addressed notes and reactions.
