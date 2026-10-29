# Comments stay here

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (*The comment box shows where comments go*) and §7 (the menu's top
line). Visual spec: [Comments stay here](https://claude.ai/artifact/WJmkP27ewzhnxUhTrqreAe) (29 October 2026).
Reviewers with plain Pipeup expected their comments to turn up on other people's copies, the way they do in a shared
document; Pipeup never said otherwise. The first proposal put a line in every comment box; the maintainer asked for the
menu instead, with an icon on the box.

## What was built

| Where | Plain Pipeup | While an add-on sends comments elsewhere |
|---|---|---|
| The menu's top line (the status slot) | "Only in this browser until you send them." (one line at the menu's width) | The add-on's status, as before: Share's "Shared · up to date", Live's "Live · 2 here". |
| The comment box, at the foot, left of Cancel | A small browser-window glyph (`browser` in `icons.ts`); its tooltip and screen-reader name are the same sentence. | No glyph while any add-on reports in the menu or shows a line in the box. Share's line above the field shows until the reviewer's first shared comment, as before; after it the box carries neither. |
| The reply line under a thread | Nothing. | Nothing. |

- The menu line is the status row Pipeup already draws for add-ons; it now never goes away, it only changes words.
- The glyph costs no height, so the box's layout and the browser tests of the tightest windows are untouched. It
  sits in the button row's empty left side: at the end of the top line it pushed "You're Green Otter · add your
  name" into an ellipsis in a 250 px box.
- An icon alone wouldn't carry the explanation; the words are in the menu, one press from the control or from All
  comments' ⋯.
- Not "private" (promises something about security it doesn't mean), not "only you" (a shared computer), no lock
  (reads as encrypted).

## Found while building

- Share shows its box line only until the reviewer's first shared comment, so a glyph that went only with an add-on's
  box line would have said "stay in this browser" on a shared page from the second comment on. The glyph follows the
  menu's line instead: it shows only while that line is Pipeup's own, and fades rather than vanishing.

- The icon's key was first `here`, which is on the build's property-mangling list (`scripts/mangle.mjs`): the object
  key was shortened and the string passed to `icon()` was not, so the box threw while opening. The key is `browser`.
  Icon names are plain-object keys and must stay off that list.

## Proposed, not built: comments that stay while others are shared

On a shared page a reviewer can have both: comments written before sharing (held until they choose) and, with Send my
comments off, comments written since; everyone else's arrive meanwhile. Today those threads look like all the others.
Proposal: Share marks each thread of this reviewer's that is not in the shared copy with a quiet line at the thread's
end, "Only in this browser", using the thread-mark slot (`setThreadMark`). Plain Pipeup marks nothing: there the menu
says it for all of them. Awaiting the maintainer's answer.

## Change log

- 2026-10-29 — Built as the menu line and the box glyph, after the box-line version was reworked.
