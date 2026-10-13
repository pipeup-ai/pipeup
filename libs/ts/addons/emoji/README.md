# @pipeup/emoji

The full set of emoji for reactions. Pipeup itself offers a quick row of six (👍 ❤️ 😂 🎉 😮 🙏); with this add-on
the row ends with a **More** button that opens a picker with **search**, the groups phones use, **recently used**, and
one **skin tone** for the hands and people, remembered in the browser. Spec:
[FUNCTIONAL_SPEC §7b](../../../../docs/FUNCTIONAL_SPEC.md); design:
[docs/design/reactions.md](../../../../docs/design/reactions.md).

Emoji are drawn by the device's own emoji font, so they look native on each platform, and only emoji the device can
draw as one picture are offered. Nobody can react with anything that isn't one emoji: Pipeup checks every reaction,
whoever it comes from.

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/emoji/dist/emoji.min.js"></script>
```

Or load the combined file, `pipeup+emoji.min.js`. With a bundler:

```js
import { mount, use } from "pipeup";
import emoji from "@pipeup/emoji";

use(emoji());
mount();
```

## What it sends, and to whom

Nothing. The emoji are part of the script (about 31 KB gzip, from Unicode's emoji data through the MIT-licensed
`emojibase-data` package at build time; nothing is loaded when it runs).
