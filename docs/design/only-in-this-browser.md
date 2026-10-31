# Only in this browser

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §11 (the shared copy). Visual spec:
[Only in this browser](https://claude.ai/artifact/BmLqPSCE5LgpV3kJhcUZok) (29 October 2026), approved with one wording and
the size budget raised to 60.5 KB. Follows [comments-stay-here.md](comments-stay-here.md), which says where comments
are for the whole page; this marks the exceptions on a shared page.

## What was built

| Comment | Mark | Tooltip |
|---|---|---|
| Mine, written before the page was shared, not decided | Only in this browser | Written before this page was shared. Share it or keep it from the menu. |
| Mine, written while Send my comments was off | Only in this browser | Written while Send my comments was off. It stays here. |
| Mine, earlier ones I chose to keep | Only in this browser | You chose to keep it here. |
| Mine, a reply or edit placed with the comment it belongs to | Only in this browser | Part of a comment that stays in this browser. |
| Mine, kept by an earlier version of Share that didn't record why | Only in this browser | It stays in this browser and isn't sent to the shared copy. |
| Mine, sent; anyone else's; any comment on a plain page | None | |

- **Pipeup**: `host.setCommentMark(comment, { text, tip } | null)`, capability `commentmark`. An open thread draws a
  quiet line under the comment's words (the `browser` glyph and the text, the tip as its tooltip); a closed card in All
  comments draws only the glyph after the time, named by the text. Unlike `setThreadMark` it is per comment, so a
  reply is marked alone, and it never draws the AI ring. A new mark eases in; one taken away eases out where it was
  (opacity only with reduced motion). The latest add-on to set a comment's mark owns it: only its own null, or its
  removal, takes it away. A thread redraws only when a mark on one of its own comments changes.
- **Share**: `Policy.local(op)` only reads: it says why one of my comments isn't in the shared copy (`held`, `kept`,
  `chosen`, `thread`, `unknown`) or null. New local ops are placed by `sendable` as they are made, so a comment written
  while not sending is marked when it is posted; an op already sent is never placed again, so turning sending off
  never marks (or strands the edits of) comments already in the shared copy. Share sets the marks on every refresh and
  local change, and takes a mark away when its comment is shared. With the shared copy gone it marks nothing.
- **Wording**: "Keep them on this machine" (with a lock) is "Keep them in this browser" (with the browser glyph);
  Share's other "on this machine" sentences say "in this browser". `chosen` is saved with the rest of Share's choices.

## What it costs

Pipeup's bundle went from 60.0 to 60.3 KB gzip; the budget is 60.5 KB, its reason recorded in `scripts/size.mjs`.

## Not in this change

- Live marks nothing: it sends every comment while live.

## Found in review

- Placing ops while reading marks (calling `sendable` from `local`) moved comments already sent into `kept` when
  sending was turned off, which would have kept their later edits out of the shared copy. Placing happens only for new
  ops now.
- Replies in a held or chosen thread were told "Written before this page was shared"; they say they are part of such a
  comment. Comments a reviewer kept with 0.8.2 had no reason saved; they get one that is true either way.
- A single revision for all marks redrew every thread on any change, losing focus in an open Edit box elsewhere.

## Change log

- 2026-10-30 — Built, with the review's fixes.
