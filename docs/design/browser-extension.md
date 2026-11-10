# Pipeup for browsers (extension)

Status: **built for local testing in Chrome, Firefox and Safari (Mac)**; stores to come. Visual spec: [browser-extension.html](browser-extension.html). Functional requirements:
[EXTENSION_SPEC.md](../EXTENSION_SPEC.md). Targets `next`.

## Shape

- **One WebExtension (Manifest V3)** in `apps/extension/`, packed by `tools/build-extension.mjs` from the release's own
  `dist/` files into `dist/extension/{chromium,firefox}.zip` (Safari uses the Chromium zip's contents).
- **Permissions:** `activeTab`, `scripting`, `storage`. `optional_host_permissions: ["<all_urls>"]`, requested per
  site only when the reviewer turns on "Always on for this site" (then a registered content script for that origin).
  No host access at install, so no "read and change all your data" warning and quicker reviews.
- **Manifest differences:** `background` lists both `service_worker` (Chromium, Safari) and `scripts` (Firefox, which
  runs it as an event page); each browser ignores the key it doesn't use (Chrome 121+, Firefox 121+).
  `browser_specific_settings.gecko` holds Firefox's id and `gecko_android` its Android flag. `version` is the release's
  `X.Y.Z`; `version_name` is the same.
- **Commands:** `_execute_action` bound to Shift+Alt+P (Shift+Alt+C is Pipeup's own comment-mode shortcut).

## Injecting Pipeup

- The toolbar press runs `scripting.executeScript` in the tab's **isolated world**: first a probe for a page-owned
  Pipeup (`<pipeup-root>` in the DOM, or `script[src*="pipeup"]`), then the bundled `pipeup.min.js`, the chosen add-ons
  and a small `start.js` that calls `Pipeup.mount({ store, doc })`.
- The isolated world keeps the extension's copy out of reach of the page's scripts, and the page's CSP doesn't apply to
  injected files. Pipeup uses no custom element registration (unavailable in Chrome's isolated world); `<pipeup-root>`
  with `attachShadow` works there as is.
- Blocked pages (browser pages, store pages, built-in PDF viewer) make `executeScript` fail; the popup shows "can't run".

## Storage

- `mount({ store })` already takes an `OpStore`. A new `ExtensionStore` keeps ops in `chrome.storage.local` (with the
  `unlimitedStorage` permission) via the background, keyed by `doc` = the page's address without its hash.
- Pipeup's per-site preferences (look, Hide comments, first-hold hint) live in the page origin's `localStorage` today.
  In the extension they should follow the same store, so the extension writes nothing into the site's storage: a small
  `prefs` hook on `mount`, part of this work.
- "Comments you've made" is an extension page reading the index of `doc`s from storage.

## Release

- `release.yml` gains a job after the npm publish: build the extension from the same `dist/`, check that the
  `pipeup.min.js` inside the zip has the release's SRI hash, then publish:
  - Chrome Web Store API v2 (upload, publish; staged publish available).
  - Edge Add-ons API.
  - `web-ext sign --channel=listed` for AMO, with a source zip and build instructions (AMO requires source for minified
    files).
  - Safari: macOS runner, `safari-web-extension-packager` (or `xcrun safari-web-extension-converter`), archive, upload
    to App Store Connect with an API key, submit for review. Apple's web packager may replace the Mac step later.
- Store keys live in a `stores` GitHub environment. A "Check every store can be published" step runs before any publish,
  as the npm check does.
- `tools/smoke-release.sh` reports each store's live version: "live" when it matches, "waiting for review" otherwise
  (not a failure).
- First listing in each store is made by hand once (listing text, icons, screenshots, privacy answers); documented in
  `docs/RELEASE.md`.
- Pre-releases: not in stores at first. Later: unlisted "Pipeup Next" (Chrome), self-hosted signed XPI (Firefox),
  TestFlight (Safari), versioned `X.Y.Z.N`.

## Tests

- Playwright can load an unpacked extension in Chromium (`launchPersistentContext` with `--load-extension`): press the
  action, check Pipeup mounts, survives reload with "Always on", steps aside on a page with Pipeup built in, keeps
  comments out of the page origin's storage.
- `web-ext lint` for Firefox in `npm run check`.

## Decided (2026-11-09)

- Comments are kept by the extension, by page address (`ExtensionStore` above).
- A page's scripts can't reach the extension's Pipeup (isolated world; no `window.Pipeup` bridge).
- Chrome, Edge and Firefox first; Safari after an Apple Developer account and the Mac release step exist.
- Stable releases only in stores at first.

## As built (2026-11-09)

- `apps/extension/src` is plain JavaScript (no build step of its own); `tools/build-extension.mjs` copies it with
  `pipeup.esm.js` unchanged and draws the icons. `pipeup.min.js` mounts itself on load, so the extension imports the ESM
  file from `start.js` instead (listed in `web_accessible_resources`, so a page could tell the extension is installed).
- **Identity:** Pipeup's own identity is a non-extractable key that only IndexedDB can keep, and `chrome.storage` holds
  only JSON. So the extension's store keeps a 32-byte seed and makes the Ed25519 key from it, as the identity add-on
  does. The seed is readable only by the extension, never by the page. One identity on every site.
- **Comments:** `chrome.storage.local`, one key per document (`doc:<id>`, the ops) and one per page (`page:<id>`: its
  address, title and last change, for Comments you've made). Writes in a tab are queued and merge into what is stored,
  so a second tab's ops aren't lost; two tabs writing at the same instant can still race (to fix with per-op keys).
- **Choices:** a new `prefs` option on `mount` (a `getItem`/`setItem`/`removeItem` object, read as Pipeup starts), so
  look, Hide comments and the first-hold hint go to `prefs:<origin>` in the extension, not the site's localStorage.
- **Built in:** a `<pipeup-root>` the extension didn't add, or a script whose address contains "pipeup", means the page
  has its own.
- **Tests:** Playwright loads `dist/chromium-test` (the build plus `host_permissions` for the test server, made with
  `--test`) in Chromium. Always on isn't tested: it needs the browser's permission prompt.
- **The toolbar is the way in** (docs/design/extension-on-page.html): `start.js` mounts with `control: "off"` unless
  `settings.showButton`; the panel's rows call `setCommentMode`, `openAllComments` and `openMenu` through
  `executeScript` with a fixed list of actions (Manifest V3 allows no eval in content scripts); `pu.on("change")` and
  the document's changes send `{ n, commenting }` to the worker, which sets the badge (green, "on" when 0, while
  commenting). The setting lives on the extension's page (`comments.html`, also its options page).
- **Pipeup in the browser** (docs/design/extension-native-ui.html): `start.js` mounts with `ui: "host"`. Pipeup then
  draws only highlights, pins and comment mode (`viewsFor` keeps the bubbles without popovers), and `open`/`pick` go to
  the host instead of opening a thread or a draft. `start.js` relays them, and a snapshot of the threads on every
  change, with `runtime.sendMessage`; the side panel (`panel.*`) answers with `tabs.sendMessage` asks (`comment`,
  `reply`, `edit`, `remove`, `resolve`, `reopen`, `react`, `go`), done through `pu.document`. Chrome opens the side panel
  only in answer to a press in the extension, so the toolbar panel opens it with Comment on this page, Start commenting
  and Comments; a pick while it's closed is kept in `storage.session` for when it opens. The toolbar panel draws the
  menu from the instance (`name`, `look`, `hidden`, `commentMode`) and `commentsAs()` for Copy comments.
- **Write where you point; pin or not** (docs/design/extension-pin.html): the side panel can't take focus from the page,
  so `ui: "host"` now leaves the comment box on the page (Pipeup's bubbles view, popovers on) and only threads go to the
  host (`on("open")`, also after a comment is sent); `pick` is gone. `start.js` mounts one of three ways from
  `settings`: `popovers` (`control: "off"`, `layout: "bubbles"`, the default), `pinned` (`ui: "host"`) or `button`
  (plain Pipeup), and starts again the new way when the setting changes, keeping comment mode. The side panel always
  lists the comments; its pin writes `settings.pinned`, unpinning closes it (`window.close()`), and closing it unpins
  (`pagehide`).
- **Integrations** (2026-11-09):
  - Right-click: `contextMenus` "Comment with Pipeup" (selection, image, link, page). The click grants `activeTab`;
    the worker injects `start.js`, waits for Pipeup, then asks `commentOn` with the selection flag, `srcUrl` or
    `linkUrl`. `start.js` finds the element (an image by `currentSrc`/`src`, a link by `href`) or uses the last
    `contextmenu` target it saw, and calls Pipeup's new `startComment()`.
  - Single-page apps: `start.js` checks `origin + pathname` every 600 ms and starts Pipeup again on a new address (no
    `webNavigation`, which would ask to "read your browsing history").
  - Local pages: one registered content script, `always local`, for `http://localhost/*`, `127.0.0.1` and `[::1]`.
  - Pictures: `start.js` sends the new thread's box after the reviewer's own create; the worker uses
    `captureVisibleTab` (allowed after a press, by `activeTab`), crops with `OffscreenCanvas`, fades outside the box,
    rings it, and keeps a JPEG data URL as `shot:<thread>`. The side panel shows it on lost threads. Settings can turn
    pictures off, which deletes them.
  - Save comments: a download from the toolbar panel (`commentsAs("ai")`, `document.exportFile()`); no `downloads`
    permission.
  - Send to my agent: `nativeMessaging` to `ai.pipeup.browser`, a host in the `pipeup` package
    (`cli/browser-host.mjs`, launched by `~/.pipeup/browser-host.sh` with Node's absolute path). Pages are kept in
    `~/.pipeup/browser/<doc>/` (`page.json`, `comments.md`, `comments.json`, `replies.json`); replies are pasted with
    `document.paste()` once each (`agentReplies:<doc>` remembers which).
  - Add-ons: their ESM files are imported in the content script and registered with `Pipeup.use()` before Pipeup
    starts; `globalThis.Pipeup` lets them read settings, and `mount({ settings })` gives `data-pipeup-share` and
    `data-pipeup-github-repo` from the extension's settings. Save to GitHub needs no sign-in (it opens GitHub's own
    new-issue page), so item 7 needed no OAuth.
  - The side panel hears when a comment's place changes (checked every 1.5 s), not only when comments change.
- **Firefox and Safari:**
  - The build writes one folder per browser from the same source: `dist/chromium` (no `sidebar_action` or
    `browser_specific_settings`; `background.service_worker`), `dist/firefox` (no `side_panel` or `sidePanel`;
    `background.scripts` as an event page; `gecko.data_collection_permissions`; Firefox 140+) and `dist/safari` (no side panel, sidebar or `nativeMessaging`; a service worker without
    `type`, since Safari takes none). Everything uses `chrome.*`, which all three answer to.
  - `src/browser.js` holds what differs at run time: the panel beside the page (`chrome.sidePanel`, or Firefox's
    `browser.sidebarAction`, opened and closed in answer to a press; neither in Safari, so the pin isn't offered), and
    Send to my agent (not in Safari, which lets an extension talk only to the app it comes in; its setup command names
    Firefox there, whose extension id is the same everywhere: `pipeup browser install --browser firefox` writes
    Mozilla's host file with `allowed_extensions`).
  - Safari: `--safari` runs `xcrun safari-web-extension-converter` (macOS only, `ai.pipeup.Pipeup`) into
    `dist/safari-app` and `xcodebuild` with an ad-hoc signature, for Safari's Allow Unsigned Extensions. The Xcode
    project is generated, not kept.
  - Tests: `web-ext lint` on the Firefox build, and `e2e/firefox.spec.ts` in a released Firefox (`npm run firefox`)
    driven by Puppeteer over WebDriver BiDi, with `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS` so it can open the extension's pages
    and a fixed `moz-extension://` id. One Firefox per run, its storage cleared per test: macOS hands a second Firefox
    started straight after to the first. Playwright's own Firefox can't add extensions and can't open tabs over BiDi.
    Safari isn't driven: safaridriver has no extensions.
- **Icons** (`tools/extension-icons.mjs`): the bubble alone everywhere, no plus and no background. Where it's listed (the
  extensions page, stores, Safari's settings, the toolbar panel's header) it's violet, a little lighter than the accent
  so it reads on dark pages too, inside the stores' padding. The toolbar button's bubble is as large as the button allows: Chrome's own greys, dark for
  light toolbars and light for dark ones. The background can't see the browser's look, so the extension's pages and
  Pipeup in tabs say it (`prefers-color-scheme`) and `action.setIcon` follows; the last look is kept for the next start.
  Firefox also gets `theme_icons`; Safari gets one black bubble, which it takes as a template and tints.
- **Ready for the stores** (2026-11-10, after checking the store drafts against the code, docs/store/):
  - Pipeup's UI is in a closed shadow root (`mount({ closed: true })`), so the page's scripts can't read comments,
    names or a recovery code; the tests' build opens it (`--test` swaps `const closed = true;` in `start.js`).
  - Add-ons' choices are kept by the extension (`mount({ keep })` → `host.keep`, `addon:<id>:<key>` in
    `chrome.storage.local`): Live's consent, Share's, Voice's and Assist's settings, Emoji's recent emoji and skin tone.
    Pipeup no longer asks the site's storage to persist when a host gives the store.
  - Each browser's package says what it holds (`build.json`): Firefox without Voice; Safari without Share, Live or
    pictures. The settings page offers only those add-ons. A missing add-on fails the build.
  - Firefox declares what it may send (`data_collection_permissions`: required none; optional websiteContent,
    browsingActivity, personalCommunications, personallyIdentifyingInfo; Firefox 140+) and asks
    (`permissions.request({ data_collection })`, `browser.js agreeToSend`) before Share, Live or Save to GitHub is
    turned on and before Send to my agent sends. The automated Firefox can't answer the question, so the tests see it
    declined; the prompt itself is checked by hand.
  - Send to my agent: the setup command names the release (`pipeup@<version>`) and the browser (`--browser edge`,
    `--browser brave`); not offered on Windows; replies are asked for only once it has been used.
  - Deleting a comment (its first comment) deletes its picture.
- **Not yet:** reactions and @mentions in the side panel, add-ons' rows in the menu, the release job and store status,
  Send to my agent in Safari (it needs the app to carry the messages), Firefox on Android, Safari on iPhone and iPad.

## Change log

- 2026-11-09 — Proposed.
- 2026-11-09 — The maintainer agreed the four recommendations; spec written (EXTENSION_SPEC.md).
- 2026-11-09 — Built for local testing in Chrome; see As built.
- 2026-11-09 — The toolbar is the way in: the corner button hidden by default, the panel's new rows, comment mode on the badge.
- 2026-11-09 — Pipeup in the browser: the menu in the toolbar panel, the comments in the side panel, `ui: "host"` in Pipeup.
- 2026-11-09 — The comment box on the page; pinned or popovers.
- 2026-11-09 — Integrations: right-click, single-page apps, local pages, pictures, saving, Send to my agent, add-ons.
- 2026-11-10 — Firefox and Safari (Mac) builds, `browser.js`, Firefox tests; see As built.
- 2026-11-10 — The toolbar button's icon: the bubble alone, following the browser's look; the listed icon, the violet bubble.
- 2026-11-10 — Ready for the stores: closed UI root, add-ons' choices in the extension, per-browser packages, Firefox's data consent, Send to my agent's command per browser and release; see As built.
