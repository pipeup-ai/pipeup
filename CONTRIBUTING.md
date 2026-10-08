# Contributing to Pipeup

Thanks for helping. Pipeup is alpha, so open an issue to discuss anything larger than a bug fix
before you spend time on it.

## Build and test

The library lives in `libs/ts/pipeup` and needs Node 20 or later. The add-ons (`libs/ts/addons`) and the mailbox
server (`services/mailbox`) need Node 22 or later.

```sh
cd libs/ts/pipeup
npm ci
npx playwright install chromium
npm run check
```

| Command | Does |
|---|---|
| `npm run check` | Types, lint, unit tests, build, size budget and browser tests |
| `npm test` | Unit tests only |
| `npm run e2e` | Browser tests (run `npm run build` first) |
| `npm run format` | Format with Prettier |

The add-ons are written against the core's types and built into combined files with its classic build, so build
the core first:

```sh
cd libs/ts/pipeup && npm run build
cd ../addons && npm ci && npm run check      # types, lint, unit tests, builds, size budgets, browser tests
cd ../../../services/mailbox && npm test     # the mailbox server and its checker
```

Build the website with `apps/site/build.sh`, then serve `apps/site/_site` with any static server
(for example `python3 -m http.server --directory apps/site/_site`).

## Pull requests

- Bug fixes and website changes for the current version go into `main`; work for the next milestone
  goes into `next` ([RELEASE.md](docs/RELEASE.md)).
- `npm run check` must be green (in `libs/ts/pipeup`, and in `libs/ts/addons` for add-on changes). CI runs the same commands.
- Keep each pull request to one change, with tests for new behaviour and fixed bugs.
- Say what changed for people using Pipeup; add a line under **Unreleased** in `CHANGELOG.md`.
- Behaviour changes update the functional spec (`docs/FUNCTIONAL_SPEC.md`), which describes what
  Pipeup does, not how.
- Use fictional names in examples and tests (Sam, Ada, Lee…).

## Style

- **No dependencies.** The library and its add-ons have no runtime dependencies: no third-party code
  is bundled in or loaded at run time. Build and test tools are fine as dev dependencies. Every bundle
  stays inside its size budget (`scripts/size.mjs`).
- **Light UI.** Pipeup's UI, the website, diagrams and mock-ups are light mode only.
- **Eased motion.** Nothing appears, moves or disappears abruptly: ease every transition.
- **The page stays the author's.** Never change the host page's DOM or layout; Pipeup's UI lives in
  its own shadow root.
- **Text only.** Comment content is untrusted: render it as text, never as HTML.
- **No telemetry.** No analytics, tracking or network calls.
- Code is formatted by Prettier and linted by ESLint (`npm run lint`).

By contributing you agree that your contributions are licensed under the MIT licence.
