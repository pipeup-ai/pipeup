# Pipeup for browsers (extension)

Status: **agreed, not built**. Visual spec: [browser-extension.html](browser-extension.html). Functional requirements:
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

## Change log

- 2026-11-09 — Proposed.
- 2026-11-09 — The maintainer agreed the four recommendations; spec written (EXTENSION_SPEC.md).
