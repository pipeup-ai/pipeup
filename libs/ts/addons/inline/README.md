# @pipeup/inline

Ask your reviewers what you want to know, where you want to know it. You put **asks** in the content (open,
agree, or a choice of options), and reviewers answer them in place, without comment mode or a shortcut. Every answer
is an ordinary Pipeup comment, signed by the reviewer, so it shows in All comments, takes replies and reactions, and is
copied for AI, read by agents, shared and sent like any other. A block can also show its comments **in place**,
under it, instead of in the margin. Spec: [FUNCTIONAL_SPEC §11b](../../../../docs/FUNCTIONAL_SPEC.md); design:
[docs/design/inline-comments.md](../../../../docs/design/inline-comments.md).

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/inline/dist/inline.min.js"></script>
```

Or load the combined file, `pipeup+inline.min.js`. With a bundler:

```js
import { mount, use } from "pipeup";
import inline from "@pipeup/inline";

use(inline());
mount();
```

It needs a Pipeup with the `place` and `post` slots (the first release after 0.8.2); with an older one it stays off
and says why.

## What it sends, and to whom

Nothing: the inline add-on uses no network. Answers are comments, kept and sent the way the page's other comments are.

## Asks

Mark the block with a name (`data-pipeup-id`, which stays the same when you change the question's words), the
question, and a kind. What you put inside is the **fallback**: it shows to anyone without the add-on, so write the
question there too, with a way to comment.

```html
<!-- choice: two to six options, separated by |; data-pipeup-ask-other adds Other, which asks for words -->
<div
  data-pipeup-id="q-journeys"
  data-pipeup-ask="Is “Go through every comment” one journey or two?"
  data-pipeup-ask-kind="choice"
  data-pipeup-ask-options="One|Two"
  data-pipeup-ask-other
  data-pipeup-ask-needed
>
  <p>Is “Go through every comment” one journey or two? Comment on this with ⇧⌥C.</p>
</div>

<!-- agree: Agree (words optional, to confirm or steer) or Needs change (asks what) -->
<section data-pipeup-id="FR-012" data-pipeup-ask="Agree with this requirement?" data-pipeup-ask-kind="agree">
  <p>FR-012: Reviewers can answer an ask without comment mode.</p>
</section>

<!-- open (the default): the reviewer answers in words -->
<div data-pipeup-id="q-name" data-pipeup-ask="What should we call this feature?">
  <p>What should we call this feature? Comment on this with ⇧⌥C.</p>
</div>
```

- **One answer per reviewer per ask.** Choosing again, or sending new words, changes their answer (shown as edited),
  never adds a second. Replies under an answer are a conversation, not more answers.
- **Nobody is steered.** Until a reviewer answers, an ask shows only its question and its buttons or box. After, it
  shows their answer with Change and, where others' comments are present (shared, live or added from files), how many
  answered and the count for each option. Counts name no one; the threads under the ask show who said what.
- **Asks you need.** `data-pipeup-ask-needed` counts the ask in Pipeup's menu ("1 of 2 asks answered"); the row lists
  the unanswered ones, each going to its ask.
- **Changing the question.** An answer given to earlier words says so ("Asked as: …"). Removing an ask leaves its
  answers as comments whose place is gone, with their question kept.
- **Hide comments.** An ask still shows its question and its buttons or box (they are your content), but no counts
  and no threads.
- A comment someone makes in comment mode on an ask's block is an ordinary comment, shown with the ask's threads but
  not counted.

An ask without a `data-pipeup-id`, or a choice with fewer than two or more than six options, is left as you wrote it,
with one line in the console naming it.

## Comments in place

```html
<figure data-pipeup-id="home-hero" data-pipeup-inline>…</figure>
```

Under the block, one quiet line ("3 comments · latest from Ada") opens its threads in place, to read and reply.
Everything else on a thread (resolve, reactions, copy, filters) is in All comments. These threads leave the margin.
Blocks you didn't mark keep their comments in the margin.

## What it changes on your page

Only inside the elements you marked: Pipeup adds one `<pipeup-place>` at the end of each (its content in its own
shadow root), marks the element `data-pipeup-placed`, and adds one rule that hides an ask's fallback while the add-on
draws it. Turning the add-on off, or Pipeup's `unmount()`, puts the page back exactly as it was.

## For agents

`pipeup read page.html` lists each ask after the comments, with its question, kind and every reviewer's latest
answer (`--json` gives them as `asks`). Agents may reply to an answer, as to any comment; an agent never answers an
ask.

## Try it

[`examples/inline/`](../examples/inline/) is a small review page with each kind of ask and a block with its comments in
place. Build the core and the add-ons, then open `examples/inline/index.html`.
