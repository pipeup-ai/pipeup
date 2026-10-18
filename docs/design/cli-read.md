# Design: `pipeup read`

Spec: [§15f](../FUNCTIONAL_SPEC.md). Status: built (0.8).

## Shape

`cli/read.mjs`, called from `cli/pipeup.mjs`. It opens the page's document in memory with `dist/pipeup.core.js`
(`PipeupDocument` over a `MemoryStore`, with a throwaway identity that writes nothing), merges what each source holds
through `doc.merge`, the same checks every comment meets in the page, and prints `agentComments()`: the Markdown of
Copy as Markdown and the threads of `Pipeup.comments()`. The core build now exports `readFeedbackFile` and
`agentComments` for this.

## Sources

- **Feedback files** (`--from`, a file or a folder; `--deep` for folders inside): `*.json` and `*.pipeup` files.
  Each is read with `readFeedbackFile` (sealed ones with the page's key). A file given by name that fails makes the
  exit code 1; a file met in a folder that isn't feedback for this page is only named, with why.
- **The replies file** beside the page (`page.replies.js`): read as data (the JSON inside each `push(…)`), never run.
  Only ops from agents the page lists (`data-pipeup-agents`) are merged; the rest are counted.
- **The shared copy**, when the page has `data-pipeup-share`: through `connectShare` from `@pipeup/share/headless`
  with `sendable: () => false`, so nothing is ever sent. The add-on isn't a dependency of `pipeup`: it is loaded from
  beside the package or from the project the command runs in, and without it the command says what to install. What
  the share engine receives is merged in short batches after its read, so the command waits until nothing more lands
  for half a second (at most ten).

## What is reported

Counts are kept per source: ops new to the document, ops it already had (the same comment from two places, "shown
once"), and the rest, which failed the checks (forged, altered, or for another document). The comments go to standard
output and everything said about the sources to standard error, so `pipeup read page.html > review.md` holds only the
comments.

## Where each thread is

No page is opened, so nothing is measured: the place is built from what the comment saved (its slide, its block's
`data-pipeup-id`, its quote or pin, else the snapshot of what the reviewer saw). Threads are in page order where the
page marks the block, else where the quoted words appear in the page's source, else in the order they were written.

## Change log

- 2026-10-13 — Built. Tests: `libs/ts/pipeup/e2e/read.spec.ts` (folders, `--deep`, duplicates, a changed comment,
  `--json`, `--out`, replies from listed and unlisted agents, exit codes, the share add-on missing) and
  `libs/ts/addons/e2e/read-share.spec.ts` (a real shared copy on the reference mailbox, and nothing sent to it).
