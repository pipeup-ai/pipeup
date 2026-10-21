# Editions: comments stay with the edition the page names

Builds §4 and §8's edition attribute. Mock-ups: `edition-attribute-mockups.html`. The earlier way, one identity per
edition, stays documented in the integrate skill for pages that want editions wholly apart or run an older Pipeup.

## The attribute

`<html data-pipeup-edition="…">`, read as written (trimmed, at most a view value's length). `createHere` watches it
with a `MutationObserver`, so a swap is followed with no reload: the app re-finds every comment's content (a comment
from the edition now showing may have been orphaned on purpose while another showed) and sorts them again.

## Where a comment keeps its edition

In its anchor's view, under Pipeup's own key `pipeup-edition` (the `EDITION` constant), beside the slide and whatever
the page reports. `setViewState` drops that key, so a page can't forge it; `viewName` leaves it out of a view's
readable name. A comment with no edition on a page that names one counts as an earlier edition's ("From before
editions"), so adopting the attribute stops old comments landing on today's content at once.

## What `earlier` changes

`Here.earlier(view)` is true for a comment from another edition than the page names, never on a page that names
none. It is threaded through the app as `ctx.earlier(t)`:

- **Finding content** (`resolveAll`): an earlier comment is recorded orphaned without looking, so it is never matched
  to this edition's content and never Moved. `lost` and `moved` both say no for it, so it isn't listed under "No longer
  on the page" or flagged.
- **Sorting** (`classify`): it is elsewhere, so nothing of it shows on the page, and `Here.holds` says no.
- **The control**: `tally(true)` leaves earlier comments out, so neither the number nor the "elsewhere" dot counts
  them.
- **All comments**: this edition's threads come first, as today; earlier ones go last under a folded **Earlier
  editions · N open** button (`aria-expanded`), which the person opens; it stays open while one of its threads is the
  open one. Each card's "about" line names the edition ("In the 2026-10-20 edition · “…”"), and opening it shows the
  thread with its snapshot and that place, as a thread from another view does. Going there uses `navigate`, which
  reaches the edition only if the page registered an `onReveal` handler.

## Agents

`Pipeup.comments({ edition: true })` keeps only this edition's threads. Copy for my agent uses it, says "on the
<edition> edition" in its heading, and counts the open comments on earlier editions it left out.

## Size

+0.6 KB gzip in Pipeup; the budget goes from 60.5 to 61 KB.

## Change log

- 2026-10-21 — First version.
