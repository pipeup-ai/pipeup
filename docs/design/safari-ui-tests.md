# Driving Safari: the first-run test

Until now nothing could drive Safari with an extension in it: Playwright's WebKit loads no extensions, and the hand
checklist ([extension-checklist.md](../testing/extension-checklist.md)) was Safari's only check. Apple's own UI testing
(XCUITest) can drive Safari, though: a test bundle with no app of its own launches Safari by bundle identifier and
presses what a person would press. This note covers one such test, the newcomer's first run, and the scaffold it sits
in.

## What the test does

As someone who has never commented on a web page:

1. Opens a new Safari window at the sample page (`extension-test.html`, served locally).
2. Presses **Pipeup** in the toolbar. If Safari asks for the site first, allows it for one day.
3. Presses **Comment on this page**.
4. Clicks the first paragraph, types one sentence and presses Return.
5. Opens the toolbar menu again and checks that **Your comments on this page** counts one.

It saves a screenshot of the screen after each step (`apps/extension/dist/safari-ui-test/NN-step.png`), and, when a
step can't find what it expects, Safari's accessibility tree beside it (`NN-step.txt`), so the step can be read without
re-running.

## Where it lives

- `apps/extension/safari/ui-tests/`: a small Xcode project with one UI-testing bundle and no host app, kept in source
  control rather than generated, so the converter's project (`dist/safari-app`) stays untouched.
- `tools/safari-ui-test.mjs` (`npm run safari-test` in apps/extension): serves the site, runs the test with
  `xcodebuild test`, and prints where the screenshots are.

## What it needs

- The app installed with `npm run safari-install` (`tools/safari-install.mjs`) and ticked once in Safari → Settings →
  Extensions. The installer builds signed by the Mac's Apple Development certificate (`APPLE_TEAM_ID` in `.env.local`),
  with a fresh build number as the manifest version's fourth part, forgets other copies of the app the Mac knows,
  quits the old app, installs the one copy at `apps/extension/dist/Pipeup.app`, launches it and checks Safari would
  see exactly one Pipeup. The test checks the same before it starts, and says what to do when the button is missing.

## How this went wrong, and what each rule is for

A day (24 to 25 November 2026) went on a toolbar button that would not appear, with the extension listed as on:

- **Unsigned builds.** An ad hoc signed extension is turned off by Safari at every start until Develop → Allow
  Unsigned Extensions is on again, and the Extensions list and the app's own state query both still say on. Every
  Safari restart, including the toolbar reset, turned it off again. Hence: signed, always.
- **Several copies, one bundle id.** Two Xcode archives and some scratch builds were all `ai.pipeup.Pipeup`; Safari
  listed three Pipeups and the system elected one at random. Hence: one copy, in one place, and the installer forgets
  the rest.
- **Replacing the app in place.** Each swap under the same path made Safari untick the extension, and `open` on the new
  copy only woke the old running process, so Safari never saw the new one. Hence: quit, replace, launch, verify the
  process path.
- **Cached files.** Same version, same path: Safari served the previous extension's menu with the new files on disk.
  Hence: the build number in the version.
- **A build from the wrong branch.** Two installs took the build tool from a branch without main's Safari permission
  line, so the press was lost again. Hence: CI checks the Safari manifest asks for every website.
- The site built (`apps/site/build.sh`), for the sample page.
- Once: macOS asks whether the test runner may control the computer (Accessibility). Allow it; the test then runs
  unattended.

## Not in this change

- The rest of the hand checklist in Safari. The scaffold takes more tests the same way.
- Running it in CI: it needs a signed-in Mac with Safari and the extension on.

## Change log

- 2026-11-23 — First version: the scaffold and the first-run test.
- 2026-11-23 — The menu's rows renamed with the one-menu change (docs/design/one-menu.md): the count is read from Your comments on this page.
- 2026-11-25 — npm run safari-install, the test's pre-checks and plain failure, the CI check on the Safari manifest, and the list of what went wrong and why each rule exists.
