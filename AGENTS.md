# Pipeup — guidance for coding agents

Pipeup is a dependency-free JavaScript library for commenting on any HTML page: documents, slide decks
and whole sites. See [README.md](README.md) for the layout, [docs/FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md)
for what it does, [docs/design/architecture.md](docs/design/architecture.md) for how, and
[CONTRIBUTING.md](CONTRIBUTING.md) for building and testing.

## Rules

- Never mutate the host page's DOM or layout; all UI lives in Pipeup's shadow root. Two exceptions: while a page's
  modal `<dialog>` (or an element shown fullscreen) is open, Pipeup's own `<pipeup-root>` moves inside it (otherwise the
  browser makes Pipeup inert, or doesn't show it), and moves back when it closes; and inside an element the author
  marked for an add-on (`data-pipeup-ask` or `data-pipeup-inline`, spec §11b), Pipeup may append one `<pipeup-place>`
  child (whose content lives in its own shadow root), set `data-pipeup-placed` on the marked element, and inject the one
  rule that hides the author's fallback there. All of it is removed when the add-on is turned off. Nothing else in
  the page changes.
- Comment content is untrusted: render it as text only, never as HTML.
- No runtime dependencies in `libs/ts/pipeup` or in any add-on (`@pipeup/*`): no third-party code is
  bundled in or loaded at run time. Tools for building and testing are fine as dev dependencies. No
  analytics or telemetry anywhere. The bundle stays inside
  its size budget (`libs/ts/pipeup/scripts/size.mjs`).
- Pipeup's UI has a light look and a dark look, both complete and tested, and never mixed (spec §9). The
  website, diagrams and mock-ups are light mode only. Every transition eases; nothing appears, moves or
  disappears abruptly.
- Use fictional names (Sam, Ada, Lee…) in code, tests and docs; never real people's names or addresses.

## Driving Safari

The person's Safari is theirs, not a test fixture. A test run once left its toolbar without an address field, and
putting that back cost an afternoon. So:

- Drive Safari only through the project's own UI test (`npm run safari-test` in apps/extension), and only when the
  maintainer asks for a run. Never send clicks or keys to Safari any other way (no AppleScript, no scripted
  events, no computer-use clicks), and never reach into Safari's settings or profile.
- The test never types to reach a page: pages open through the system (LaunchServices). It sends keys only while Safari
  is the app in front, and fails instead when it isn't. It touches nothing in the toolbar but Pipeup's button, and it
  checks the address field is still there before and after.
- Opening Safari's **Customize Toolbar…** from a test is off limits, as is dragging anything in the toolbar.
- If a run does leave Safari changed, say so at once and repair it yourself with
  `open -a Terminal tools/safari-toolbar-reset.command`, which puts the default toolbar back. Don't hand the person a
  list of steps to undo what the tools did.

## Workflow

- **Spec first.** Before coding a change in behaviour, update the functional spec
  ([docs/FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md), or [docs/WEBSITE_SPEC.md](docs/WEBSITE_SPEC.md) for
  the site) and agree it with the maintainer. Specs hold functional requirements only, never
  implementation detail, and keep a change log at the bottom.
- **Design notes** for features being built go in `docs/design/`, also with a change log.
- **Branches and pull requests.** Never push to `main` or `next`: work on a feature branch and open a pull
  request. Bug fixes and website changes for the current version target `main`; work for the next
  milestone targets `next` (see [docs/RELEASE.md](docs/RELEASE.md)).
- **Green before commit.** `npm run check` in `libs/ts/pipeup` (types, lint, unit and browser tests, build,
  size budgets) must pass; fix lint errors rather than silencing them. Commit when a feature is complete.
- **Changelog.** User-visible changes add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
- **Releases** follow [docs/RELEASE.md](docs/RELEASE.md). Tagging and publishing are the maintainer's call.
