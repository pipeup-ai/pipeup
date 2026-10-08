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
