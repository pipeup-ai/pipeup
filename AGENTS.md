# Pipeup — guidance for coding agents

Pipeup is a dependency-free JavaScript library for commenting on any HTML page: documents, slide decks
and whole sites. See [README.md](README.md) for the layout, [docs/FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md)
for what it does, [docs/design/architecture.md](docs/design/architecture.md) for how, and
[CONTRIBUTING.md](CONTRIBUTING.md) for building and testing.

## Rules

- Never mutate the host page's DOM or layout; all UI lives in Pipeup's shadow root.
- Comment content is untrusted: render it as text only, never as HTML.
- No runtime dependencies in `libs/ts/pipeup` or in any add-on (`@pipeup/*`): no third-party code is
  bundled in or loaded at run time. Tools for building and testing are fine as dev dependencies. No
  analytics or telemetry anywhere. The bundle stays inside
  its size budget (`libs/ts/pipeup/scripts/size.mjs`).
- Pipeup's UI, the website, diagrams and mock-ups are light mode only. Every transition eases; nothing
  appears, moves or disappears abruptly.
- Use fictional names (Sam, Ada, Lee…) in code, tests and docs; never real people's names or addresses.

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
