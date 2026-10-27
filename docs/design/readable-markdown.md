# Readable Markdown copy

Spec §7a. Visual spec: [readable-markdown-mockups.html](readable-markdown-mockups.html).

## Why

In the usability study (27 Oct 2026, issue I7), reviewers sent their comments back with Copy comments › As Markdown,
pasted into a reply. The copy opened with an ISO timestamp and a paragraph for coding agents, every thread carried a
43-character id and a CSS selector, and replies ended in HTML comments. The maintainer kept As Markdown in the
reviewer note and asked for the text to read to a person while still guiding an AI.

## What the text is

`copyAll(items, "ai", meta)` in `libs/ts/pipeup/src/export/format.ts`:

1. `# Comments on <title>`; one line with the open count, who wrote them (first three names, then "and N others") and
   the copy time from `toUTCString()` (`27 Oct 2026, 09:40 UTC`), plus the resolved ones left out; `Page: <address>`.
2. Per thread: `## N. <where>`; `On the words "…".` or `Pinned … .`; the root comment and its replies (unchanged lines,
   without the reply ids); `**<name>** marked it addressed (<ago>): <note>` when an agent did; and a last line
   ``Open · thread `<id>` · on `data-pipeup-id="…"` `` (`in` when the id is a slide or section around the element;
   `Open, addressed` or `Resolved` for the other states).
3. After a `---` rule, the paragraph starting "For an AI assistant:". Left out when nothing is open.

`copyThread` gives the same thread block without a number, with `Page:` under its heading.

## Choices

- **Agent-only facts on one last line.** The id and selector are on a line of their own that starts with `Open`,
  `Open, addressed` or `Resolved`. Nothing people or pages write can start a line that way: comment text is indented
  on every continuation line, and every other line starts with a fixed word, `#`, `-` or a bold name (unit tests
  cover a comment and a name trying).
- **Ids in code spans.** Base64url ids can hold `_` and `-`; a code span keeps a Markdown renderer from turning them
  into emphasis or a list.
- **No reply ids.** `pipeup reply`, the `pipeup-replies` block and both skills answer by thread id only; comment ids
  stay in `Pipeup.comments().threads` and `--json`.
- **Times stay relative** ("22m ago"), counted from the copy time the opening now gives in words.
- **UTC, not local time,** so the line reads the same to the author and to an agent wherever they are, and tests don't
  depend on the machine's time zone.
- **Size.** About +0.1 KB gzip on the full bundle (61.7 of 62 KB).

Consumers that match the text: the pipeup-apply and pipeup-summarise skills (both say what older pages give), the
agents add-on's browser tests, and `pipeup read`'s browser tests. Nothing parses it in code; the agents add-on embeds it
in Copy for my agent as it is.

## Change log

- 2026-10-27 — First version, with the visual spec.
