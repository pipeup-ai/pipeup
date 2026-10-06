# Pipeup — Architecture (dev design)

**Status:** Draft for review · **Last updated:** 2026-10-06
**Implements:** [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md)
**Mock-ups:** kept with the maintainers (not in the public repository); the website's Try pages show the built UI

This is the *how*. Requirements live in the functional spec; anything here can change without
changing what Pipeup promises.

---

## 1. Big picture

![Pipeup architecture](images/architecture.svg)

| Unit | Path | Manifest | Ships as |
|---|---|---|---|
| Browser library (core + UI + storage adapters) | `libs/ts/pipeup` | `package.json` | npm `pipeup`; CDN builds |
| CLI (`check`, `merge`, `summary`, `relay deploy`) | `apps/cli` | `package.json` | npm bin |
| Relay | `services/relay` | `package.json` (Wrangler) | Deployed by each author to their own Cloudflare account |
| Agent skills | `apps/agent-skills` | none (markdown) | Bundled with the CLI and published alongside |

Language: TypeScript throughout. The library has **zero runtime dependencies** — a smaller
attack surface and an easier audit.

### Build outputs

- **Classic IIFE bundle** (`pipeup.min.js`) — the default. It works from `file://`, where Chrome
  refuses local ES-module scripts.
- **ESM bundle** for bundler users.
- Every release publishes **SRI hashes** and a signed provenance attestation (npm provenance).
  Docs always show the pinned form:
  `<script src="https://cdn.jsdelivr.net/npm/pipeup@1.2.3/dist/pipeup.min.js" integrity="sha384-…" crossorigin="anonymous">`.

## 2. Library internals

```
core/      model (threads, comments, ops), anchoring, re-anchor loop, events API
ui/        custom element <pipeup-root> with an open shadow root; gutter, drawer, pins, panel
adapters/  slide adapters (generic, reveal.js, …) — current slide, go to slide, slide element
storage/   local (IndexedDB), file (export/import), relay (WebSocket)
crypto/    room + document keys, signing identities, envelope format
```

### Not touching the host page

- All UI renders inside **one `<pipeup-root>` element under `<html>` with an open shadow root**
  (open so `pipeup check` and agents can measure it), a fixed click-through layer and a
  constructed stylesheet. Page CSS can't reach in; our CSS can't leak out. Text highlights use a
  constructed stylesheet adopted by the document, so no `<style>` is ever added to the page.
- Text highlights use the **CSS Custom Highlight API** (`CSS.highlights`), so the page's DOM is
  never wrapped or mutated. React or Vue reconciliation is unaffected.
- Pins and gutter cards are positioned from `getBoundingClientRect()` and updated by
  `ResizeObserver`, `IntersectionObserver` and scroll listeners, batched with `requestAnimationFrame`.
- Pipeup never calls `eval`, never uses `innerHTML` with comment content, and runs under a
  strict page CSP (`script-src` for its own origin plus a hash; no `unsafe-inline` needed for styles,
  which are adopted stylesheets).

### Theming

Pipeup reads the computed `font-family`, `color-scheme` and an accent colour (from
`--pipeup-accent`, otherwise the colour of the first link) from the host page and maps them
onto its own tokens.

## 3. Anchoring

![Anchoring](images/anchoring.svg)

Built on the W3C Web Annotation selector model (the approach Hypothesis has proven). Each anchor
stores, in order of strength:

1. `data-pipeup-id` of the nearest marked element;
2. `TextQuoteSelector` — exact text plus 32 characters of prefix and suffix;
3. element path — a CSS path from the nearest stable ancestor;
4. a point within the element as fractions of its box (charts, canvas, images, slide pins);
5. a snapshot — the quoted text, a short text context, and the view state (`route`, `slide`,
   `step`, plus anything the page supplies via `pipeup.setViewState()`).

**Re-anchor loop.** A debounced `MutationObserver` re-resolves affected anchors. Resolution
tries the selectors in order. A fuzzy text match (bounded edit distance) scores the result:
exact → *Attached*, fuzzy or found via a weaker selector → *Moved*, nothing → *Orphaned*.

**Hidden views.** Pages register `pipeup.onReveal(viewState => …)` so the panel can reopen a
tab, route or slide. Slide adapters implement this for decks.

**Document versions.** A document fingerprint (a hash of normalised text per marked block) is
saved with each comment. A changed block hash downgrades *Attached* to *Moved*.

## 4. Data model and sync

A document's feedback is an **append-only log of signed operations**:
`create`, `reply`, `edit`, `delete` (tombstone), `resolve`, `reopen`. Current state is a fold
over the log: last-writer-wins per field, ordered by (Lamport clock, time, author key, op id).
This is simpler than a general CRDT library (such as Yjs), every op is easy to sign, and merging
feedback files becomes a set union.

- **Content-addressed op ids.** An op's id is the base64url SHA-256 (all 32 bytes, 43 chars) of
  its canonical body without `id` (and, for `create`, without `thread`, which must equal the id).
  Every op is re-hashed on import before its signature is checked, so nobody can claim another
  person's op id with different content, and union-on-id merging is safe.
- **Bounded clock.** Valid ops have clock ≤ 2^40 and time ≤ 2^47 ms; new ops never fail at the
  caps — they stay at them. A reply, edit, delete, resolve or reopen is timed after the latest op in
  its thread, so it follows what it answers even when devices' clocks disagree; a new thread is
  timed after its writer's previous thread. Threads fold independently, so a far-future (or capped)
  time posted into one thread only affects ordering inside that thread — at the caps that thread's
  order falls back to author and op id — and never another thread or another writer's other ops.
  Writing is never blocked. In a thread pushed to both caps (only possible by a participant who
  deliberately signs such an op), edits, deletes and resolve/reopen may not take effect, and two
  identical new threads by one writer merge into one; other threads are unaffected. A later
  tie-break on op kind could recover edits and deletes there. Phase 2 relays may bound times by
  receive time.
- **Validation limits** (`LIMITS` in `src/model/ops.ts`): text ≤ 10,000 UTF-16 units, trimmed;
  names 0–80 chars, trimmed ("" is a reviewer with no name, shown as their animal); anchors fully typed with size caps; unknown extra fields are not yet
  rejected (make the v1 schema strict before the relay ships).

- **Local**: ops are kept in IndexedDB, keyed by document id.
- **Feedback file** (`<doc>.pipeup.json`): a header (format version, document id) followed by
  sealed ops. Importing a file is a union on op id, so duplicates collapse.
- **Relay**: the same sealed ops over a WebSocket. On reconnect the client sends its highest
  known sequence number per author and receives what it's missing.

**Presence** uses ephemeral messages over the same socket (cursor, slide, typing). They are
sealed, rate-limited client-side to about 15 Hz, and never stored.

## 5. Sharing and relay

![Sharing](images/sharing.svg)

### Relay on Cloudflare

- One **Worker** routes `wss://<relay>/r/<roomId>` to one **Durable Object per room**
  (SQLite-backed storage, WebSocket Hibernation so idle rooms cost nothing).
- The Durable Object stores sealed ops, fans out ops and presence to connected sockets, and
  enforces per-room limits (bytes stored, ops per minute per connection, maximum connections).
- An **alarm** deletes rooms after the inactivity TTL.
- About 300 lines of code, no dependencies besides Wrangler at build time.
- `pipeup relay deploy` wraps `wrangler deploy`. The author signs in with Wrangler's own
  login — we never handle their Cloudflare credentials.
- On the free plan, exceeding limits returns errors rather than billing. The exact current free
  limits for Workers, Durable Objects and storage must be verified at build time and recorded here.

### Keys and tokens

| Secret | Created by | Lives | Purpose |
|---|---|---|---|
| Document key (AES-256-GCM) | Integration (CLI or agent) | In the file (`data-pipeup-doc`) | Seals feedback files |
| Room key (AES-256-GCM) | Author, when a room is created | Invite fragment, or in the file | Seals ops and presence |
| Room write token | Relay, signed with the author's relay admin secret | Invite | Relay admits writers |
| Identity key (Ed25519) | Each browser, on first comment | IndexedDB, non-extractable | Signs every op |
| Relay admin secret | `pipeup relay deploy` | Wrangler secret plus the author's machine | Creates, lists and deletes rooms |

Invites look like `…/deck.html#room=<id>&key=<k>&t=<token>`, or a short code for pages opened
from disk. The fragment never reaches any server.

## 6. Security model

![Relay security](images/relay-security.svg)

| Threat | Mitigation |
|---|---|
| Relay or Cloudflare reads comments | All ops and presence sealed client-side with the room key |
| Strangers spam a relay or fill its storage | Signed write tokens; per-room quotas, rate limits, TTL; free plan fails closed |
| Impersonation, or tampering by members or the relay | Every op signed with Ed25519; the relay verifies signatures on write; clients verify on read |
| Relay drops or withholds ops | Per-author sequence numbers reveal gaps; the UI shows "some comments may be missing" |
| XSS through comment content | Text rendered with `textContent` only; links detected and rendered as `<a rel="noopener noreferrer">`, `https:` only |
| CDN or package tampering | SRI-pinned script tags; npm provenance; signed tags in the repository |
| Leaked room key | Close the room and start a new one. No forward secrecy in v1 — documented plainly |
| Malicious host page reads Pipeup data | Out of scope: the page owner controls the page. Pipeup says so in its docs |

Ed25519 in WebCrypto is supported in current Chrome, Safari and Firefox. Verify the minimum
versions during phase 1. A small audited fallback library is the contingency.

## 7. Platform findings (spike, 2026-10-05)

A test page opened from `file://` in headless Chrome on macOS:

| Capability | Result |
|---|---|
| `isSecureContext` | `true` |
| WebCrypto AES-GCM | works |
| localStorage, IndexedDB | work |
| WebRTC data channel (loopback) | message delivered |
| WebSocket to a public `wss://` relay | connected |

Still to test: **Safari and Firefox** (Firefox isolates each `file://` document by default, which
may affect IndexedDB persistence). Local ES modules fail from `file://`, hence the classic bundle.

### Peer to peer (deferred)

![Peer to peer from file://](images/p2p-file-protocol.svg)

Kept for a later phase. It works from `file://`, but it needs public signalling, STUN, and TURN
for strict networks, and it only works while people are online at the same time.

## 8. Check (`pipeup check`)

The CLI uses Playwright with Chromium. For each width (375, 768, 1440):

1. Load the page with Pipeup disabled and record the boxes of all visible elements.
2. Load it with Pipeup enabled and closed, record again, and diff. Any shift beyond 0.5 px fails.
3. Hit-test Pipeup's closed UI against page content and interactive elements. Overlap fails.
4. Count marked blocks, charts and slides. Unmarked ones produce a warning.
5. Run axe-core over Pipeup's shadow root for contrast and keyboard reachability.

Output: a human-readable table by default, and `--json` for agents. The exit code is non-zero
on any fail.

## 9. Agent skills

Skills are shipped as markdown in `apps/agent-skills/`:

- `pipeup-integrate` — add the script with pinned SRI, document id, `data-pipeup-id` on
  blocks, `ignore` on chrome, a slide adapter for decks; then run `pipeup check` until it passes.
- `pipeup-summarise` — read feedback files or a room export and group threads by section,
  theme and state.
- `pipeup-apply` — for threads the author approved: edit the page, reply with what changed,
  resolve.

## 10. Testing

- Unit tests: the op log fold, merge, signing and sealing, the selector resolution ladder.
- Anchoring fixtures: a corpus of dynamic pages (React re-render, virtual list, tabs, reveal.js
  deck, canvas chart) with scripted mutations and expected states.
- Browser matrix: Chromium, WebKit and Firefox via Playwright, both `file://` and `https://`.
- Relay: Miniflare or Wrangler local tests for quotas, TTL, token checks and signature rejection.
- Security: fuzz comment text for XSS; tests that the relay rejects forged ops.

## 11. Interaction design

The interactive mock-ups are the reference for look and feel. `mockups/pipeup-mock.js` is a
throwaway prototype of the UI layer (no storage, sync or security) shared by the deck and website
examples; the document page has its own gutter prototype.

| Mock-up | Shows |
|---|---|
| `comment-viewing.html` | Document column, text selection, threads, replies (shown nested; superseded by the one-level layout below), resolve, menu, copy for AI |
| `example-deck.html` | Six-slide deck: per-slide bubbles, pins, comment mode, keyboard navigation |
| `example-site.html` | Rich landing page: controls as targets, text highlights as targets, menu |
| `motion-playground.html` | Each motion rule, with a snap comparison and reduced-motion preview |
| `review-surfaces.html` | First static mock-up (superseded, kept for history) |

### Plan 2A (built)

- **Column vs bubbles.** `columnSpot` gives the document column its place (viewport x and
  width) when the commentable area is an `article`/`main` with at least 300 px free beside it,
  and returns nothing for slide pages and narrow windows; those use bubbles with popovers. The
  choice is read, never written: authors can force either with `<html data-pipeup-layout="column|bubbles">`. In 2A the column always sits to the right.
- **Resolve time budget.** Anchors resolve in passes of at most 40 ms; threads that run out of
  budget get only the exact match first and are shown as unplaced (not lost) until a deferred
  pass (250 ms later) gives them the fuzzy match, so they never flash as lost.
- **Three bundles.** `dist/pipeup.min.js` (classic script: core + UI + auto-mount, at most 32 KB
  gzipped), `dist/pipeup.esm.js` (core + UI for bundlers, no side effects, at most 32 KB) and
  `dist/pipeup.core.js` (core only, at most 12 KB), raised in Plan 2B, see below. `scripts/size.mjs` enforces the budgets.

### Motion tokens (starting values)

| Token | Value | Use |
|---|---|---|
| `enter` | 0.26 s, `cubic-bezier(.22,.61,.36,1)` | Fades and rises in |
| `move` | 0.32–0.36 s, `cubic-bezier(.4,0,.2,1)` | Outline glide, threads shifting, popover moves |
| `exit` | 0.20 s, `cubic-bezier(.4,0,1,1)` | Fades out |
| `roll` | 0.52 s | Count changes |
| `pulse` | 1.1–1.3 s, ease-in-out, single cycle | Content ↔ comment connection |
| cursor smoothing | τ = 0.12 s exponential | Remote cursors between updates |
| reduced motion | 0.16 s opacity cross-fade | Replaces all movement |

Positions that track scrolling content update every frame with no transition; transitions apply
only when the *target* changes. Direct drags have no transition.

### Thread anatomy

- At rest: comment text (14 px) + faint reply count. Nothing else.
- Hover: a footer with author · time followed directly by icon actions (thread: copy, resolve) eases open
  *beneath* the text (`height` 0 → 22 px) for the hovered comment only. At rest it has zero height —
  no reserved row — unless it carries a reply count. Replies have the same footer with no actions
  (the writer's own edit and delete aside).
- Open: `inset 2px 0 0` accent line on the left, no background; other threads at 45 % opacity;
  a persistent reply line (an underline only) at the end.
- Replies: all replies sit one level in (14 px indent) beneath the root comment, oldest first.
  There is no reply-to-a-reply action. The op format keeps its `parent` field, so older data with
  replies to replies still folds; the UI shows those replies in the same indented list by time.
- One reply line (an underline only, no icon or placeholder), always last, at the reply indent; its input
  starts at the replies' text edge. A press anywhere on the line (`.row`, `cursor:text`) focuses the input with
  the caret at the end; hover darkens its underline with the enter timing.
- Text comments have no bubble: hit-testing uses the highlight range's client rects.

### Copy for AI

There is no copy-format option. The menu has two rows: Copy all (`'ai'`, Markdown) and Copy all as text
(`'text'`); the core `copyAll`/`copyThread` keep their `CopyAs` parameter for tools. Copy on a thread always
copies the whole thread, as Markdown. Markdown output for one thread:

```markdown
## Thread 1 · open
- **Where:** Slide 3 "Revenue grew 42% year on year" › Q4 bar
- **Element:** `[data-pipeup-id="s3-q4"]` (Q4 bar)
- **Pin:** 50% across, 6% down the element
- **Started by:** Sam, 18m ago · 1 reply

**Sam** (18m ago): Make Q4 the only coloured bar so it reads at a glance.
- **Amy** (10m ago): Already is — maybe darken the label?
```

Copy all prefixes `# Review comments: <title>`, page URL, export time, open count (resolved
excluded) and a one-line instruction, then `## Thread N` blocks in page/slide order.

### Plan 2B (built)

- **Comment mode first.** Sites can only be commented on by selecting text until comment mode
  lands, so it leads Plan 2B: the control's Comment button and **⇧⌥C** (Shift+Alt+C) toggle it; hover glides an
  outline to the obvious block (§5 of the spec); click chooses it, opens the comment box on it
  and shows the naming bar with the expand icon (moves the box to the block around it); Option-click drops a pin; Esc leaves. The page's own handlers are
  suppressed in capture phase while it is on; `data-pipeup-ignore` areas keep working.
- **Hover previews wait.** The preview stays while the pointer is over the highlight/bubble *or*
  the preview, and hides 400 ms after it leaves both (cancelled on re-entry). The preview takes
  pointer events and opens its thread on click. Clicking a highlight, bubble or preview always
  opens (`ctx.open(id)`, never `active === id ? null : id`); Esc, a click on the page outside
  Pipeup, or opening another thread closes.
- **Reserved gutter (opt-in).** A page opts in with `<html data-pipeup-reserve>`.
  Pipeup then publishes the gutter width as a custom property from its document-adopted
  stylesheet — `:root{--pipeup-gutter:320px}` while the column shows, `0px` otherwise — and never
  touches the page's DOM or inline styles. The page's own CSS consumes it, e.g.
  `body{padding-right:var(--pipeup-gutter,0px);transition:padding-right .34s cubic-bezier(.4,0,.2,1)}`
  with the reading area `margin-inline:auto`. For reserving pages the column decision uses
  `viewport width ≥ content max width + gutter` (with 24 px hysteresis) rather than measured free
  space, so publishing the gutter can't flip the decision back. As built, the content width is the
  reading area's computed `max-width` when it is in px; when it is a percentage, the share of the window
  (so the hysteresis band scales by 1/(1-p)); otherwise the measured width alone. A fluid page with no
  limit therefore never gets a column. Pages without the attribute are unchanged: free-space
  measurement, no custom property.
- **Skills.** `pipeup-integrate` splits into *creating* a page for review (layout per page type,
  including the reserved gutter for documents) and *adding* Pipeup to an existing page (no layout
  changes, as before), plus a reference for every `mount()` option and markup attribute.
- **One file, not lazy loading.** Loading comment mode and the menu on first use was considered and
  rejected: a second file from `file://` needs its own request, and Chrome refuses every `integrity` check
  on `file://` (even with the right hash), so a split build would either lose integrity or break pages opened
  from disk. `file://` support wins. The classic and ESM bundles carry everything, with budgets of 26 KB
  gzip (core 12 KB), held by trimming: replies render one level, previews and popovers share one placement
  (`popoverAnchor` + `placePopover`), drafts share `draftBox`, overlays share `fit`.
  The build minifies the stylesheet (`STYLES`) with esbuild's CSS minifier, so its source keeps comments and
  line breaks. Measured after the Plan 2B review fixes: pipeup.min.js 25.0 KB, pipeup.esm.js 24.6 KB,
  pipeup.core.js 8.2 KB (gzip).
- **Replies fold one level.** `foldThreads` appends every reply to the comment's list in op order, whatever it
  answered; the `target` field is kept, so older data still folds.
- **Comment mode** (`src/ui/comment-mode.ts`) is a view the app creates when comment mode turns on. It listens
  on `window` in the capture phase: `click`, `dblclick`, `auxclick`, `submit` are prevented and stopped;
  pointer/mouse presses, releases, moves and over/out/enter/leave are stopped (presses on controls also
  prevented, so nothing focuses or opens); Enter or Space on a page control is prevented; `contextmenu` and
  `dragstart` are swallowed and touch is muted. Pipeup's own window listeners (selection, the menu) still
  run, whatever order they were added in, because `stopPropagation` never stops other listeners on the same
  node (`window`); only `stopImmediatePropagation` would. Presses are prevented only on real controls, not
  on text wrappers such as `tabindex="-1"`, `details` or `label`, so text stays selectable. Leaving comment
  mode removes the listeners at once and fades the outline and bar out before removing them.
  Block picking (`src/ui/pick.ts`) is pure and unit-tested with a fake layout. Esc goes through the app's
  `back()`: draft (which closes its chosen block with it), open thread, comment mode. A click on a block calls
  `commentOn`: it chooses the block and starts the draft (or `moveDraft`s an empty open one there). `moveDraft`
  mutates the open draft in place, so the box keeps its words and focus; the popover then glides (opacity
  only under reduced motion). The chosen block's outline stands in for the popover's `.mark` while comment
  mode is on.
  Known limits, by nature of a library: CSS `:hover` still applies; a page's own window-capture listeners
  registered before Pipeup still hear events; Esc reaches the page's key handlers; the browser's own
  right-click menu is suppressed in comment mode (it could be left alone with a stop-only handler).
- **Details that matter.** A draft takes focus when it attaches (no timers: a late timer stole typing and
  collapsed new selections). Hidden bars (the naming bar, the selection icon) are inert, so they take no
  focus. Bubbles scale from their tip, so a hovered, open or pinned bubble keeps pointing at the same spot;
  bubbles and the pending pin fade in with the enter timing and out with the exit timing (`.bub:not(.in)`).
- **Reserved gutter** is published by `installPageSheet` (the same adopted sheet as the highlights); the
  column sits 24 px inside the gutter, 272 wide.
- **Tests.** Browser tests are type-checked with the rest (`tsconfig.e2e.json`, part of `npm run check`).
- **Names and animals.** A name is optional. Ops may carry `name: ""`; `foldThreads` shows such a comment
  with the writer's latest name in the document (any op of theirs that carries one), and
  `PipeupDocument` with the reader's own current name for their comments, so adding a name relabels the
  writer's earlier comments too. Anyone still without a name is shown as an animal in a colour ("Red Fox"):
  `src/model/animals.ts` (core) holds the 5 animals (Otter, Fox, Owl, Bear, Rabbit) and 10 colours (Red …
  Grey) and picks both from one hash of the author's public key (FNV-1a, mixed): animal `h % 5`, colour
  `floor(h / 5) % 10`, so the two are independent and all 50 come up evenly. One identity is the same
  animal in the same colour everywhere; `animalName` gives "<Colour> <Animal>" and `nameOf` is what hover
  details, the draft's "You're …" line and copy for AI print. The animal pick kept its old hash, so the
  cut from 25 animals to 5 (2026-10-06, to save about 1.8 KB gzip) only remapped by the new modulus.
  `src/ui/animals.ts` holds the drawings (one 24×24 stroked path each, drawn for Pipeup, keyed by animal) and
  the squircle `avatar` (`data-animal` is the full "Red Fox"): the animal drawn in its colour's dark stroke
  on a tint of it, or the writer's initial in the same pair. The ten pairs are `.c0`–`.c9` in COLOURS order,
  each just a hue (`--h`) and, for Brown and Grey, a saturation (`--s`, default 60%), with two lightness
  variables on `.av` (tint 92% / stroke 30%; on dark pages 20% / 78%). A unit test reads those values from
  the stylesheet and checks every pair, light and dark, for at least 3:1 contrast. Profiles created before
  this kept the name "Reviewer", which now reads as no name.
- **Avatar placement.** `.root` and every reply `.it` keep 30 px of padding on the right whether or not an
  avatar is there; the avatar is positioned absolutely in it at the top right, so the words' width never
  depends on it. Thread views keep each avatar element across updates (keyed by comment and face) and only
  ease in new ones, so re-renders never replay the motion.
- **Naming in the draft.** The draft shows the writer's avatar beside the comment line and a quiet line
  ("You're Red Fox · add your name"); its name field shares a grid cell with that line and cross-fades in,
  inert while hidden. Saving goes through the menu's `rename` path. The budgets went from 26 to 30 KB
  gzip for this: the drawings and the new styles cost about 3 KB (pipeup.min.js 29.3 KB, pipeup.esm.js
  28.9 KB, pipeup.core.js 8.6 KB).
- **The comment control and All comments.** The control is `[number][more][comment icon]`, right-aligned,
  so the icon never moves. The number (`.count`) shows only while there are open threads: it eases open to
  the left (its grid column, padding and opacity) and closes the same way, keeping its last value while it
  fades; at zero it is inert. Choosing the number opens **All comments** (`.menu.all`, same panel, keyboard
  and inert handling as the menu); the menu moved to a "more" button (`.opts`) that eases open beside the
  number on hover or focus, so at rest the control is still only the icon. The list comes from
  `MenuActions.all()` (the same page-ordered `ExportItem`s Copy all uses, so each row's place is `locate()`'s
  label), puts threads whose content is gone under "No longer on the page" with their snapshot, and follows
  Show resolved. Choosing a row scrolls its content into view (`scrollIntoView`, which also scrolls
  `overflow:hidden` carousels; smooth unless reduced motion) and opens the thread where it is (column or
  popover). A thread with nowhere to show (orphaned, `display:none`, `visibility:hidden`) opens in a
  popover beside the control (`.pop.side`, placed by `placePopover`, built with `threadView`), which closes
  on Esc, a click elsewhere, or another thread opening. This fixes a count that could not be reached in
  bubbles mode, where orphaned threads had no bubble and no list. There is no reveal API for hidden views
  yet (§8 "reopens that view when the page tells Pipeup how"); when one exists, `choose()` in
  `launcher.ts` is where it goes. The budgets went from 30 to 32 KB gzip for this (pipeup.min.js 29.9 →
  31.1 KB, pipeup.esm.js 29.6 → 30.8 KB, core unchanged at 8.6 KB).
- **One button, and All comments as a panel (2026-10-06).** The control above became one 46 px round
  button (`.launch .mode`): the comment-plus icon (`.plus`) and, while threads are open, a larger comment
  bubble (`.cnt`, the `bubble` icon) with the count inside, cross-fading between the two. The count is two
  stacked spans (`.n`); a change writes the hidden one and swaps `.on`, so the old number fades out as the new
  one fades in; above 99 it reads "99+". Nothing about the button changes size. A CSS tooltip (`.ttip`,
  "Comment" and `SHORTCUT_LABEL`) eases in after 0.5 s on hover or keyboard focus, hidden while the menu is
  open and on `hover:none` screens. The slide-out words and the "more" button are gone. A click opens the menu
  (`aria-haspopup="menu"`), which rises above the button and is built top down so **Comment** (or Stop
  commenting) is last, nearest the button, with its shortcut (`aria-keyshortcuts`); opened from the keyboard,
  focus starts there. Comment mode shows as the accent fill (`.mode.on`); while comments are hidden the button
  still opens the menu and the Comment item is `aria-disabled`. **All comments** is a dialog (`.all`): fixed
  full height on the right, 320 px (the whole width at 480 px or less), sliding in with the move token and out
  with the exit token (opacity only under reduced motion), inert when closed, focus in on open and back to the
  button on Esc or its close button. It sits above the button in the layer. `UiState.listing` says it is
  open, so other views can make room: `room(listing)` in `layout.ts` is the viewport less the panel, and every
  popover, preview and the side popover is placed within it, so the panel never covers the thread it opens.
  **Column vs panel:** the column sits where the panel goes, so while the panel is open the column fades and
  goes inert (`.layer.listing .col`) and the bubbles view, normally without popovers in the column layout,
  opens the chosen thread as a popover beside its content (`pops()` in `bubbles.ts`); drafts still go to the
  column, and starting one or entering comment mode closes the panel. Closing the panel gives the column back
  with the thread open there. This was simpler than shifting the column (which would land on the content) and
  reuses the popover path bubbles already have. On a narrow screen the full-width panel closes when a thread
  is chosen. The panel's avatars stretched to the row's width (the row's `span{flex:1}` caught the avatar
  span); the text span is now the flexible one and the avatar is `flex:none`.
  Polish: `PANEL`, `POPOVER` and `NARROW` live only in `layout.ts`; the host writes the first two onto the
  layer as `--pu-panel` / `--pu-pop` (the stylesheet must stay one plain template literal for the build's CSS
  minifier, so nothing is interpolated into it), and narrowness is decided in code, which gives the panel
  `.full`. The column fades out under the panel with the exit timing. Focus that was in the panel when a page
  click closes it, and that the click left on nothing (`body`), returns to the button; a click into a page
  field keeps its focus. All comments has its own `list` icon.
- **A simpler menu; comments follow comment mode; the panel makes room (2026-10-06).** This supersedes the
  menu details above (Comment / Stop commenting, Copy as, Show resolved and Hide comments rows).
  - *Menu.* `launcher.ts` builds the rows once and `sync()` updates them in place (labels, `aria-checked`,
    counts), so switches ease instead of being rebuilt on every render; name editing swaps the rows for the
    field and back. Each row is one line (`.lb`, ellipsis) with its explanation in an `aria-hidden` tooltip
    (`.tt`, beside the menu, 0.5 s delay, enter/exit tokens, hidden on `hover:none`) mirrored to
    `aria-description`. Order: identity row (`[data-item=name]`, avatar `.ma`, "Add name" or the `edit`
    pencil, `aria-label` "<name>, add/edit your name"), separator, Copy all, Copy all as text (two plain rows), All
    comments, separator, Start commenting (`menuitemcheckbox` drawn as a switch, `aria-keyshortcuts`).
    The UI has no feedback-file controls or drop handling; the sealed file format stays in the core.
    Switches (`.sw`) slide their knob with the move token; reduced motion cross-fades two
    knobs (`::after` off, `::before` on). Switch rows in the menu are `menuitemcheckbox` (valid inside
    `role="menu"`); the panel header's Show resolved, outside any menu, is `role="switch"`.
  - *Visibility.* `UiState.hidden` is derived in `render()`: hidden unless comment mode is on, All comments
    is open, a draft is open (its words are never lost), or `reading` is set (a thread chosen on a narrow
    screen, where the panel closes on choose; cleared when that thread closes). Hidden closes the open
    thread. Views already drop hidden threads with their exit fades; highlights cannot transition, so
    `paint()` keeps painting ranges and `fadeHighlights()` tweens the page sheet's highlight alpha
    (`sheet.fade(k)`, 0.26 s ease-out in, 0.2 s ease-in out, opacity-only by nature, so the same under
    reduced motion). `toggleHidden` is gone; `setCommenting(true)` is never refused. Selection offers its
    icon only in comment mode. Because comments are only seen in comment mode, a highlight there previews on
    hover and opens on click, except while a draft with words is open (`ctx.readsAt`, one rule for hover,
    click and comment mode) or with Option held. Comment mode's `onPick` returns early when `readsAt` hits,
    so a click never also picks the block whatever order the capture listeners were added in (views are
    rebuilt when a resize crosses the column/bubbles breakpoint). Choosing from All comments no longer
    leaves comment mode.
  - *Panel room.* `sheet.room(px, still)` adds `html{margin-right:320px!important;transition:margin-right
    .34s …!important}` to the document-adopted sheet while the panel is open on a wide screen; on close the margin goes
    and the transition stays 0.4 s so the page eases back, then the rule is removed. No DOM or inline-style
    writes. Reduced motion: no transition. After the reflow the app re-resolves and re-renders (the root's
    ResizeObserver also fires during it). On reserve pages the gutter closes while the panel makes its room.
    The column still fades and goes inert under the panel: the page has room now, but the column is laid out
    beside content that has just moved and would sit where the panel is, and popovers beside the content
    already show the chosen thread, so keeping that path was simpler and safer. **Known limit:** elements the
    page positions `fixed` (or `sticky` against the window) don't move with the margin and can sit under the
    panel.
  - Sizes after this change: `pipeup.min.js` 31.6 KB, `pipeup.esm.js` 31.3 KB, core 8.6 KB gzip (budgets 32 /
    32 / 12).
- **Open question:** when comments are hidden, the comment control still sits over the page's bottom-right
  corner. Not decided in 2B.

---

## Change log

- 2026-10-05 — First draft from the brainstorm; `file://` spike results recorded.
- 2026-10-05 — §4: content-addressed op ids, bounded clock and tie order, validation limits (from the Phase 1 core review).
- 2026-10-05 — Added §11 interaction design: mock-up index, motion tokens, thread anatomy, copy-for-AI format and `copyAs` option.
- 2026-10-06 — §11: replies one level under the comment with no reply-to-a-reply; Plan 2B design for comment mode first, hover previews that wait, the opt-in reserved gutter (`data-pipeup-reserve`, `--pipeup-gutter`), and the skill split.
- 2026-10-06 — §11: Plan 2B built — one file kept over lazy loading (file:// and integrity), 26 KB budgets, one-level reply folding, comment mode capture rules and known limits, reserved gutter; open question on the control's corner.
- 2026-10-06 — §11: optional names — 25 animals picked from the public key, squircle avatars in a reserved top-right area of each comment, naming in place from the draft, empty names allowed in ops; budgets 30 KB.
- 2026-10-06 — §11: comment mode opens the comment box on the first click; the naming bar loses its comment icon and keeps the expand icon, which moves the open draft (words and caret kept); Esc closes box and block together.
- 2026-10-06 — §11: the control's number is hidden at zero and opens All comments (page order, orphaned threads under "No longer on the page", scroll-and-open, side popover for threads with nowhere to show); the menu moves to a "more" button shown on hover or focus; budgets 32 KB.
- 2026-10-06 — §11: the reply line loses its reply icon (the line is the target; caret to the end); the control's comment and bubble icons draw at stroke 1.4 (the plus at 1.6), the count at weight 500.
- 2026-10-06 — §11: simpler menu (one-line rows with tooltips, identity row, copy-format button, Start commenting switch); comments shown only in comment mode, All comments, a draft, or a narrow-screen chosen thread (highlight fade via the page sheet); Show resolved in the panel header; the open panel makes room with an adopted-sheet margin on `html`.
