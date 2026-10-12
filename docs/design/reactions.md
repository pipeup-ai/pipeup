# Reactions

Status: **draft, for review**. Functional requirements: [FUNCTIONAL_SPEC §7b](../FUNCTIONAL_SPEC.md).
Targets the next milestone.

Code paths are relative to `libs/ts/pipeup/`.

## Model

Reactions are two new kinds of signed op in the existing model (`src/model/types.ts`), so they are signed,
ordered, merged and shared exactly like comments:

- `react`: `thread`, `target` (the comment or reply), `text` = the emoji (one emoji sequence).
- `unreact`: same fields; takes the author's own reaction back.

Fold (`src/model/fold.ts`): in clock order, `react` adds `(author, emoji)` to the target's reaction set,
`unreact` removes it. Idempotent, so the last op by that author for that emoji wins on every peer. The
folded comment gains `reactions: { emoji: string; by: { author: string; name: string }[] }[]`. Only the
author's own `unreact` counts (as `edit`/`delete` already require). Deleting a comment drops its set.

Validation (`src/model/ops.ts`):

- `text` must be a single emoji grapheme sequence, at most 16 code points, from a built-in recogniser
  (no table needed for validity: Emoji_Presentation / `\p{Extended_Pictographic}` with ZWJ, variation selectors,
  skin-tone modifiers, flags and keycaps). Anything else is dropped.
- At most N (proposal: 12) distinct emoji per comment; later ones are dropped.
- `react`/`unreact` need `target`; they are not shown as comments and never create threads.

**Compatibility.** `isWellFormed` rejects unknown `kind`s. We need to confirm that one unknown op is *dropped*, not
that it makes a whole feedback file or share fail ("older copies ignore them"). If it fails whole files, add the
tolerance first, in a patch release on `main`, before reactions ship.

## UI

- Rendering: the comment's footer row (`.ft`/`.rft`, `src/ui/styles.ts`) already eases open on hover/focus. Reaction
  chips sit under the words only when present; the "add" control joins the footer. Emoji are text in the device's
  font, in a button; counts use the existing rolling-number treatment; light colours only; everything eases.
- Quick row: six fixed emoji in a small popover from the add control (`popover()` in `src/ui/layout.ts`), keyboard
  reachable (arrows, Enter, Esc returns focus to the control).
- Who reacted: the existing reference-popover pattern (`.ref .rc`).
- Accessible name per chip: "Thumbs up, 3 people, including you". Names of the six quick emoji live in the core;
  the picker add-on supplies names for the rest, and without it a chip reads "Reaction, 3 people".
- Copy for AI / `Pipeup.comments()`: add `reactions` to the thread data and a `👍 2 (Sam, Red Fox)` line in the
  Markdown.
- Agents (`pipeup reply`): a `react` command alongside `reply`; the agent's op is marked like its replies.
- `ui/replies.ts` keeps only `reply`/`addressed` today; extend the allow-list to `react`/`unreact` from listed
  agents.

## Full picker: an add-on

The full standard set with names, groups, search keywords and skin tones is on the order of 50–100 KB raw
(~15–25 KB gzip even compacted), well over the core's remaining budget. So: `libs/ts/addons/emoji` (`@pipeup/emoji`),
data generated from the Unicode CLDR/emoji files **in this repository** at build time (a dev dependency, never
shipped as a dependency), no network, no third-party code at run time. Slot: a `reactions` capability that gives the
core a picker component and emoji names; without it, the quick row.

- Only emoji the device can draw: test each candidate once with a canvas measure against a known-missing glyph;
  cache the result.
- Skin tone: remembered per browser in the same storage the name uses.

## Size

Core: two op kinds, fold, a recogniser and the chip UI: estimate 1.0–1.5 KB gzip. The budget (46 KB) has headroom
only if the isolation work doesn't use it; measure first (`scripts/size.mjs`) and cut by the order in the
add-ons design if needed.

## Tests

Unit: fold (add, remove, idempotence, order, only-own-remove, delete drops, limit, invalid emoji). Browser: add/remove
by pointer and keyboard, counts, who-reacted popover, reduced motion, resolved thread, All comments counts, sharing
round trip, an older build ignores the ops (use the previous release's bundle).

## Open

- Quick row contents and whether it's per-author configurable (recommend no).
- Are agent reactions shown by default (recommend yes, marked).

## Change log

- 2026-10-12 — First draft.
