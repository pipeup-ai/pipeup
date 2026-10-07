# VoiceOver check: keyboard cursor

A short hand check of the keyboard and screen-reader cursor with VoiceOver on a Mac, run before a
stable release. About 10 minutes. Record ✅ / ❌ and a note for each step.

## Set up

- **Browser:** Safari (VoiceOver works best with it). Optionally repeat steps 1–6 in Chrome.
- **Page:** the pre-release site, `https://pipeup-ai.github.io/pipeup/next/try/document.html`
  (or `http://localhost:8771/try/document.html`).
- **Clean start:** in the page, open the Comment control's menu once and check there are no comments; if
  there are, clear site data for the page.
- **VoiceOver on:** Cmd+F5. VO keys below are Control+Option.
- Click once in the page so Safari has focus, then don't use the mouse again.

## Steps

| # | Do | Expect to hear (roughly) | ✅/❌ |
|---|---|---|---|
| 1 | Press **Shift+Option+C** | The block cursor lands on a block: "Paragraph, 1 of N, …", the block's words, then the hint "Tab moves between blocks · ↑ ↓ change level · Enter comments · Esc to finish". | |
| 2 | Press **Tab** three times | Each press: the next block's role and position ("Heading, 2 of N"), then its words. A blue outline follows on screen. | |
| 3 | Press **Shift+Tab** | The previous block is read. | |
| 4 | Press **↑** | The block around it ("Section, …"). Then **↓**: back to the block you came from. | |
| 5 | Press **↑** until nothing is around it | "Nothing around it", said once. | |
| 6 | Press **Enter** | "Commenting on …" and the comment box has focus ("Comment, edit text"). | |
| 7 | Type "Test one", press **Enter** | The comment is sent; focus returns to the cursor on the same block, now read with "has 1 comment". | |
| 8 | Press **Shift+Enter** | The block's thread opens and is read. Press **Esc**: focus is back on the cursor. | |
| 9 | Tab to a block with no comments, press **Shift+Enter** | "No comments on this block". | |
| 10 | Press **Enter**, type a word, press **Esc** | The draft is cancelled (or asks to keep words, per the page), and focus is back on the cursor, not lost. | |
| 11 | Tab to the naming bar's **Pin** (VO+arrows if needed) and activate it | "Pin on …"; a pin comment box opens with focus. Press Esc. | |
| 12 | On the cursor, press **Esc** | "Cursor put away · ⇧⌥C brings it back". Tab now moves through the page's own links. | |
| 13 | Press **Shift+Option+C** | The cursor comes back on the block it was on. | |
| 14 | Press **Esc** twice | "Cursor put away", then "Comment mode off". The Comment control's name no longer says "comment mode on". | |
| 15 | Tab to the **Comment** control | Its name: "Comment, …" (with "comment mode on" only while it is on). | |
| 16 | VO browse mode: **VO+→** through a paragraph, then **VO+Space** on it while comment mode is on (Shift+Option+C first) | The cursor moves to that block (not put away), and the block is read. | |
| 17 | Long block: Tab to the section with the most text and listen | The full description is read. Note whether it's tolerable or too long on every move. | |
| 18 | Open `try/slides.html`, Shift+Option+C, then **→** | The slide changes and the cursor lands on the new slide's first block, read aloud. | |

## Also note

- Anything read twice, or not read at all.
- Anywhere focus seemed to disappear (VoiceOver says nothing, or reads the page title).
- Whether the blue outline and VoiceOver's own cursor stay together.

## Result

- 2026-10-07, 0.4.0-beta.3: **pass** (VoiceOver on macOS, run by the maintainer). NVDA and JAWS checks follow in 0.4.x.
- Date, macOS and Safari versions:
- Overall: pass / pass with notes / fail
- Notes and follow-ups (file as issues for 0.4.x):
