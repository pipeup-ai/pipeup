# Pipeup agent skills

Skills that teach coding agents to use Pipeup while they make web content. **Written
before the `pipeup` command line exists (planned for 0.5).** The UI they rely on ships in 0.3.0. They describe the workflow
we want agents to follow, and in doing so they fix the API the command line must provide. Steps that use the command line
do not work yet; the rest work today by copy and paste.

| Skill | When an agent uses it |
|---|---|
| [pipeup-integrate](pipeup-integrate/SKILL.md) | Making or editing an HTML document, deck or page that people will review |
| [pipeup-summarise](pipeup-summarise/SKILL.md) | Someone has feedback on a page and wants it understood |
| [pipeup-apply](pipeup-apply/SKILL.md) | Someone wants the feedback acted on |

The website publishes them for agents to fetch:

- https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md
- https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md
- https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md

## The contract these skills assume

Every item is something an agent will rely on. Status says where it comes from.

### In the page

| Item | Meaning | Status |
|---|---|---|
| `<html data-pipeup-doc="<id>:<key>">` | Document identity and key. Generated once, never changed. | Format exists (core `newDocumentAttribute`); auto-detection — **done in 0.3.0** |
| `<script src="https://cdn.jsdelivr.net/npm/pipeup@0.4.0-beta.1/dist/pipeup.min.js" integrity="sha384-…" crossorigin="anonymous">` | Loading Pipeup; pinned version + SRI (the `integrity` value is in each version's release notes) | One file, at most 32 KB gzip; on npm from 0.3.0 |
| Auto-mount when `data-pipeup-doc` is present | No inline script needed, so strict CSP pages work | **Done in 0.3.0** |
| `Pipeup.mount(options)` | Manual mount; options below | **Done in 0.3.0** (`root`, `name`, `store`) |
| `data-pipeup-id="kebab-name"` | Stable identity for a block (≤ 200 chars, unique in the page) | Used by core anchors |
| `data-pipeup-label="Q4 revenue bar"` | Human name for things without text (charts, images, canvases) | Used by core `labelOf` |
| `data-pipeup-slide="3"` | Marks a slide; 1-based | Used by core `locate`; navigation — **planned for 0.4** |
| `data-pipeup-ignore` | Chrome that is never a comment target and keeps working in comment mode | **Done** — never a comment target; keeps working in comment mode (0.3.0) |
| `<html data-pipeup-layout="column\|bubbles">` | Authors set it to force the column or bubbles; Pipeup reads it and never sets it | **Done in 0.3.0** |
| `Pipeup.onReveal(view => …)` / `Pipeup.setViewState({...})` | Reopen tabs/routes; record chart filters | **Planned for 0.4** |
| `var(--pipeup-panel, 0px)` | Width of the open All comments panel, for a page's fixed bars (the rest of the page is moved over for it) | **Done** (0.4) |
| `<html data-pipeup-reserve>` | The page reserves a 320 px gutter and consumes `var(--pipeup-gutter, 0px)`; Pipeup publishes `320px` while its column shows, `0px` otherwise | **Done in 0.3.0** |
| Comment mode (**C**, the control's Comment button; Option-click pins) | Blocks and pins on any page; the page's controls never fire while it is on | **Done in 0.3.0** |

### `Pipeup.mount(options)` — `root`, `name` and `store` built; `modes` and `slides` not yet built

| Option | Default | Notes |
|---|---|---|
| `root` | `document.body` | Area that can be commented on |
| `modes` | all | Subset of `"text"`, `"block"`, `"pin"`, `"general"` |
| `slides` | auto-detect | `"auto"`, `false`, or `{ current(): number, go(n): void }` |
| `name` | asked on first comment | Reviewer display name |

### On the command line — proposed, planned for 0.5 (`npx pipeup …`)

| Command | Does |
|---|---|
| `pipeup init <page.html>` | Adds `data-pipeup-doc` (once) and the pinned script tag; refuses to change an existing doc key |
| `pipeup check <page.html>` | Layout, overlap, id and accessibility checks; `--json`; non-zero exit on fail |
| `pipeup read <page.html> <feedback…> [--as ai\|text] [--all]` | Merges feedback files (opening sealed ones with the page's key) and prints Copy-for-AI output |
| `pipeup reply <page.html> <feedback-out> --thread <id> [--to <comment-id>] "text" [--resolve]` | Writes a signed reply / resolve as the agent's own identity into a feedback file to send back |

### Gaps found while drafting (to fix by 0.5)

1. **Thread ids are missing from Copy-for-AI output.** *(Closed in 0.3.0: thread and comment ids are in the output.)* `pipeup-apply` must reply to a specific
   thread, so each `## Thread N` block needs `- **Thread:** <id>` (and comment ids for replies).
2. **Agents need their own identity.** `pipeup reply` signs as an "Agent" profile kept by the command line,
   named after the tool (for example "Claude"), so people can see which comments an agent wrote.
3. **Ids must survive edits.** The apply skill tells agents never to rename or remove a
   `data-pipeup-id`; `pipeup check` should warn when an id that has comments disappears.
