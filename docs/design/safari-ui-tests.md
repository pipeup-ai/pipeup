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

- A Pipeup extension turned on in Safari (any build: the Debug app from `--safari`, with Develop → Allow Unsigned
  Extensions, or the store build). Turning it on is a hand step: Allow Unsigned Extensions asks for a password.
- The site built (`apps/site/build.sh`), for the sample page.
- Once: macOS asks whether the test runner may control the computer (Accessibility). Allow it; the test then runs
  unattended.

## Not in this change

- The rest of the hand checklist in Safari. The scaffold takes more tests the same way.
- Running it in CI: it needs a signed-in Mac with Safari and the extension on.

## Change log

- 2026-11-23 — First version: the scaffold and the first-run test.
- 2026-11-23 — The menu's rows renamed with the one-menu change (docs/design/one-menu.md): the count is read from Your comments on this page.
