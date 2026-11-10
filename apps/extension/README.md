# Pipeup for browsers

A browser extension that adds Pipeup to any web page: press Pipeup in the toolbar (or Shift+Alt+P) and choose
**Comment on this page**. Comments, the reviewer's identity, their choices and add-ons' choices are kept by the
extension, so nothing goes into the site's own storage, and Pipeup's UI is closed to the page's scripts.

Spec: [docs/EXTENSION_SPEC.md](../../docs/EXTENSION_SPEC.md). Design: [docs/design/browser-extension.md](../../docs/design/browser-extension.md).

**Status:** built for local testing in Chrome (and Edge, Brave and the other Chromium browsers), Firefox and Safari on a
Mac. Not in any store yet.

```bash
cd libs/ts/pipeup && npm ci && npm run build && cd ../../..
cd libs/ts/addons && npm ci && npm run build && cd ../../..
node tools/build-extension.mjs           # dist/chromium and dist/firefox
node tools/build-extension.mjs --safari  # also Safari's app, on a Mac with Xcode
```

## Try it in Chrome

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Choose **Load unpacked** and pick `apps/extension/dist/chromium`.
3. Pin Pipeup from the puzzle-piece menu, open any web page and press it.

After a rebuild, press the reload arrow on Pipeup's card in `chrome://extensions`, then reload the page.

## Try it in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and pick `apps/extension/dist/firefox/manifest.json`.
3. Pin Pipeup from the extensions menu (the puzzle piece), open any web page and press it.

Firefox keeps a temporary add-on until it quits; after a rebuild, press **Reload** on Pipeup's card there. Comments sit
in Firefox's **sidebar** when pinned. **Send to my agent** is set up with
`npx --yes pipeup@1 browser install --browser firefox`.

## Try it in Safari (Mac)

1. Build with `--safari`: it makes `dist/safari-app`, Xcode's project around `dist/safari`, and builds the Pipeup app,
   signed for this Mac only.
2. In Safari, turn on **Settings → Advanced → Show features for web developers**, then **Develop → Allow Unsigned
   Extensions** (Safari asks for your password, and forgets it each time it quits).
3. Open `apps/extension/dist/safari-app/build/Build/Products/Debug/Pipeup.app` once, then turn Pipeup on in
   **Settings → Extensions**.
4. Pipeup's toolbar button asks for each site the first time it's pressed there.

Safari has no panel beside the page, so comments always open on the page (**Keep comments beside the page** isn't
offered), and **Send to my agent** isn't offered yet: Safari lets an extension talk only to the app it comes in.

## What's in it

- `src/manifest.json`: the extension's name and what it may do. It asks for no access to sites when installed: a press
  on the toolbar button reaches that one tab, and **Always on for this site** asks the browser for that site only.
- `src/popup.*`: the toolbar panel, which is Pipeup's menu: who you are, Copy comments, Theme, Comments, Hide comments,
  Start commenting, Always on for this site, Turn off on this page. Off, it offers Comment on this page.
- `src/panel.*`: the browser's side panel, with every comment: the list, threads, replies, Resolve. Pinned (its pin, or
  **Keep comments beside the page**), threads opened on the page show there (Pipeup runs with `ui: "host"`); unpinned,
  they open as popovers on the page (`layout: "bubbles"`). New comments are always written on the page, in a box with
  the cursor in it. **Show Pipeup's button on pages** (on the extension's page) brings back Pipeup's own button, menu and
  panel instead.
- `src/start.js`: adds Pipeup to the tab, in the extension's own world, with the extension's storage.
- `src/background.js`: the toolbar button's count, the right-click **Comment with Pipeup**, and pictures of where
  comments were made (`chrome.tabs.captureVisibleTab`, cut and faded around the place, kept in the extension).
- `addons/`: Emoji, Voice, Share, Live, Save to GitHub and My identity, copied unchanged from `libs/ts/addons/*/dist`
  (build them first with `npm run build` in `libs/ts/addons`), turned on in the extension's settings.
- **Send to my agent** talks to `pipeup browser` on this computer through the browser's native messaging; set it up
  once with `npx --yes pipeup@1 browser install --extension-id <id>` (Chrome and its kin) or `--browser firefox`.
- `src/browser.js`: what differs between browsers (the panel beside the page, reaching agents), in one place. The build
  gives each browser a manifest without the others' keys.
- `src/comments.*`: **Comments you've made**, every page with comments, newest first, and the extension's one setting
  (also its options page).
- `pipeup/pipeup.esm.js`: copied unchanged from `libs/ts/pipeup/dist` by the build, so it is npm's file byte for byte
  (the build prints its hash).

## Tests

```bash
cd apps/extension && npm ci && npx playwright install chromium && npm run firefox && npm run check
```

`npm run check` builds, runs `web-ext lint` on the Firefox build, then the tests in Chromium (Playwright) and Firefox
(Puppeteer over WebDriver BiDi, since Playwright can't add extensions to Firefox; `npm run firefox` fetches a released
Firefox for them). The tests load test builds (`dist/chromium-test`, `dist/firefox-test`) that may also reach the test
pages' server, because a test can't press the toolbar button. Safari can't be driven with an extension: try it by hand. **Always on for this site** isn't covered: Chrome asks the reviewer for permission, which a test
can't answer. Check it by hand.

## For the stores

- **Screenshots and art:** `npm run store-art` writes each store's screenshots and art to `dist/store/`, made from the
  extension on the site's sample page ([docs/store/extension-listings.md](../../docs/store/extension-listings.md) says
  which are taken by hand).
- **Safari's app for the Mac App Store:** `APPLE_TEAM_ID=<team> node tools/build-extension.mjs --safari-release`
  archives it, signed by that team, to `dist/Pipeup.xcarchive`; upload it from Xcode's Organizer. The app's own window
  is kept in `safari/` (`PIPEUP_BUILD_NUMBER` sets the build number).
