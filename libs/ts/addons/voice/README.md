# @pipeup/voice

Dictate Pipeup comments. A microphone button appears in every comment box and reply line; press it, speak, and
your words appear in the box. You still press Send: this add-on never posts anything for you.

It uses **the speech engine your browser already has**. Pipeup downloads and runs no speech model of its own.

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/voice/dist/voice.min.js"></script>
```

Or load the combined file, `pipeup+voice.min.js`. With a bundler:

```js
import { mount, use } from "pipeup";
import voice from "@pipeup/voice";

use(voice());
mount();
```

## What it sends, and to whom

Pipeup itself makes no request. **Your browser, not Pipeup, may send your voice to Google or Apple.**

- The first time you press the microphone, Pipeup asks you, in one sentence, before anything starts:
  - **Chrome, when it can work on your device:** "Your words are worked out on this device. Nothing is sent."
  - **Chrome, when it needs a speech pack first:** the browser downloads the pack for your language from
    Google, once, and your words then stay on your device.
  - **Otherwise** (Chrome without a pack, and always in Safari): your voice goes to Google (in Chrome) or
    Apple (in Safari) to be turned into words. Pipeup doesn't keep it.
- **Safari can't tell Pipeup where it listens**, so Pipeup always shows the service sentence there.
- Your answer and the language are kept in this browser's local storage. Where the browser can't keep
  them, the panel says "This browser won't remember this choice". On a page opened from disk (`file://`) the
  choice may apply to every local file.

The package states this in `package.json` under `pipeup.network`; `pipeup check` and the site repeat it.

## Where it works

- **Chrome and Edge:** `SpeechRecognition`, on device where the browser allows it.
- **Safari:** `webkitSpeechRecognition`, through Apple's service.
- **Firefox:** has no speech engine, so Pipeup draws no microphone at all. The system's own dictation
  (macOS, Windows, iOS and Android all have one) still types into any field, including Pipeup's.

On a page opened from disk, **Chrome and Safari ask for the microphone again on every load**; that is the
browsers' rule, and Pipeup's own choice above isn't asked again.

## How it listens

- One recognition at a time. A second press stops it; sending, cancelling or clearing the box stops it too.
- It stops by itself after 60 seconds without speech, and when the box goes away.
- Words in progress show in the box as you speak and become final as the engine settles on them.
- The language is the nearest `lang` attribute above the commentable area, else the page's, else the
  browser's. The panel shows it and lets you change it.
- Problems (microphone blocked, nothing heard, no network, no microphone) are said in plain words.
- It announces "Listening" and "Stopped listening" to screen readers. Pipeup holds announcements while you
  are writing, so they may be heard only after you finish the comment.

## Keeping it intentional

Pin the script with its integrity hash (it is in the release notes), list the add-ons that may run on the page
(`<html data-pipeup-addons="voice">`; without the attribute every add-on runs), and set a content security policy that allows
scripts only from the page and the CDN and connections only to nowhere new (the browser's speech engine does the listening). This is best effort: it stops add-ons you didn't
choose, not a page that is already compromised. See the [guide](../../../docs/ADDONS_GUIDE.md).

## Licence

MIT
