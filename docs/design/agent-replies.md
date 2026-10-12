# Agents reading and answering comments

Functional requirements: [FUNCTIONAL_SPEC §15b](../FUNCTIONAL_SPEC.md). This note says how.

## Reading

`Pipeup.comments({ all? })` is on the page's global and on the mounted instance. It builds the same Markdown as Copy
as Markdown (`copyAll`, with an `all` option for resolved threads) and the threads as plain data (id, state, where,
element, quote, comments with `by` and `agent`). It reads only what the page already shows.

## Answering

An answer is two kinds of signed op in the ordinary model, from the agent's own Ed25519 key:

- `reply` (the thread is the target), shown like any reply; the stored name is `AI assistant · <name>` (shown as just `<name>`), so the existing
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

## The live link

`cli/link.mjs`. `pipeup watch page.html --agent Claude` runs a small server on `127.0.0.1` (random port). It serves the page's
folder read-only (no path outside it) and changes only the page's own `<html>` tag on the way out: it adds the agent's
public key to `data-pipeup-agents`, and `data-pipeup-link` (`/__pipeup/<secret>`, a fresh random secret each run),
`data-pipeup-link-agent` and `data-pipeup-link-file`. The file on disk is never touched.

The one API route is `POST /__pipeup/<secret>/comments`. It refuses a `Host` that isn't the server's own (so a name
pointing here from another site can't use it), an `Origin` that isn't the server's own, and a wrong secret. A page from
another site can't read the secret either (a cross-origin page can't read the response). The body is the page's snapshot:
`{ v: 1, at, title, open: AgentComments, all: AgentComments }`, written to `<page>.comments.json` (atomic rename).
`pipeup comments` only reads that file, so it works with the server stopped.

The page side (`ui/link.ts`) does nothing unless the attribute is there. Its menu switch is off on every load; switched on it
sends a snapshot at once, then after each change (300 ms quiet). A failed send switches it off and says so. Replies need no
new route: `pipeup reply` writes `<page>.replies.js` into the served folder, and the page's every-4-seconds check (15b) reads
it from the same origin.

## Size

Core grows by 2.6 KB gzip, mostly the prompt text, the loader and the thread/menu UI; the budget is raised from 42 to
46 KB and the release notes say so (the link added 0.4 KB).

## Change log

- 2026-10-12 — First version, with the build.
- 2026-10-12 — The live link.
