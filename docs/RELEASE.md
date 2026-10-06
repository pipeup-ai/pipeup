# Releasing Pipeup

Pipeup is developed in the maintainers' private repository and published here as an open source
project. The private repository is the source of truth; GitHub receives one commit per release, so
this repository's history is the list of releases.

| Where | What |
|---|---|
| The maintainers' private repository | Day-to-day development and full history |
| GitHub, `github.com/pipeup-ai/pipeup` | The public repo: one commit per release, issues, CI, Releases |
| GitHub Pages, `https://pipeup-ai.github.io/pipeup/` | The website, its Try pages, llms.txt and the agent skills |
| npm, `pipeup` | The package; CDNs (jsDelivr, unpkg) serve it from npm |

## Versioning

Semantic versioning. Below 1.0, a minor version marks a shipped milestone and the API and stored
format may still change; the README says the project is in alpha until 1.0.

| Version | Milestone |
|---|---|
| 0.1 | Headless core (signed comments, anchoring, storage) |
| 0.2 | First UI (bubbles, column, selection, menu) |
| **0.3.0** | **First public release**: comment mode, pins, one-button control, All comments, animal identities |
| 0.4 | Slides, narrow-page drawer, keyboard and touch for blocks |
| 0.5 | The `pipeup` command line (`init`, `check`, `read`, `reply`) |
| 0.6+ | Shared rooms (relay) and presence |
| 1.0 | Stable API and stored format |

- Patch versions (`0.3.1`) fix bugs without changing behaviour people rely on.
- Pre-releases, when a milestone needs wider testing first, use `-beta.N` and the npm `next` tag.
- Every release has: a `vX.Y.Z` git tag on GitHub, a CHANGELOG entry, a GitHub Release with the
  notes, an exact version on npm (`latest`), and the script's SRI hash for pinned CDN use.

## Releasing

1. In the private repository, bump the version in the package, add the CHANGELOG entry, run
   `npm run check` and build the site.
2. Merge the change after review.
3. Run the sync script. It copies the public files into a working copy of this repository, commits
   once as the release and tags it. Review the diff, then push.
4. GitHub Actions then: runs the full check, publishes to npm with provenance, deploys the site to
   Pages, and creates the GitHub Release from the CHANGELOG.

npm publishing uses trusted publishing: npm accepts the `release.yml` workflow in
`pipeup-ai/pipeup` by its GitHub identity, so no npm token is stored anywhere.

## What is public

Everything in this repository is the whole project except the maintainers' internal working notes,
implementation plans, exploratory mock-ups and the sync script. Sample names in code, tests and docs
are fictional; there are no personal names or addresses.

---

## Change log

- 2026-10-06 — First version: GitHub as the public mirror, GitHub Pages site, npm, 0.3.0 as the first
  public release, milestone-based 0.x versioning.
- 2026-10-06 — The sync script stays in the monorepo; it refuses to sync if personal information is found
  and never pushes. Release notes carry the SRI `integrity` value.
- 2026-10-06 — Reworded for a public audience: development happens in the maintainers' private repository and GitHub receives one commit per release.
- 2026-10-06 — npm publishing moved to trusted publishing; no stored npm token.
