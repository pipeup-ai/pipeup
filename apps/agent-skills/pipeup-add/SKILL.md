---
name: pipeup-add
description: Use when someone asks you to add comments to an HTML page, make it reviewable, or "add Pipeup" — a document, slide deck, report, prototype or site that people will read and give feedback on. Adds Pipeup pinned to an exact version, without changing how the page looks or behaves.
---

# Add Pipeup to this page

Written for Pipeup 0.8.0-beta.2 This skill is published at https://pipeup-ai.github.io/pipeup/skills/pipeup-add/SKILL.md. Its companions: [integrate](https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md) (the full reference: layouts, decks, tabs, every option), [apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md) (answering the comments) and [summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md).

Pipeup lets people comment on an HTML page in place. **When the page already exists, never change its layout, styling or behaviour to make room for Pipeup**: it draws in its own layer, and you only add attributes and one script tag. Edit the HTML file only; don't download, fetch or run anything yourself.

## Do these, in order

1. **Pin the script.** Just before `</body>`:

   ```html
   <script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.0-beta.2/dist/pipeup.min.js"
           integrity="sha384-…" crossorigin="anonymous"></script>
   ```

   Copy the `integrity` value exactly from that version's release notes
   (https://github.com/pipeup-ai/pipeup/releases), or leave the attribute out if you can't look it up. If the page must
   work from disk, tell the author to save that file next to the page as `pipeup.min.js` and use `src="pipeup.min.js"`.
2. **Give the document an identity, once.** Add `data-pipeup-doc="<key>"` to `<html>`. A key is made in a browser with
   `await Pipeup.newDocumentAttribute()`; the author's prompt may already carry one. If the page already has one,
   **leave it exactly as it is**: changing it orphans every comment.
3. **Mark stable blocks** with `data-pipeup-id` (short kebab-case names for what the block is, unique on the page) and
   charts, images and icons with `data-pipeup-label`. Slides get `data-pipeup-slide="1"`, `"2"`, … Chrome such as slide
   buttons gets `data-pipeup-ignore`. The integrate skill has the detail for documents, decks, sites and tabs.
4. **Add-ons: none unless the author asks.** Pipeup itself sends nothing anywhere. If they want sharing, voice, live
   comments, the assistant, the full emoji set for reactions (`@pipeup/emoji`), notes for mentioned people (`@pipeup/inbox`,
   which needs an inbox service address the author gives you), GitHub issues for mentions (`@pipeup/github`, which needs
   `data-pipeup-github-repo`), update notices (`@pipeup/updates`) or recovery codes so reviewers can move their identity (`@pipeup/identity`), ask first, say in plain words what it sends and to whom, and pin it like the core script.
   Then list its id in `data-pipeup-addons` on `<html>` (append, never remove an entry) so only chosen add-ons run, and
   tell the author about a Content-Security-Policy that allows scripts only from the page and the CDN. Don't apply the
   policy yourself: a strict one can break a page.
5. **Offer an agent a place to answer.** Only if the author wants you (or another agent) to reply to comments: see
   `pipeup-apply`. Listing an agent (`data-pipeup-agents`) also means adding the agents add-on (`@pipeup/agents`), pinned
   with its integrity hash, because it is what shows the agent's replies in the page; say in plain words what it does
   (see `pipeup-integrate`). Don't list an agent's key you weren't given. On the author's own computer `pipeup watch`
   adds the add-on for the page it shows.

## Keep

When you rewrite or regenerate a page, keep `data-pipeup-doc`, `data-pipeup-share`, `data-pipeup-addons` and
`data-pipeup-agents` exactly as they are. A new document made from an old one gets a new `data-pipeup-doc` and no
`data-pipeup-share`, so comments of different documents never mix. Never put a stop key in a page.

## Tell the author

What you added (one script, a few attributes), how to comment (**⇧⌥C** on a Mac, **Shift+Alt+C** elsewhere, or the round
button), how comments come back (**Copy comments › As Markdown**, or, with the agents add-on, **Copy a prompt for my agent**), and that nothing leaves their
browser unless they choose it.
