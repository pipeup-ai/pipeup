# Trying the add-ons by hand

## 1. Share, live and voice (about 15 minutes)

```sh
cd libs/ts/pipeup && npm run build
cd ../addons && npm ci && npm run build
npm run demo        # a local mailbox and relay, and the page at http://localhost:8860/addons/examples/demo/page.html
```

Open the page in two browsers (Chrome and Firefox or Safari, or a normal and a private window). Each is a reviewer.

- **Share.** Menu (the round button, bottom right) → Start commenting → click a paragraph → comment. The other browser shows
  it within about 30 seconds; the menu row says "Shared · up to date". Turn "Send my comments" off, comment, and
  check it does not arrive; turn it on again.
- **Live.** Menu → Go live → Go live, in both. Comments appear in about a second; a cursor with a name shows while comments
  are showing; check People here and Go to where they are.
- **Voice** (Chrome or Safari). Microphone in a comment box → read the sentence → Start → allow the microphone → speak.
  Words appear in the box. Reload: the browser asks for the microphone again.

Stop the demo with `pkill -f examples/demo.mjs` (its mailbox is in memory, so the shared copy goes with it).

## 2. Spike S2: do two devices on different networks connect?

See [examples/phone-test/README.md](examples/phone-test/README.md): deploy a small Worker, open one link on this Mac and
one on a phone (mobile data, mobile data again, then the same Wi-Fi), note "Connected directly" or not, delete the Worker.

## 3. What needs a decision

- S6 over HTTPS with a certificate your browsers trust: needs a certificate authority you trust (or approval to add a throwaway one).
- S1 on other PrivateBin instances: only with their operators' permission.
- A real release run: push a pre-release tag such as `v0.4.2-beta.1` (it publishes to npm).

## Assist (`@pipeup/assist`)

Needs desktop Chrome with its built-in model (Prompt API; about 22 GB free disk, a GPU with more than 4 GB of video
memory or 16 GB RAM). Check `chrome://on-device-internals` if the row says "Not available".

Try pages (after `npm run build` here and in `../pipeup`, then `python3 -m http.server 8895` in this folder):
`http://localhost:8895/examples/assist/page.html` uses the browser's own model; `page-fake.html` uses a scripted stand-in, so the
whole flow can be tried without a model.

1. Open a page with the add-on (`pipeup+assist.min.js`) and write two comments: "Is the 20% lift right?" on a
   paragraph with that number, and "Love the title." on the heading.
2. Turn comment mode on (Shift+Option+C); the row is in the menu only while commenting is on. Menu, **Assistant replies**: the panel names the model, says nothing leaves the device, and has **Turn on** (or
   **Download and turn on** with a progress bar). Turn it on.
3. The first comment should get a short reply streaming into its thread under "AI assistant (on this device)", with
   the gently glowing ring. The compliment should get nothing.
4. Reload: nothing is looked at again. Add a reply to the first thread: it is looked at once more.
5. Switch the row off: no new replies. Try a page with `data-pipeup-assist-notes="notes.md"` and a notes file: a reply
   that used it ends with a link to the heading.
