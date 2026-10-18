# Words and focus

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §5 (Tab from a comment box, the waiting box, typed words, keys,
focus), §7 (replies kept, a card's actions, ⋯ by keyboard, the menu). From the click-path review of 0.8.0-beta.2: six
testers found that Tab walked an empty box through every button on screen before it closed, that words were thrown
away by a click, an Esc or a resize, that keys used in Pipeup's menus turned a deck's slides, and that focus dropped
to the page after most actions on a comment.

## Tab from a comment box (`comment-mode.ts`)

- `moveOn(e)` runs in comment mode's capture listener, before the box's own keys. It takes Tab in a `.draft` or in a
  `.thread` on the page (not in All comments, which keeps its own Tab), unless the `@` list is open or the name field
  has focus.
- An empty box closes (`cancelDraft`) and the cursor lands on the next or previous block (`land`), in one press.
- A box with words, or a thread: Tab moves within until focus is on the last of its own stops (the first, for
  Shift+Tab); the next press moves the cursor on. The box keeps its words; a thread closes. Stops are the box's
  buttons, line and links that are focusable, not inert and on screen, so the hidden Send of an empty line is never one.
- `moving` stops the draft's closing from first refocusing the old block (two announcements for one press).

## The waiting box

- `waiting()` runs in `render()` and every frame: with the cursor out and a draft with words whose block isn't the
  cursor's, a dashed outline (`.pkw`, its own class so it never counts as the cursor's outline) sits on the draft's
  block, and the box takes `.wait`, dimmed until focus is back in it.
- `toDraft()` puts the outline, the naming bar and the cursor back on the draft's block and scrolls it into view.
  `ctx.backToDraft()` (app) calls it, says "Finish or cancel this comment first" in a toast (a status, so screen
  readers hear it too), then `focusDraft()` (the old `backToDraft`: back to its slide or view if needed, then the
  caret).
- Every path that met a draft with words now goes back to it this way: Enter on another block (`act`), a click on
  another block or Option-click (`onPick`), the selection's icon (`select.ts`), and opening a thread (`open`, which
  covers a bubble's Enter or click). A click on nothing in particular still leaves the box be (`dismiss`).
- `commentOn` focuses a box it moved (`focusDraft`), so a click on a second block leaves the caret in the box.

## Typed words are kept, or offered back

- The composer's `onCancel(words)` says what Cancel or Esc threw away. A reply line that had words keeps focus.
- `cancelDraft(words)` offers the draft back: the toast gets an Undo button (`toast(..., { run })`), which starts the
  same draft object again (its box is cached by draft, so the name field and position come back), lets comment mode
  `adopt` it, and `fill`s the box.
- A reply line's Esc or Cancel with words calls `actions.drop(id, words)`: "Reply discarded", with Undo putting them
  back in the line (or reopening the thread). An empty line's Esc closes the thread, as before.
- `keepReplies()` saves every reply line with words into `unsent` (the map that already kept replies for threads on
  other slides) when a thread closes (`open`) and before the views are rebuilt for another layout (`buildViews`);
  `putReply()` fills the line again when the thread opens, and after a rebuild (with the caret if it was there).
- `stepBack()` (Escape from anywhere but the box) only cancels an empty draft. It first clears words selected in
  comment mode.

## Keys stay with Pipeup

- `keep` on the layer stops, going down, up and pressed: Enter and Space on Pipeup's buttons; ↑ ↓ Home End PgUp PgDn
  in the menu, All comments and a ⋯ menu; and ← → in the menu (Copy comments). Other keys, such as ← → on the
  control or a bubble, still reach the page, so a deck still turns. Window capture listeners are unaffected.
- The composer stops `keyup` and `keypress` as well as `keydown`.
- Comment mode takes Escape on the page in its capture listener (and swallows its keyup), unless the menu or All
  comments is open, which take their own Escape first: the page never hears the Escape that steps back or ends
  comment mode.
- Enter in a page's form field is always the page's: the browser's click on the submit button is passed through,
  never taken as choosing that button (it moved the box there).

## Focus after an action

- `after(id)` (app) is read before a thread leaves and run once it has: the block cursor when it is out, else the next
  thread's own button where it was (All comments' `.mi`, the column's `.opn`, or a bubble), else the comment control.
  Resolve and deleting a thread use it; deleting a reply puts focus in its thread's reply line.
- `threadView.update` refocuses the same action after rebuilding (`data-k` on React, ⋯, the reaction chips, the quick
  row and the ⋯ menu's items), so a newer copy of the thread arriving never drops focus. React moves into its quick
  row; choosing an emoji, and Edit (saved or cancelled), come back to React and ⋯.
- The ⋯ menu moves with the arrows, Home and End, and Esc closes it (the launcher's Escape leaves `.pm` alone).
- The menu opened with the mouse takes ↑ and ↓ from its button. Esc on Copy comments' choices folds them first.

## Smaller fixes

- Delete's second question ignores presses for 0.5 s (`CONFIRM_MS`): the second click of a double-click, or a quick
  double tap, can't confirm it.
- A card's hidden actions have `pointer-events: none`, so a tap on a closed card opens it instead of resolving it.
  After Resolve the layer is `.still` until the pointer moves, so the next card's actions don't appear under it.
- The connecting line hides while All comments is closed (it ran to the window's edge after a new comment passed
  through the panel).
- Letting go of Space shows the block cursor's outline again. A double or triple click lets go of the block the first
  click chose (and its empty box). The quick row closes when focus leaves its card.
- Screen readers hear "Reply sent" and "Comment added". The edit box is named "Edit comment".

## From the regression pass on beta.5

- An input method's Esc (`isComposing`) is left alone by the composer, the name field, the panel's Escape and
  `stepBack`: it cancels the composition, never the words.
- `undoing` (app) is the showing message's Undo; `onKey` takes ⌘Z or Ctrl+Z for it unless typing in a field (Pipeup's
  own empty line counts as not typing). The button carries `aria-keyshortcuts`. A faded message's button is
  `visibility: hidden` once its fade is over, so it is no longer a Tab stop.
- `held()` no longer navigates: Tab on the cursor and a click on nothing (`dismiss`) leave a waiting box on its own
  slide. `backToDraft` says which slide when the box isn't here, and `focusDraft(there)` runs `toDraft` only once the
  deck is there, then restores the caret.
- Replies in All comments: `ctx.keepReplies()`/`ctx.putReply(id)` around the panel's `toggle`, `closeRow` and
  `setList`; `putReply` empties the thread's other copy of the line (the page's, behind the panel). The panel's
  Escape leaves a box or line with words to its own Esc (drop, with Undo). `setList` puts the caret back in a draft
  that moved into the panel instead of focusing the first row.
- Copy thread refocuses its ⋯ when the menu closed and the choice took no focus; `copyText`'s fallback gives focus
  back after selecting its hidden copy.
- The layer's look fade is `.fading` (it was `.sw`, which the menu's switch rule also matched, so the fade-out
  snapped and the layer took the switch's size).

## Size

Pipeup is 53.8 KB gzip (+1.7 KB); the budget rises from 53 to 54 KB (`scripts/size.mjs` and the add-ons' `CORE`).

## Change log

- 2026-10-15 — First version.
- 2026-10-18 — From the regression pass on beta.5: IME Esc, Undo by keyboard, waiting boxes on decks, replies in All
  comments, Copy thread's focus, the look fade.
