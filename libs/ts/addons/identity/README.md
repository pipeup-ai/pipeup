# @pipeup/identity

Adds **My identity** to Pipeup's menu. From there a reviewer can:

- **make their identity portable**: Pipeup's ordinary identity can't leave the browser, so the add-on makes a new one from a
  seed they keep as a recovery code (`PU1-…`) or a `.pipeup-id` file;
- **back it up** again later, and **use it** on another browser or computer with the code or the file;
- **share a way to be reached** (an email address or `gh:name`) with everyone who has the page's comments, and stop sharing it.

Comments written under a portable identity are shown and verified by Pipeup itself, with or without this add-on. Design:
[docs/design/mentions.md](../../../../docs/design/mentions.md) and [docs/design/size-pass.md](../../../../docs/design/size-pass.md).

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/identity/dist/identity.min.js"></script>
```

## What it sends, and to whom

Nothing. The recovery code stays on this device unless the reviewer copies it or saves it as a file themselves.

## Without it

Pipeup works as before, without the menu row. A browser that already holds a portable identity (made with Pipeup 0.7, or
with this add-on) keeps writing as it, but can't show its code or replace it until the add-on is back.

## What it needs from Pipeup

The `menu`, `styles`, `dialog` and `identity` slots (Pipeup 0.8 and later). On an older Pipeup it stays off and says
which slot is missing.
