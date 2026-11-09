# Pipeup for browsers

A browser extension that adds Pipeup to any web page: press Pipeup in the toolbar (or Shift+Alt+P) and choose
**Comment on this page**. Comments, the reviewer's identity and their choices are kept by the extension, so nothing goes
into the site's own storage, and the page's scripts can't see or change them.

Spec: [docs/EXTENSION_SPEC.md](../../docs/EXTENSION_SPEC.md). Design: [docs/design/browser-extension.md](../../docs/design/browser-extension.md).

**Status:** built for local testing in Chrome (and Edge, which loads the same build). Not in any store yet.

## Try it in Chrome

```bash
cd libs/ts/pipeup && npm ci && npm run build && cd ../../..
node tools/build-extension.mjs
```

Then in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Choose **Load unpacked** and pick `apps/extension/dist/chromium`.
3. Pin Pipeup from the puzzle-piece menu, open any web page and press it.

After a rebuild, press the reload arrow on Pipeup's card in `chrome://extensions`, then reload the page.

## What's in it

- `src/manifest.json`: the extension's name and what it may do. It asks for no access to sites when installed: a press
  on the toolbar button reaches that one tab, and **Always on for this site** asks the browser for that site only.
- `src/popup.*`: the toolbar panel. Off: Comment on this page (which also starts comment mode). On: Start commenting,
  All comments, Pipeup's menu, Always on for this site, Turn off on this page. Pipeup's own corner button stays off the
  page unless **Show Pipeup's button on pages** is on (on the extension's page).
- `src/start.js`: adds Pipeup to the tab, in the extension's own world, with the extension's storage.
- `src/background.js`: the toolbar button's count of open comments.
- `src/comments.*`: **Comments you've made**, every page with comments, newest first, and the extension's one setting
  (also its options page).
- `pipeup/pipeup.esm.js`: copied unchanged from `libs/ts/pipeup/dist` by the build, so it is npm's file byte for byte
  (the build prints its hash).

## Tests

```bash
cd apps/extension && npm ci && npx playwright install chromium && npm run check
```

The tests load a test build (`dist/chromium-test`) that may also reach the test pages' server, because a test can't press
the toolbar button. **Always on for this site** isn't covered: Chrome asks the reviewer for permission, which a test
can't answer. Check it by hand.
