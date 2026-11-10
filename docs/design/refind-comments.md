# Re-finding comments

Status: **built** (2026-11-09). Functional requirements: [FUNCTIONAL_SPEC §8](../FUNCTIONAL_SPEC.md) and
[EXTENSION_SPEC §5](../EXTENSION_SPEC.md). Visual spec: [refind-comments.html](refind-comments.html), published at
https://claude.ai/artifact/NUNJSUpotojJEHaDk63bZX. Targets `next`.

Code paths are relative to `libs/ts/pipeup/`.

## Today

- `src/anchor/describe.ts`: a text comment keeps `quote` (exact, 32 characters either side), a clicked element only
  `path` (`:scope > tag:nth-of-type(n) > …` from the nearest `data-pipeup-id` or the root). Both keep `fingerprint`
  (the block's text hash) and `snapshot` (200 characters).
- `src/anchor/resolve.ts`: quotes resolve exactly by best context, then approximately (`approxFind`, quotes 12–300
  characters, pages up to 50,000 characters). Elements resolve **only** by `path`; a hit with a different fingerprint is
  "moved", even when it is a different element. No path, no element: "orphaned".

## Agreed decisions

- Anyone reading answers "Is this the right place?"; the answer is kept for everyone ("Ada confirmed the place").
- Pictures in the extension: on by default, in that browser only.
- "Orphaned" is called Lost in the spec, as people already see it.

## Clues (anchor fields)

New optional fields on `Anchor`, set by `describeElement` and (`heads` only) `describeRange`:

| Field | What | Limit |
|---|---|---|
| `kind` | `h`, `p`, `img`, `button`, `link`, `field`, `media`, `box` | one of these |
| `name` | accessible name: `aria-label`, `alt`, a label's text, `title`; else an image's file name; for links, also `href` path | 200 |
| `heads` | the headings it sits under, outermost first (`["Pricing", "Business"]`) | 3 × 120 |
| `y` | where it was down the commentable area, 0–1 | unit |

`isAnchor` ignores keys it doesn't know, so older Pipeups accept comments that carry them and simply don't use them.
`isAnchor` gains checks for the new keys; `LIMITS` gains `name` and `head`.

## Re-finding (`src/anchor/resolve.ts`)

For an element anchor:

1. `id` and `path` as today. If the element there has the stored `fingerprint`: **attached**.
2. Otherwise collect **candidates**: elements of the same `kind` inside the base (bounded: the first 2,000 by document
   order). Score each, 0–1:
   - words: 1 when the fingerprint matches, else similarity of the start of its text to `snapshot` (trigram Dice, so
     reworded text still scores);
   - `name` equal (0.25), `heads` path equal or ending the same (0.2), `y` within 0.15 (0.1);
   - weighted: words 0.45, name 0.25, heads 0.2, place 0.1; missing clues drop out and the rest are rescaled.
3. The best candidate wins when it scores at least **0.6** and beats the runner-up by **0.15**. The path's own element
   is just one candidate, so a new sibling no longer captures the comment. Winner equal to the path's element with
   a changed fingerprint: **moved** (as today). Any other winner: **moved, look-alike**, which asks.
4. Otherwise **lost**.

Text anchors keep today's matching (exact with context, then approximate); they gain `kind` (their block's) and
`heads`, used for the Lost record. A heading-based fallback for quotes was left out: approximate matching already
covers reworded text, and it would cost size for little.

Old anchors (no new fields) score on words and the path's place only, so behaviour on them is today's, except that an
element whose path now holds clearly different words is no longer called moved when a better match exists.

The candidate search runs in the existing deferred pass (`pendingFuzzy` in `src/ui/app.ts`) so first paint stays fast.

## Confirming and re-pointing: a new op, `place`

- `place` (thread, `anchor`, `text` = `confirmed` | `moved` | `gone`): the thread's place is now this anchor. Sent by
  **Yes** (the current element, described again, so the clues follow the page), by **Not here** → pick (the clicked
  element), and by **It's gone** (the anchor with `lost: true`, so the comment is Lost on purpose and never asks
  again).
- Anyone may send it. The thread's place is the latest `place` by the usual op order, else the create's anchor.
- The thread shows a quiet line for each: "Ada confirmed the place", "Ada moved this comment", "Ada marked the place as
  gone".
- Older Pipeups don't know `place` and leave it out, as they do any op they can't read: they keep re-finding from the
  create's anchor. Share, Live and the mailbox carry it like any other op.

## UI

- `src/ui/thread-view.ts`: an open look-alike thread gets a row in the style of an agent's Addressed note: "Is this the
  right place?" with Yes · Not here · It's gone. A lost thread's line reads "No longer on the page · it was {kind}
  under {heads} — it read “…”", and its open thread has "Show where it belongs". After an answer, a quiet line names
  who placed it.
- Picking: Not here sets `state.picking` and turns comment mode on with the hint "Click where this comment belongs ·
  Esc to cancel". Comment mode's next chosen block (`commentOn`) calls `ctx.repoint` instead of opening a draft; turning
  comment mode off cancels.
- All comments' "No longer on the page" group keeps its name.

## Copy for AI

`src/anchor/locate.ts` (used by Copy for AI and `pu.comments()`): a look-alike thread's place ends "Moved, not yet
confirmed (it was {kind} under {heads}, it read: "…")"; a Lost one reads "No longer on the page (it was {kind} under
{heads}, it read: "…")".

## Pictures (extension only)

- At create, the extension calls `tabs.captureVisibleTab` (JPEG, quality 70), crops to the comment's box plus 48 px,
  blurs outside the box, scales to at most 480 px wide (about 20 KB) and keeps it in the extension's storage by thread
  id. Never in the op, never shared, never in Copy for AI.
- Pipeup gets an optional `pictureOf(thread)` hook on `mount`; the "was" box shows the picture when it returns one,
  with "How it looked when {name} commented · only in this browser".
- A setting in the extension turns pictures off and deletes the ones kept.

## Size

It added 2.0 KB gzip to Pipeup (63.5 → 65.5 KB) and 1.5 KB to the core (10.7 → 12.2 KB), more than the 1.5 KB
estimated. Budgets raised with the maintainer's agreement: Pipeup 66 KB, the core 12.5 KB (`scripts/size.mjs`, and the
combined add-on files in `libs/ts/addons/scripts/build-all.mjs`).

## Tests

- Unit (`test/anchor`): new sibling inserted before (follows the right element); element reworded (moved); two equal
  look-alikes (lost); old anchors without clues (unchanged results); clue limits in `isAnchor`.
- Browser (`e2e/refind.spec.ts`): the pricing page from the visual spec, before and after; Yes clears the question for
  a second reader; Not here → pick moves it; It's gone makes it Lost; Copy for AI wording; both looks.
- Older-version compatibility: a fixture of ops with new anchor fields and a `place` op, read by the 0.9.1 bundle.

## Change log

- 2026-11-09 — Agreed with the maintainer; written.
- 2026-11-09 — Built. Kind words are a Map, since the build shortens the property name `box`. Text similarity is
  squared, so siblings that share words (prices, "a month") fall well behind the real match.
