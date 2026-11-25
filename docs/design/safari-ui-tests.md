# Driving Safari: the first-run test

Status: **built** (2026-11-23; see the change log).

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

## Keeping Safari as it was

The test runs in the person's own Safari, so it must leave no trace but its screenshots. One run left Safari's toolbar
without its address field, most likely a key or click that landed on the toolbar while the person was using another
app. Three guards:

- Pages open through the system (LaunchServices), never by typing an address, so nothing is typed into Safari's
  toolbar at all.
- Keys (the comment, Return, Escape) go out only while Safari is the app in front; otherwise the test fails and sends
  none, so a person working in another app never receives them.
- The test checks the address field before and after, and fails with the repair if it has gone.

The repair, `tools/safari-toolbar-reset.command`, quits Safari, forgets every saved toolbar layout and opens it again.
It is opened in the Terminal app (`open -a Terminal tools/safari-toolbar-reset.command`) because macOS lets Terminal
read Safari's settings where a shell inside another app is refused.

## Not in this change

- The rest of the hand checklist in Safari. The scaffold takes more tests the same way.
- Running it in CI: it needs a signed-in Mac with Safari and the extension on.

## Change log

- 2026-11-23 — First version: the scaffold and the first-run test.
- 2026-11-23 — The menu's rows renamed with the one-menu change (docs/design/one-menu.md): the count is read from Your comments on this page.
- 2026-11-23 — Pages open through LaunchServices rather than typed; keys only while Safari is in front; the address
  field is checked before and after; `tools/safari-toolbar-reset.command` repairs the toolbar.
