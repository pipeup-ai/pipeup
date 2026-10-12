# The agents add-on

Status: **draft, for review**. Functional requirements: [FUNCTIONAL_SPEC §15d](../FUNCTIONAL_SPEC.md) (with §15b and §15c,
which say what a person sees and what an agent may do, unchanged). Targets 0.7.

Code paths are relative to `libs/ts/pipeup/`. Today's design: [agent-replies.md](agent-replies.md).

## Why

Reading an agent's replies, the live link and the agent prompt serve only pages that have an agent. They cost every page
about 2 KB gzip (the replies loader, the link client, the prompt text and the menu and All comments wiring). Add-ons are
the way optional features ship (§11a), and add-ons can already merge signed ops, add menu rows, a status line and their
own styles. Core is 46.6 KB gzip against a 50 KB budget, and reactions and mentions are coming.

## What moves, what stays

| Piece | Where now | After |
|---|---|---|
| Replies loader: queue, file loading, polling, the listed-agents filter, ignored count (`ui/replies.ts`) | core | add-on |
| Live link client: the switch, `fetch` to `data-pipeup-link`, snapshots (`ui/link.ts`) | core | add-on |
| Prompt text (`export/prompt.ts`, `agentPrompt`) and its menu row | core | add-on |
| Menu agent line, link row, prompt row (`ui/launcher.ts`) | core | add-on (menu and status slots) |
| All comments sentence and **Check for replies** (`ui/launcher.ts:765-775`) | core | add-on (a new slot, below) |
| `Pipeup.comments()`, `agentComments` (`export/agent.ts`) | core | **stays** |
| `addressed` op, fold, and the addressed note with Resolve / Still not right (`model`, `ui/thread-view.ts`) | core | **stays** (comes from the model, whatever the source) |
| AI marking: `isAiName`, the AI avatar, `data-pipeup-ai` | core | **stays** |
| The Markdown's closing instruction (`export/format.ts`) | core | **stays** |
| CLI: `agent`, `reply`, `comments`, `watch`, `skills` (`cli/`) | package | unchanged, plus injection by `watch` |

Estimate: about 1.8 KB gzip leaves core (assist and the other add-ons show add-on overhead is small); the add-on is
about 3 KB gzip with its own small stylesheet for the agent line and the sentence.

## New package

`libs/ts/addons/agents` (`@pipeup/agents`), built like the others (`scripts/build-all.mjs`, a combined
`pipeup+agents.min.js`, an integrity hash in `sri.mjs`). Add-on id `agents`. `needs`: `menu`, `status`, `notify`,
`styles`, `sign`? (it doesn't sign; the replies are already signed by the agent), plus the new `listnote` below.
`network: { when: "page-configured", to: ["page"], says: ... }` (the sentence in §15d).

Reading the replies file keeps today's rules (`ui/replies.ts`): only a file next to the page on the same computer or
the same site; the file's script is added inside Pipeup's shadow root, never the page; ops are checked by
`host.merge` as strictly as a feedback file's; only ops from listed agents and of kind `reply` or `addressed` are kept;
the rest are counted as ignored. `host.merge` already takes the add-on's id as the source, so a replies file can't be
mistaken for a person's.

## One new slot: `listnote`

All comments has no place for an add-on's sentence and button. Menu rows and the status line exist; the panel header
doesn't. A small slot:

```ts
host.setListNote({ text: string, action?: { label: string; run(): Promise<void> } } | null): void
```

It draws a quiet line under the All comments header with an optional text button (the way **Check for replies**
looks now: `.ag` in `src/ui/styles.ts`), eased in and out, removed with the add-on. Capability name `listnote`; the
add-on stays off with a reason on a Pipeup that doesn't have it (§11a). The existing CSS for that line moves with the
add-on, and `.adr`, `.seen` and the agent line classes either stay in core (addressed note, used without the add-on) or
become hooks the add-on styles by (see [addons.md](addons.md), "Hooks for styling core's own parts").

## The live link and `pipeup watch`

`pipeup watch` already rewrites the page's `<html>` tag (`cli/link.mjs`: lists the agent, adds the link attributes).
It also adds one `<script src="<link base>/agents.js">`, served by the command itself from `dist/pipeup.agents.js` in the
installed package. Nothing is read from a CDN, and the page's file on disk is untouched, as now. The script is added
**after** Pipeup's own, as an add-on registers through the queue in any order (§4).

The add-on's link client is the same code as today's `ui/link.ts`, driven by the same attributes
(`data-pipeup-link`, `-agent`, `-file`). The snapshot it sends is `Pipeup.comments({ all: true })`'s data plus the
page's ops; it needs no private core API.

## Compatibility

- **Published versions don't change.** A page on 0.6.x keeps its built-in agent support.
- **0.7 and later, no add-on, agent listed:** core keeps one check (about 100 bytes): if `data-pipeup-agents` lists a key
  and no add-on `agents` registers within the first second, `console.warn("pipeup: this page lists an agent, but the
  agents add-on isn't on the page; replies won't show. See https://…")`, and the add-on state appears in the check.
- **Add-on on a page whose Pipeup already has agents (0.6):** the add-on's `needs` lists `listnote`, which 0.6 lacks, so
  it stays off with a reason. (No flag is needed.)
- **Data and commands:** replies files, signed replies, the keys in `~/.pipeup/agent.json`, and the CLI's output are
  byte-identical. `pipeup comments` is unaffected: it reads what `Pipeup.comments()` shares.
- **Skills:** `pipeup-add` adds the add-on (with its integrity hash) when the author asks for replies, and says what
  that lets the agent do. Every skill's version line moves to 0.7; older installed skills still work against 0.6 pages.
- **Floating addresses** (`pipeup@latest`, `pipeup@0`) would lose the loader on the next CDN refresh; the docs already say
  to pin the exact version, and the CHANGELOG and the console warning say what changed.

## Order of work

1. Core: the `listnote` slot (and its tests), still alongside the built-in code.
2. `@pipeup/agents`: port `replies.ts`, `link.ts`, the prompt and the rows; move the tests (`test/agent-replies.test.ts`,
   `e2e/agent-replies.spec.ts`, `e2e/agent-link.spec.ts`) so they run with the add-on loaded; the CLI tests stay.
3. `pipeup watch` injection and the `dist` copy.
4. Core: remove the built-in code, add the one-second warning, update the size budget and the combined files.
5. Skills, `llms.txt`, README, `docs/RELEASE.md` (the add-on is part of releases and SRI), the CHANGELOG.

## Tests

The existing agent suites pass unchanged except that they load the add-on; plus: a page on a 0.7 core with an agent
listed and no add-on warns once and loses nothing else; the add-on on a core without `listnote` stays off with a reason;
`pipeup watch` serves the add-on and the page's file is byte-identical; reduced motion still holds for the line and the
sentence; the added bytes of core's check stay under 150.

## Decided / open

- Decided (2026-10-12, maintainer): move agent support out of core into an add-on; the AI pulse and the writing dots
  already live in the assist add-on.
- Open: ship this in 0.7 with touch and narrow pages, or on its own as 0.6.1-style change (recommend 0.7: it changes
  what authors must add); whether `pipeup watch` should refuse a page whose Pipeup is too old for the add-on.

## Change log

- 2026-10-12 — First draft.
