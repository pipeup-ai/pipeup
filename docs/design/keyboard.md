# Keyboard and screen-reader cursor (0.4, part 2, step 1)

Status: **approved** (2026-10-07). Functional requirements: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md)
§5, §6, §7 and §9. Touch and the narrow-page drawer are step 2 and have their own design.

Code references are to 0.4.0-beta.2 (`libs/ts/pipeup/src/ui/`); line numbers will drift, function names
won't.

## Goal

Everything a mouse can do in comment mode can be done from the keyboard and with a screen reader: choose a
block, step to the block around it or inside it, comment, drop a pin, comment on words, and reach the
comments already there. The page stays the author's: Pipeup never adds `tabindex`, ids or ARIA to it, and
never changes its DOM. Mouse users see no difference.

Today a keyboard user can turn comment mode on, use the menu, All comments and bubbles, but can't choose a
block, step to a child, drop a pin, open a closed column thread, or keep focus after sending a comment
(focus falls to `body`). Screen readers are never told which block is chosen, and the comment-mode hint
talks only about clicking.

## The cursor

The **block cursor** is the comment-mode outline (`.pick`, `comment-mode.ts` `show`/`moveTo`) plus a
**focus marker**: Pipeup's own element, in its shadow-root layer, laid exactly over the block the outline
is on, that takes real focus.

- **Two markers that take turns.** Moving focus to the element that already has it is silent, so there
  are two markers (`.km`, `div`s with `tabindex="-1"` and `role="button"`). A move labels and places the
  idle one, focuses it, then makes the other `inert`. Every move is a real focus change, which every
  screen reader announces and every magnifier follows. They are never in the sequential Tab order.
- **Placed by `fit`.** Each frame (`frame()` → `place()`), the current marker gets the block's
  `getBoundingClientRect()` with the outline's 4 px padding, so a magnifier's focus rectangle is the
  block. Markers are transparent with `pointer-events:none`; the outline draws the cursor.
- **Focus is drawn on the outline.** While a marker has focus the outline gets `.kf`: a 3 px accent
  border with a 2 px `--su` halo outside it, so it holds 3:1 against light and dark pages whatever the
  accent. Under `forced-colors: active` the outline is `3px solid Highlight` (borders are forced and
  shadows dropped, so the halo can't be relied on).
- **What it says.** The marker's name is a short label in Pipeup's words, then the block's own words:
  - `"<kind>, <n> of <m>"`, where kind is `labelOf`'s kind (`KIND` in `anchor/locate.ts`: Paragraph,
    Heading, Image, Section, …, "Block" otherwise) or the author's `data-pipeup-label` in its place;
  - then `", has <c> comment(s)"` when open threads here are on the block or inside it (element, pin and
    text threads whose `resolved.element`, or whose range, the block contains);
  - **short blocks** (at most 150 characters of `innerText`): the name is
    `ariaLabelledByElements = [label span, block]`, so the block's own words (or an image's `alt`) are
    read whole as part of the name;
  - **long blocks** (sections, cards, long paragraphs): the name is the label span plus a second span
    with `labelOf`'s first 40 characters, and the whole block is the description
    (`ariaDescribedByElements = [block]`), read after the name where the screen reader reads
    descriptions. A block is never read twice.
  - The label spans live in the shadow root with the `hidden` attribute: text an element references
    counts in its name even when hidden, and browse mode never reads the spans on their own. Element
    references from the shadow root out to the page are supported in Chrome 135, Firefox 136 and Safari 16.4; where the property is
    missing, the name falls back to the label plus `labelOf`'s words as a string. `aria-activedescendant`
    and `aria-owns` are not used: the first can't point out of the shadow root, the second would move the
    page's own content in the accessibility tree for everyone.
- **Role.** `role="button"`: Enter, Space and a screen reader's activate (a `click` with `detail === 0`)
  all comment on the block, and a button keeps NVDA and JAWS in browse mode, so their reading keys still
  work. Not `role="tree"`: its keys are ←/→ for levels, which would mislead.

## Starting and leaving

**Starting.** The cursor starts when comment mode is turned on **from the keyboard**:

- the shortcut (`app.ts` `onKey` → `setCommenting(true, true)`), or
- Start commenting chosen with Enter or Space (`launcher.ts` `row` click with `e.detail === 0`, the test
  the control already uses to focus Start commenting when opened from the keyboard).

`setCommenting(on, keys = false)` passes `keys` to `createCommentMode(ctx, look, keys)`. Turned on with the
mouse, nothing changes: no marker, no cursor, today's hint. Chosen from the keyboard, Start commenting
**closes the menu** (it stays open for the mouse, so the switch is seen to move); the menu's exit fade and
the switch's slide play together, and focus goes straight to the cursor, with no timer. Order matters: the
row calls `setMenu(false)` (not `closeToControl`, which would focus the control) and only then
`ctx.setCommenting(true, true)`, so nothing takes focus back from the marker.

**Where it lands.** Remembered first: `before`, the element that had focus (the page's
`document.activeElement`, or the menu row, which is Pipeup's).

1. If a page element in `ctx.root` has focus (outside `[data-pipeup-ignore]`), the cursor lands on
   `pickBlock(active)`, at that block's level. Screen readers that move focus along with their reading
   cursor over links and controls (JAWS by default, NVDA when set to) put this near where the reader is.
2. Otherwise, the first block of the leaf level whose box is in the window (top edge at or below 0,
   else the one covering the top).
3. A page with no blocks gets no cursor; the keyboard hint is replaced by "Nothing here to comment on".

The hint (below) says how to move and how to leave, which is what WCAG 2.1.2 asks of a Tab that is
taken over. A status message sent at the same moment as a focus change is often cut off, so the screen
reader gets the hint as part of the **first landing's description** (a hidden span put before the block in
`ariaDescribedByElements`, dropped on the next move), and the toast showing it is `aria-hidden` so it isn't
read twice.

**Leaving.** Esc is one step at a time, as today (`app.ts` `onKey`: draft, open thread, chosen block,
comment mode), with the cursor as the chosen-block step:

| Focus is on | Esc does |
|---|---|
| The draft (composer) | Clears and cancels it (`composer.ts`); focus returns to the marker, same block |
| A reply line | Closes the thread; focus returns to what opened it (below) |
| The marker, a draft or thread open | Cancels the draft (an empty one, or one whose view is here) or closes the thread; focus stays on the marker |
| The marker, nothing open | **Puts the cursor away**: outline and bar fade out, focus returns to `before` |
| Anywhere else, cursor away | The steps as today, ending by leaving comment mode |

Esc on the marker is handled on the marker and stopped there (reveal.js's Esc opens its overview), so it
calls the app's own step directly: `ctx.back()`, the function `onKey` already runs, exposed on `Ctx`.
`CommentMode.back()` becomes: clear the chosen block, else put the cursor away, else false.

**Where focus goes when the cursor is put away.** Back to `before` if it is a page element still in the
page and focusable; to `body` (by blurring the marker) if that is where it was, so the next Tab starts at
the top of the page's own order; and to the corner control if it came from the menu, which is gone. Tab
then belongs to the page again: its links, the deck's ignored buttons, then Pipeup's bubbles and control,
which come last (`host.ts` appends `<pipeup-root>` after `<body>`).

**Bringing it back.** While comment mode is on and the cursor has been put away, the shortcut brings the
cursor back instead of leaving comment mode: it lands on the block it was on if that is still here, else by
the landing rules above, and `before` is remembered afresh. Pressing the shortcut with the cursor in use
leaves comment mode. So the shortcut is: off → on (with the cursor, from the keyboard); cursor away →
cursor back; cursor in use → off. A comment mode turned on with the mouse never had a cursor, and the
shortcut turns it off as today. `app.ts` `onKey` asks `modeView.away()` (the cursor was put away) before
toggling: `away()` true → `modeView.resume()`, else `setCommenting(!state.commenting, true)`. Esc stays
the announced way out (and the hint still says "Esc to finish"); "Cursor put away" becomes "Cursor put
away · ⇧⌥C brings it back" (with the shortcut's label for the platform).

**Comment mode ending while the marker has focus** (the shortcut, or the menu) does the same before
`destroy()` removes the markers, so focus never falls to `body` unannounced. Leaving comment mode is
announced ("Comment mode off", below).

**The page's controls from the keyboard while the cursor is not in use.** With the cursor put away (or
never started, because comment mode was turned on with the mouse), Enter and Space on a focused page
control do what the page expects: a link opens, a button presses, a checkbox toggles. Pipeup does nothing
with them; the keyboard has been given the page back. Today comment mode's capture-phase `onKey` prevents
Enter and Space on page controls (`ACTIVATES`), and the click a browser makes from that key would reach
`swallow` and pick a block. Instead:

- `onKey` lets Enter and Space on a page control through whenever the cursor is not in use, and remembers
  the control (`passed = e.target`);
- `swallow` lets one `click` through untouched when it arrives on `passed` with `detail === 0` (the
  click the browser makes from that key), then forgets it; `submit` from that key passes the same way;
- mouse clicks, Alt-clicks and every other pointer event are swallowed exactly as today, and Enter on
  the marker or on Pipeup's own UI is unchanged.

A screen reader's activate in browse mode (NVDA, JAWS) sends a click with no key reaching the page, so it
is never `passed` and still chooses the block (below).

**Mouse while the cursor is on.** Hover doesn't move the outline (as while a block is chosen:
`onMove` returns early). A click on the page with a pointer (`detail > 0`) chooses as today and puts the
cursor away. A click with `detail === 0` (a screen reader's activate on page content: NVDA and JAWS send
a click when Enter is pressed in browse mode) chooses that block **and moves the cursor there**, so the
loop below still works for screen reader users who arrow through the page. Whether every screen reader's
click arrives with `detail === 0` is checked by hand (Testing); where it doesn't, it counts as a pointer
click, which still comments and only loses the return to the cursor.

## Tab order and levels

Blocks are what a click would choose. `pick.ts` gains:

- `isBlock(el, root, look)`: the test inside `pickBlock`'s loop (size, the 60 % cap, `OBVIOUS`, `drawn`,
  `grouped` outside controls, `data-pipeup-id`), pulled out so both use one rule;
- `blockTree(root, look, keep)`: one `TreeWalker` pass over `root` in page order, skipping
  `[data-pipeup-ignore]` subtrees, zero-size boxes and what `keep` rejects, that returns each block with
  its parent (as `parentBlock` finds it, so same-box wrappers fold into the innermost, and a marked
  `data-pipeup-id` element wins as in `pickBlock`) and its **level**: 0 for a block with no block
  inside it, else one more than the highest level inside it;
- `row(tree, k)`: the blocks at level `k` or below whose parent block is above level `k` (or which have
  none), in page order.

`keep` is comment mode's filter: `checkVisibility({ opacityProperty: true, visibilityProperty: true })`,
and on slide pages `ctx.here.holds(ctx.here.view(el))`, so a deck's other slides (and a scroll deck's
off-screen slides) are never visited. Blocks off screen on the current view are visited.

**The rule.** A row covers the whole page (or slide) with no block inside another, so nothing is skipped.

- The cursor starts on row 0: the smallest blocks a click would choose (paragraphs, headings, tiles,
  images, single controls).
- **Tab / Shift+Tab** go to the next / previous block in the current row, wrapping at the ends ("1 of 12"
  says so).
- After **↑** to a parent at level `k`, Tab moves through row `k`: blocks at that level (sections,
  cards), plus any smaller block that stands outside every block of that level (a heading directly in a
  bigger section), so a part of the page is never unreachable from a row. After **↓**, the row is the
  child's level.
- The tree is built when the cursor starts and marked stale on comment mode's `render()` (which the app
  runs after DOM mutations, resizes and here changes); a stale tree is rebuilt on the next key. A full
  pass costs one `getBoundingClientRect` and one `getComputedStyle` per element; on very large pages a
  rebuild can take about 15–25 ms (to be improved).
- If the cursor's block leaves (removed, hidden, or on a slide that is no longer here), the cursor lands
  again by rule 2 above, on the next marker, so the move is announced.

A moved cursor scrolls its block into view: `scrollIntoView({ block: "nearest", inline: "nearest",
behavior })`, smooth unless reduced motion (the pattern in `launcher.ts` `choose`). It moves the window
or a scroll container, never the page's DOM.

## Parent and child

- **↑** chooses the parent (`parentBlock`, as the expand button does). **↓** chooses a child: the block
  the cursor last came up from if it is inside, else the first child in the window, else the first child.
  `pick.ts` gets `childBlocks(tree, el)` for this.
- Arrows are taken **only while a marker has focus**. In a draft or reply line they move the caret; on the
  page, with the cursor away, they reach the page as today. **← and → are never taken**, so horizontal
  slides always move.
- NVDA and JAWS in browse mode keep ↑/↓ for reading, so the **naming bar** offers the same moves as
  buttons. It is placed right after the markers in the layer, so in browse mode ↓ from the marker reads
  the bar next.

**The naming bar** (`comment-mode.ts` `bar`, `reveal`) shows while the cursor is on a block (it moves
with it) as well as on a chosen block. Its buttons, icons only, with names and tooltips:

| Button | Name | Tooltip | Does |
|---|---|---|---|
| expand (today's) | Around it | Select the block around it | The block around it |
| new `shrink` icon | Inside it | Select a block inside it | A block inside it (as ↓) |
| new `pin` icon | Pin | Pin its centre | A pin at the block's centre (below) |

- With a draft open, Around it and Inside it move the draft (`moveDraftTo`, keeping words and caret, as
  today). With no draft, they move the cursor and focus the marker, so the new block is announced.
- Around it is hidden at the top (as today); Inside it is hidden at a block with no block inside.
- The bar becomes `role="group"` ("Chosen block"): `toolbar` promises arrow keys it doesn't have.
- **Tab order.** Comment mode inserts the outline, markers and bar **before the launcher's `.launch`**
  instead of appending them, so Tab from a draft reaches the bar before the corner control (today it is
  Send → name → control → expand). If the views are rebuilt (a resize across the column/bubbles switch),
  it moves them before the new `.launch`, unless one of them has focus.
- **No key reaches a slide's ↑/↓ while a marker has focus**, so reveal.js vertical slides pause while the
  cursor is in use (spec §6). Esc gives them back.

## After commenting, and the comments already there

**The loop.** Enter (or Space, or activate) on the marker calls `commentOn(block)`: the block is chosen,
the draft opens and takes focus, as a click does. After the draft closes, focus comes back to the marker
on the same block, which now reads "…, has 1 comment". Reviewers comment on block after block without losing
their place.

- `CommentMode` gets `cursor(): boolean` (the cursor is in use) and `refocus()` (focus the marker on its
  block, as a move).
- **Sent.** `postDraft` → `open(id)`: the new thread opens as today, but when `modeView?.cursor()` the app
  calls `modeView.refocus()` instead of `focusReply`. Without the cursor, `focusReply` runs with `busy`
  worked out **without the draft's own textarea** (today `writing()` at `app.ts:453` sees the draft's words,
  skips focusing, and focus falls to `body`). Both fix the lost focus after sending.
- **Cancelled, or closed some other way** (Esc in the draft or on a bar button, a bar button going inert):
  comment mode's `render()` already notices the draft closing (`drafted && d !== drafted`). With the
  cursor in use, it refocuses the marker if focus is nowhere (on `body`, or on a Pipeup element that is
  now gone or inert). It never takes focus from somewhere the reviewer chose.
- **A pin** from the cursor keeps the cursor's block: `drafted` is set for pins too, the outline returns to
  the block when the pin's draft closes, and focus to the marker.
- **Moving on closes.** With a thread open, Tab, Shift+Tab, ↑ and ↓ close it before moving, as a click
  elsewhere does.
- **A draft with words** holds the reviewer, as with the mouse (`onPick`): Enter on any block goes back
  to it. When its slide or view stepped aside (2C-1), `ctx.backToDraft()` waits for `here.navigate` and
  then focuses the draft, keeping its caret (`keepCaret`'s restore), since the box is inert while away.
  Replies left unsent in threads that went elsewhere (`unsent`) are untouched.

**The draft says what it's on.** In comment mode the draft hides its "what it's on" line because the bar
names the block (`draft-view.ts` `hideLabel`). The textarea is still just "Comment", so the chosen block is
announced (below) when the draft opens and whenever Around it, Inside it or Pin moves it. Those moves keep
focus in the textarea, so the announcement is the only way a screen reader hears that anything changed.

**Existing comments.** Enter on the marker always starts a new comment; the count in its name says there
are comments. **Shift+Enter on the marker opens them**:

- The block's threads are the ones its count counts: open threads here on the block or inside it (element,
  pin and text threads; resolved ones too while Show resolved is on), in page order (`compareDocumentPosition`
  of their element or range start, then pin position, then creation).
- Shift+Enter opens the first with `ctx.open(id)`: it opens where it lives (column, popover, or below its
  words for text), the reply line takes focus as for any opened thread, and Esc in it returns focus to the
  marker (the opener is the cursor).
- **Several threads:** the announcer says "Comment 1 of 3 on this block". Shift+Enter on the marker again
  opens the next one after the last opened on this block (the cursor remembers it until it moves), wrapping
  after the last ("Comment 2 of 3 …"). One thread says nothing extra: the thread's own focus says it.
- **None:** nothing opens and the announcer says "No comments on this block".
- A draft with words holds the reviewer, as for Enter: Shift+Enter goes back to it.

Without the cursor, Tab reaches Pipeup's comment UI after the page's controls:

- **Bubbles in page order.** `bubbles.ts` inserts bubbles in creation order (`bubbleFor`,
  `insertBefore(b, mark)`). On render, when the order of live bubbles changes, they are re-inserted in page
  order, still before `mark` (by `compareDocumentPosition` of their element, then pin position), restoring
  focus if a bubble had it. Their name gains the block and is refreshed when the comment changes:
  `"Comment on <labelOf>: <first 60 characters>"` (today it is set once and goes stale).
- **Column threads as buttons.** A closed column thread is a `.th` div that opens on click
  (`column.ts` `create`). Each gets a real button first inside it (`.opn`, "Open thread: <first 60
  characters>, <n> replies", `aria-expanded`), inert while the thread is open. It has no box of its own:
  focus shows as the thread's hot line plus a focus ring on the `.th` (`.th:has(.opn:focus-visible)`).
  Column items are kept in page order, as bubbles are.
- **Text threads** stay reached through All comments (highlights are CSS Custom Highlights, outside the
  accessibility tree).
- **Esc goes back where it came from.** Today `focusReply` remembers only All comments rows (`back` from a
  `data-thread` attribute, `app.ts:437`), so Esc in a thread opened from a bubble drops focus to `body`.
  Bubbles and `.opn` buttons carry `data-thread` too, and `actions.close` looks the opener up by id and
  kind (row, bubble or column button; rows by id because the panel rebuilds them), else the marker when
  the cursor is in use.

## Text comments

There is no Pipeup text cursor. Words are selected with the browser's caret browsing (F7 in Chrome, Edge
and Firefox; Safari has none), a screen reader's own selection, or the mouse, which all make a normal page
selection.

- **Shown when the selection settles.** `select.ts` checks only on `mouseup` and `keyup` today
  (`onUp`). It also checks on `selectionchange` once the selection has not changed for 250 ms (one timer,
  reset on each change; `selectionchange` keeps firing while a selection grows). `mouseup` still shows
  it at once. This is the change touch's long-press needs in step 2.
- **Enter comments on it.** While the comment icon shows and focus is on the page (not in a field or in
  Pipeup), Enter on the page runs the icon's own click. Comment mode already prevents Enter on the page's
  controls, so nothing on the page loses an action. The listener is a window capture `keydown` in
  `select.ts`: comment mode's `onKey` stops propagation on `window` too, which never stops other listeners
  on the same node, so both run in either order. (The icon is also reachable by Tab, last, as today.)
- **Said once.** When the icon appears for a selection that wasn't made with the mouse, the announcer says
  "Enter comments on the selected words" once per selection, not on every extension.
- The keyboard hint mentions F7. The block cursor and caret browsing don't mix: with the cursor on, focus
  is on the marker; Esc puts it away and the caret is the page's again.

## Pins

- Pins go through `commentOn(el, point)` (the design's `pinAt` was folded into it): Option-click passes the
  block under the pointer and the click's point within it (unchanged); the bar's **Pin** passes the chosen
  or cursor block and `{ x: 0.5, y: 0.5 }`.
- With no draft, Pin starts a pin draft ("Pin on paragraph · …") that takes focus; the ghost pin shows at
  the centre (`bubbles.ts` `frame`). With an open block draft, Pin turns it into a pin draft on the same
  block, keeping its words and caret (`moveDraft` with the pin anchor, inside `keepCaret`).
- Pin is on the bar for every input. In this step it always pins the centre; in step 2, on touch, it waits
  for the next tap and pins there. Two-finger tap is gone from the spec (it opens links in a new tab on
  iPhone and iPad, right-clicks on trackpads, and pauses VoiceOver and TalkBack).

## Hints and announcements

- **The hint follows the input used.** `setCommenting(true, keys)` picks the toast:
  - mouse (today's): "Click anything to comment · Option-click (Alt-click) to pin · ⇧⌥C or Esc to finish";
  - keyboard: "Tab moves between blocks · ↑ ↓ change level · Enter comments · Esc to finish · F7 selects
    text". It stays until the cursor first moves, a draft opens, or 10 s pass, whichever is first (not the
    mouse hint's 4 s: it is read, then used). `toast` decides "is this the hint" by `ms === HINT_MS` today;
    it takes an explicit flag instead, so the longer keyboard hint is still hidden by `hideHint`.
- **The corner control says comment mode is on.** Its name (`launcher.ts` `render`, `aria`) gains it:
  "Comment, comment mode on, 3 open" (or "…, comment mode on, 2 here · 5 on other slides").
- **The announcer.** A visually hidden polite live region (`.sr`, `aria-live="polite"`), separate from the
  toast, created empty with the layer and never inert. `ctx.say(text)` empties it and writes the text on
  the next frame, so the same words can be said twice and land after any focus announcement. It says:
  - "Commenting on <label>" when a draft opens on a chosen block, and when Around it, Inside it or Pin
    moves it ("Pin on <label>");
  - "Nothing around it" / "Nothing inside it" when ↑ or ↓ has nowhere to go;
  - "Comment 1 of 3 on this block" / "No comments on this block" for Shift+Enter (above);
  - "Comment mode off" when comment mode ends, and "Cursor put away · ⇧⌥C brings it back" when Esc puts
    it away (focus going back to `body` is otherwise silent);
  - the selection line above.
- **Not said**: cursor moves (the focus change says them), hovering, or anything a mouse-only session
  does besides the above. One message per action, no repeats.
- `ariaNotify` is not used: it isn't in every browser Pipeup supports, and two paths could say a message
  twice. The live region stays in the layer, never inside an inert or modal surface.

## Keys Pipeup takes, and when

The marker's own `keydown` handles the keys below and stops them (`preventDefault` and
`stopPropagation`; `keyup` for the same keys is stopped too), so the page's `document` and `window`
listeners in the bubble phase never see them: reveal.js listens on `document` and ignores only fields. Page
listeners in the capture phase still hear them, as for every comment-mode event (known limit).

| Key | While | Does | Reaches the page |
|---|---|---|---|
| Tab / Shift+Tab | marker has focus | Next / previous block in the row | No |
| ↑ / ↓ | marker has focus | Parent / child | No |
| Enter, Space | marker has focus | Comment on the block | No |
| Shift+Enter | marker has focus | Open the block's next thread (or say there are none) | No |
| Enter, Space | a page control, cursor not in use | What the page does (Pipeup nothing) | Yes |
| Esc | marker has focus | The app's step (a draft, an open thread), else put the cursor away | No |
| ← / →, Page Up/Down, Home/End, letters | marker has focus | Nothing (Pipeup) | Yes |
| Shift+Alt+C | anywhere but a field | Off → on with the cursor; cursor away → back; else off | As today |
| Enter | page, a selection's icon showing | Comment on the selection | No |
| everything | a draft, reply line or Pipeup button | As today | As today |

No single-letter keys are taken (WCAG 2.1.4). Shift+Enter is the only modifier with Tab, Enter, Space or
Esc, and only while the marker (Pipeup's own element) has focus, so it never shadows a page or browser key. Comment
mode's capture-phase `onKey` (Enter/Space on page controls) and the launcher's capture-phase Esc are
unchanged. The panel is closed whenever comment mode starts. The menu can still be open behind the marker
when the shortcut turned comment mode on with it open (the shortcut leaves the menu open, §7): the first
Esc closes the menu and puts focus on the comment control, as it does for the side thread; the next Esc puts
the cursor away.

## Motion

- The cursor **is** the outline, so it glides between blocks with the existing `.pick.show.glide`
  (`--mv`, `--eio`) and, with reduced motion, cross-fades (`show()`'s `afterFade` path). The focus style
  eases in with `--in`.
- The naming bar follows it with its own glide (`.namebar.show.glide`) or fade.
- Scrolling a block into view is smooth unless reduced motion.
- Putting the cursor away fades the outline and bar out where they are (`choose(null)`/`show(null)`).
- The markers are invisible and never animate.

## Size

Approved budgets: **36 KB** gzip for `pipeup.min.js` and `pipeup.esm.js`, **12 KB** for core
(`scripts/size.mjs` moves from 33 KB with the code). Headroom at 0.4.0-beta.2: 3,105 B (classic) and
3,471 B (esm), shared with step 2 (touch and the drawer).

| Piece | Estimate (gzip) |
|---|---|
| `isBlock`, `blockTree`, `row`, `childBlocks` | 350 B |
| Markers, keys, landing, levels, put-away and focus return | 600 B |
| Names and descriptions (element references, counts) | 150 B |
| Bar: Inside it, Pin, two icons, pins through `commentOn`, `role=group`, placement | 250 B |
| Announcer, keyboard hint, control label | 200 B |
| Focus after send/cancel, `back` by opener, `backToDraft` | 150 B |
| Bubbles in page order with names, column `.opn` | 250 B |
| Selection settle and Enter | 120 B |
| Shift+Enter threads, shortcut brings back, Enter passed to page controls | 150 B |
| Styles (focus ring, forced colours, `.sr`, `.opn`) | 150 B |
| **Total** | **about 2.35 KB** |

That leaves about 0.75 KB (classic) for step 2, which is too little. Step 1 is held to **1.8 KB** (classic),
leaving 1.3 KB. If it measures over, cut in this order: the selection announcement; Shift+Enter's "n of m" wrapping
(open the first only, with the count); bubble names that name
the block; the "Nothing around it" messages; `childBlocks`' "first in the window" (first child only). Each
cut keeps the behaviour working, only less helpful. The size pass's tools (short style tokens,
`mangleProps`) apply to new names.

## Testing

- **Unit (fake `Look`).** `isBlock` agrees with `pickBlock`; `blockTree` levels, folding of same-box
  wrappers and `data-pipeup-id`; `row` covers every leaf exactly once at every level; `childBlocks` and the
  remembered child; landing (focused element, first in window); the name rules (short/long blocks, counts,
  `data-pipeup-label`).
- **Keyboard-only e2e** (no `mouse` calls; Chrome):
  - the shortcut lands the cursor on the focused element's block, else the first block in view; the hint is
    the keyboard one;
  - Tab and Shift+Tab walk row 0 in page order and wrap; ↑ then Tab walks the parent row; ↓ returns to the
    remembered child; the bar's buttons do the same;
  - Enter opens the draft with focus; Enter sends; focus is back on a marker on the same block whose name
    includes "has 1 comment"; Esc in a draft does the same;
  - Esc on the marker returns focus where it was and the next Tab reaches the page; a second Esc leaves
    comment mode; leaving with the shortcut returns focus too;
  - Start commenting by keyboard closes the menu and focuses the cursor; by mouse it doesn't;
  - with the cursor put away, the shortcut brings it back on the same block; with it in use, the shortcut
    leaves comment mode; after a mouse start, the shortcut leaves;
  - Shift+Enter on a block with three threads opens them in page order, one per press, wrapping, with the
    announcer's "Comment n of 3"; Esc returns to the marker; on a block with none, "No comments on this
    block" and nothing opens;
  - with the cursor away (and after a mouse start), Enter on a page link and Space on a page checkbox do
    what the page does and choose no block, while a mouse click on the same control is still swallowed;
  - Pin from the bar starts a pin draft at the centre; with a block draft it keeps the words;
  - a draft with words on a slide that went away is returned to by Enter, with focus in it;
  - a selection made without `mouseup`/`keyup` (set by script) shows the icon after it settles, and Enter
    comments on it;
  - closed column threads open from their button; bubbles are in page order; Esc in a thread returns to the
    bubble, button or row that opened it;
  - without the cursor, focus after sending is in the new thread's reply line (the `app.ts:453` fix);
  - the empty draft's hidden Send button takes no Tab stop.
- **Accessibility tree.** Through CDP (`Accessibility.getPartialAXTree` on the focused node), check the
  marker's role, name and description for a short paragraph, a long section and an image, and that the
  description comes from the page block. Playwright's own name computation may not follow element
  references, so it isn't the check.
- **reveal.js stub.** `reveal.html`'s stub also records ↑, ↓, Space and Esc reaching its listeners (it
  listens on `window`; add one on `document` as reveal.js does): none arrive while a marker has focus; →
  still moves the slide (only `.present` shows) and the cursor lands on the new slide's first block, on the
  other marker.
- **Host DOM untouched.** Snapshot `document.documentElement` (without `<pipeup-root>`) before and after a
  full keyboard session, and a `MutationObserver` on the page records nothing: no `tabindex`, id or
  `aria-*` written.
- **Forced colours and reduced motion.** `emulateMedia({ forcedColors: "active" })`: the focused outline
  has a visible outline, and every Pipeup control shows a focus ring. `reducedMotion: "reduce"`: the
  outline cross-fades, never moves while seen.
- **By hand, before the beta.** NVDA with Chrome and Firefox (browse mode and focus mode), JAWS with Chrome,
  VoiceOver with Safari: names and descriptions read as designed; browse-mode Enter on page text comments
  and moves the cursor (and whether that click has `detail === 0`); ↓ in browse mode from the marker reads
  the bar; the hint is read once, on the first landing; arrows in the hint are read as arrows; caret
  browsing and screen-reader selections show the comment icon; a magnifier follows the cursor. Known: NVDA
  in focus mode takes the first Esc in a draft to return to browse mode, so a second Esc reaches Pipeup (as
  for every field on the web).
- **By hand, before 0.4.0.** NVDA and JAWS read a long block's whole description on every move: check by
  hand that this is bearable (or that the reader can interrupt it) before 0.4.0 is released.

## Fixes that come with it

- Every Pipeup control that draws focus only with a background (`.ib`, `.mi`, `.nb`, `.hs`, the selection
  icon) gets `outline: 2px solid Highlight` under `forced-colors: active`, where backgrounds are dropped.
- The empty draft's Send button (opacity 0, `composer.ts`) is inert until there is text.
- These were found while designing; they fit here because they are focus and keyboard bugs.

## Not doing

- Touch and the narrow-page drawer (step 2).
- A Pipeup text cursor; remappable keys; keys for "next comment" (J/K); `ariaNotify`; Reference Target.
- Showing the cursor to mouse users, or starting it with Tab after a mouse start.
- Blocks larger than 60 % of the window are not cursor targets, as for the mouse; step 2's decision on
  measuring against the page will apply to both.

---

## Change log

- 2026-10-07 — First version.
- 2026-10-07 — Open questions answered: Enter comments on a settled selection (kept); the shortcut brings a
  put-away cursor back and leaves comment mode when the cursor is in use; Shift+Enter on the cursor opens
  the block's threads in page order, one per press ("Comment 1 of 3 on this block"), or says "No comments on
  this block"; with the cursor not in use, Enter and Space on a page control do what the page expects.
- 2026-10-07 — Built (plan `plans/2026-10-07-2c2-keyboard.md`). As built: `blockTree` is a recursive pass over
  `children` and skips removed blocks; the page never hears the keyup of a key the cursor took; modifier+↑/↓
  pass through; the shortcut brings a put-away cursor back, leaves comment mode when nothing is landable, and
  leaves the menu open (Esc closes it first); Resolve returns focus to the cursor (or the Comment control when
  there is none); Send keeps focus in the reply line; a paused mouse drag is not a settled selection; Enter on
  a focused page control wins over a settled selection; selecting words while the cursor is out puts it away,
  so the selection's comment icon shows; Esc with nothing focused before leaves focus on the page, but Chrome's
  Tab starts from where the cursor was, so the next Tab reaches Pipeup's corner control, then the page. Size:
  +3,047 B (min) / +3,077 B (esm) gzip, over the 1.8 KB target; the cut list saves 92 B in all and was not
  applied (58 B of headroom left for step 2).
- 2026-10-07 — Final-review fixes. As built: the design's `pinAt` was folded into `commentOn(el, point)`.
  Moving the cursor off the draft's block lets go of it: the draft waits there (↑ and Esc are the cursor's;
  Enter returns to a draft with words). With the cursor not in use, Enter in a page field with a form submits
  the form (the click the browser makes on its submit button passes, and the submit), and opens no draft. A
  keyup lost on the way no longer swallows a later one. Forced colours: the "add your name" link draws its
  focus with Highlight. All comments and Copy use the same page order as the bubbles, column and
  Shift+Enter (`byPage`), which also orders comments within one element. The block tree's rebuild cost is
  noted as about 15–25 ms on very large pages (to be improved). Size after the fixes: 36,765 B (min) and
  36,419 B (esm) gzip, core 8,875 B (99 B of headroom on the classic build).