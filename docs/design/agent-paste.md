# Pasting an agent's replies, signed or not

Builds §15b's copy-and-paste hand-off (PR #96) and signed pasted replies (PR #98) in the agents add-on, with the
small pieces they need from Pipeup and the command line. Mock-ups: `agent-handoff-mockups.html`,
`signed-replies-editions-mockups.html`.

## The replies block

What the agent sends back, anywhere in its chat message:

````
```pipeup-replies
agent: Muse
thread: <thread id>
reply: what changed and where
  (lines that don't start with a field carry on the field above)
addressed: short note
signed: <base64url of the signed ops, JSON>
```
````

- An entry starts at `thread:`. `agent:` names the agent for the entries after it; without one the name is "Agent".
- `signed:` is optional. It carries the agent's own signed ops for that entry (the reply, and the addressed note when
  there is one), exactly as `pipeup reply` writes them to a replies file. Each op names the page's document, the
  thread and the words, so its signature covers all three.
- More than one block in a message is read as one.

## Classifying a pasted entry

For each entry, in order:

1. The thread isn't on the page → left out ("for a comment that's no longer here").
2. No `signed:` → **unsigned**, reason "not signed".
3. `signed:` decodes to well-formed ops that are authentic, for this document and this thread, carrying the same words
   as the entry's `reply:` and `addressed:` (whitespace aside):
   - the author is listed in `data-pipeup-agents` → **signed**;
   - otherwise → unsigned, reason "signed with a key this page doesn't list".
4. Anything else (doesn't decode, fails the signature, another page or thread, different words) → unsigned, reason
   "changed after it was signed".

Signed entries are merged as they are (`host.merge`), like a replies file's. Unsigned entries are written by the
reviewer (below). Nothing is added until the person presses Add.

## Unsigned replies: written by the reviewer, named for the agent

Pipeup gains one host call, `paste(thread, agent, text, note?)` (capability `paste`). It writes a reply to the
thread's first comment, and an addressed note when given, signed by **the reviewer's own identity** but carrying the
name `AI assistant · <agent>`. A person can't choose that name for themselves; only this call uses it. So an unsigned
pasted reply is drawn as an AI's, and its signature says truthfully who put it there.

## "pasted by you" / "pasted by Sam"

One rule in Pipeup's thread view, so it holds for every page and every way a reply arrives (paste, shared copy,
feedback file): a reply named `AI assistant · <agent>` whose writer is **not** a key in `data-pipeup-agents` shows
"pasted by you" when the writer is this reviewer, and otherwise "pasted by <the writer's name>": the name they comment
under, or their animal. Replies from a listed agent's key (replies file, live link, signed paste) show nothing more.
The on-device assistant's replies (`AI assistant (on this device)`) are untouched.

This also closes a gap: before, anyone in a shared copy could post under an agent's name and look like the agent.

Two consequences for names, found while building it:

- A writer's own name is the latest **non-agent** name they used. Without this, a reviewer who hadn't added a name
  would see all their comments renamed to the agent after pasting.
- The short tag that tells two people with one name apart (`Sam · 4F2A`) isn't added to agent names. A signed reply
  and a pasted one from the same agent share its name on purpose; "pasted by" already tells them apart.

## The command line: `pipeup reply --print`

`pipeup reply --print --doc <document id> --thread <id> "words" [--addressed "note"]` signs the same ops it would
write and prints one replies block to standard output instead of writing the replies file. `--page <file>` still
works in place of `--doc`. Copy for my agent puts the document id (never the page's key) in the copied text, so an
agent that never sees the page's file can sign.

## Copy for my agent

Replaces "Copy a prompt for my agent". It copies, in one text: the page's title and address; that the comments were
left in the reviewer's browser and aren't in the page's file; the open comments as Pipeup's Markdown for agents,
with how many resolved ones were left out; how to answer in a replies block; how to sign it (whether the page lists
the agent, and the `--print` command with this page's document id and Pipeup version); the faster routes (live link,
replies file) when they exist; and the rules (only mark addressed, never resolve, never answer as the reviewer).

## Paste my agent's replies

A menu row opens a dialog with a text box. As the person pastes, the dialog says what it found, in words, one line
each: how many replies signed by which agent, how many unsigned and why, how many say addressed, how many will be left
out and why. **Add N replies** adds them; Cancel or Esc adds nothing. With nothing readable it says so and offers
**Copy that request**, which copies a short request for the agent to answer in a replies block.

## Not in this change

- **Shared copies.** The share add-on sends only ops the reviewer wrote. Unsigned pasted replies are the reviewer's,
  so they travel. Signed ones are the agent's and don't, as replies-file replies don't today. Sending them needs a
  spec decision (§11 says a reviewer never sends comments they received).
- The skills and `llms.txt` aren't changed here; the copied text carries the instructions an agent needs.

## Change log

- 2026-10-18 — First version, with the two naming rules found while building it.
