# Agents reading and answering comments

Functional requirements: [FUNCTIONAL_SPEC §15b](../FUNCTIONAL_SPEC.md). This note says how.

## Reading

`Pipeup.comments({ all? })` is on the page's global and on the mounted instance. It builds the same Markdown as Copy
as Markdown (`copyAll`, with an `all` option for resolved threads) and the threads as plain data (id, state, where,
element, quote, comments with `by` and `agent`). It reads only what the page already shows.

## Answering

An answer is two kinds of signed op in the ordinary model, from the agent's own Ed25519 key:

- `reply` (the thread is the target), shown like any reply; the agent's name is `AI assistant · <name>`, so the existing
  AI marking applies (`isAiName`).
- `addressed` (new kind): words are required. Folding sets `thread.addressed`; `reopen` clears it; `resolve` leaves the
  thread resolved. Nothing in the model lets an addressed op resolve a thread.

Ops travel in a **replies file**: a script, not JSON, because a page opened from disk cannot `fetch` a file but can run a
script next to it:

```js
(globalThis.pipeupReplies ||= []).push({ format: "pipeup-replies", v: 1, doc, ops: [ ... ] });
```

`ui/replies.ts` drains `globalThis.pipeupReplies` and loads `<page>.replies.js` (or `data-pipeup-replies`) by adding a
script inside Pipeup's own shadow root, so the host page is never touched. It only loads a file on the same site or, for a
page opened from disk, the same disk. It keeps ops whose author is listed in `data-pipeup-agents` and whose kind is
`reply` or `addressed`; everything else is counted as ignored. Kept ops go through `doc.merge`, which checks shape,
derived id and signature like any other op, and ignores ones it already has.

Nothing is loaded unless an agent is listed. "Check for replies" and the page's start-up read the file again with a new
query each time.

## The agent's side

`cli/pipeup.mjs` (`bin: pipeup`) imports `pipeup/core` only. `agent` makes the key once (extractable Ed25519, JWK, mode
0600 in `~/.pipeup/agent.json`; `PIPEUP_AGENT_FILE` overrides it for tests). `reply` reads `data-pipeup-doc` from the page,
signs with the clock set to seconds since 1970 (later than any counter a browser has kept, and below the clock cap), and
rewrites the replies file with the old ops and the new ones.

## Size

Core grows by 2.6 KB gzip, mostly the prompt text, the loader and the thread/menu UI; the budget is raised from 42 to
45 KB and the release notes say so.

## Change log

- 2026-10-12 — First version, with the build.
