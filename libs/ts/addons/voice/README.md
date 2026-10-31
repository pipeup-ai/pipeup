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

Pipeup itself makes no request. **Your browser, not Pipeup, may send your voice to its maker's speech service.**

- The first time you press the microphone, Pipeup asks you, in one sentence, before anything starts:
  - **When the browser can work on your device:** "Your words are worked out on this device. Nothing is sent."
  - **When it needs a speech pack first:** the browser downloads the pack for your language from its maker,
    once, and your words then stay on your device.
  - **Otherwise** (Chrome without a pack): your voice goes to the browser's speech service to be turned into
    words. Pipeup doesn't keep it.
  - **Safari** may work some languages (such as English) out on the device and send others to Apple, and
    can't tell Pipeup which, so its sentence says so: "Safari uses Apple's speech recognition. Depending on the language and
    device the words are worked out here or your voice is sent to Apple; Pipeup can't tell which, and doesn't
    keep it."
  - **A language the engine can't do at all** (Firefox, for a language with no model) is said before anything
    starts, with Start greyed until you choose another.
- Your answer and the language are kept in this browser's local storage. Where the browser can't keep
  them, the panel says "This browser won't remember this choice". On a page opened from disk (`file://`) the
  choice may apply to every local file.

The package states this in `package.json` under `pipeup.network`; `pipeup check` and the site repeat it.

## Where it works

- **Chrome and Edge:** `SpeechRecognition`, on device where the browser allows it.
- **Safari:** `webkitSpeechRecognition`, through Apple's speech recognition. Safari asks twice the first time:
  for the microphone, and to "capture your audio and use it for speech recognition"; macOS may also ask once
  whether Safari may use Speech Recognition. **A refusal lasts for the page**: allow it, then reload. If the
  microphone is allowed but Pipeup says Safari isn't allowed to use Apple's speech recognition, turn on Siri or
  Dictation, or allow Safari under System Settings › Privacy & Security › Speech Recognition, then reload.
  Languages Apple sends to its service stop by themselves after about a minute; press the microphone again.
  Safari can send everything said so far again; Pipeup writes it once, so a phrase repeated word for word
  straight after itself is written once too.
- **Firefox 157 to 159:** has no speech engine, so Pipeup draws no microphone at all and says so once in the
  browser console. The system's own dictation (macOS, Windows, iOS and Android all have one) still types into
  any field, including Pipeup's. Firefox 160 Beta and Nightly have an on-device engine (a one-time model
  download from Mozilla); Mozilla intends to ship it in Firefox 161.

On a page opened from disk, **Chrome and Safari ask for the microphone again on every load**; that is the
browsers' rule, and Pipeup's own choice above isn't asked again.

## How it listens

- One recognition at a time. A second press stops it; sending, cancelling or clearing the box stops it too.
- It stops by itself after 60 seconds without speech, and when the box goes away.
- Words in progress show in the box as you speak and become final as the engine settles on them.
- The language is the nearest `lang` attribute above the commentable area, else the page's, else the
  browser's. The panel shows it and lets you change it.
- Problems (microphone blocked, nothing heard, no network, no microphone, the browser's speech service off)
  are said in plain words, naming what to change; where the engine gives its own reason, it is passed on.
  After any of them the microphone works again at once.
- Words the engine delivers twice (Safari can send everything said so far again) are written once.
- It announces "Listening" and "Stopped listening" to screen readers. Pipeup holds announcements while you
  are writing, so they may be heard only after you finish the comment.

## Keeping it intentional

Pin the script with its integrity hash (it is in the release notes), list the add-ons that may run on the page
(`<html data-pipeup-addons="voice">`; without the attribute every add-on runs), and set a content security policy that allows
scripts only from the page and the CDN and connections only to nowhere new (the browser's speech engine does the listening). This is best effort: it stops add-ons you didn't
choose, not a page that is already compromised. See the [guide](../../../docs/ADDONS_GUIDE.md).

## Licence

MIT
