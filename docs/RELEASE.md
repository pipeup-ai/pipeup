# Releasing Pipeup

Pipeup is developed in the open here, on GitHub: pull requests, CI, releases and the website all
happen in this repository.

| Where | What |
|---|---|
| GitHub, `github.com/pipeup-ai/pipeup` | The code, its history, issues, pull requests, CI and Releases |
| GitHub Pages, `https://pipeup-ai.github.io/pipeup/` | The website, its Try pages, llms.txt and the agent skills |
| npm, `pipeup` | The package; CDNs (jsDelivr, unpkg) serve it from npm |

**Branches.** `main` is the stable line: bug fixes and website changes for the current version go into
it. `next` holds the next milestone's work and its pre-releases. Every change reaches either through a
pull request with CI green; nobody pushes to them directly. After a stable release, `main` is merged into
`next` so fixes reach the milestone too.

## Versioning

Semantic versioning. Below 1.0, a minor version marks a shipped milestone and the API and stored
format may still change; the README says the project is in alpha until 1.0.

| Version | Milestone |
|---|---|
| 0.1 | Headless core (signed comments, anchoring, storage) |
| 0.2 | First UI (bubbles, column, selection, menu) |
| **0.3.0** | **First public release**: comment mode, pins, one-button control, All comments, animal identities |
| **0.4** | **Slides, hidden views, and the keyboard and screen-reader cursor** (shipped) |
| 0.5 | Touch and the narrow-page drawer |
| 0.6 | The `pipeup` command line (`init`, `check`, `read`, `reply`) |
| 0.7 | Sharing add-ons: share, then voice, then live |
| 1.0 | Stable API and stored format |

- Patch versions (`0.3.1`) fix bugs or release plumbing without changing behaviour people rely on.
- Pre-releases (`0.5.0-beta.1`, `-beta.2`, …) let a milestone be tried for real before it reaches
  everyone. They go to the npm `next` tag and never move `latest`. See
  [the pre-release design](design/prerelease.md).
- Every release has: a `vX.Y.Z` git tag on GitHub, a CHANGELOG entry, a GitHub Release with the
  notes and the script's SRI hash, and an exact version on npm.

## One-time setup (done for 0.3.x)

| Where | Setting |
|---|---|
| npm, `pipeup` → Settings | Trusted publisher: GitHub Actions, `pipeup-ai` / `pipeup` / `release.yml`, allowed to `npm publish` |
| npm, `pipeup` → Settings | Publishing access: require 2FA and disallow tokens that bypass it |
| GitHub, repo → Settings → Pages | Source: GitHub Actions; the `github-pages` environment deploys from `main` only |
| GitHub, repo → Settings → Security | Private vulnerability reporting on |
| GitHub, repo → Secrets | None. Nothing in the release needs a stored secret |

## Releasing a stable version

1. **Prepare, on a release branch** from `main` (for a promotion, from `next`).
   - Set the version everywhere it is pinned with `tools/set-version.sh X.Y.Z`: `package.json`,
     `package-lock.json`, `VERSION` in `src/core.ts`, the `pipeup@X.Y.Z` CDN addresses in both
     READMEs, the agent-skills README, the integrate skill and `apps/site/llms.txt`, and the alpha
     line in both READMEs.
   - Add the CHANGELOG section `## [X.Y.Z] - YYYY-MM-DD` and its compare link at the bottom (fold the
     milestone's pre-release sections into it). The release notes are taken from this section, so the
     release fails without it.
   - Run `npm run check` in `libs/ts/pipeup` (types, lint, unit and browser tests, build, size
     budgets) and build the site with `apps/site/build.sh`.
2. **Open a pull request into `main`**, wait for CI, and merge it.
3. **Tag the merge commit** on `main` and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. The
   Release workflow re-runs the full check, publishes to npm through trusted publishing (with
   provenance), and creates the GitHub Release with the CHANGELOG notes, install lines and SRI hash. If
   the check fails, nothing is published. When it succeeds, the Pages workflow deploys the site, so the
   site never points at a version npm doesn't have yet.
4. **Check it landed:** `tools/smoke-release.sh X.Y.Z` (see *After a release*).
5. **After a promotion**, point npm's `next` tag at the stable version so it doesn't linger on the beta:
   `npm dist-tag add pipeup@X.Y.Z next` (a maintainer, with 2FA). Pages redirects `/next/` to the stable
   site on its own. Merge `main` into `next`.

## Pre-releases

The `next` channel: npm tag `next`, branch `next`, site at `https://pipeup-ai.github.io/pipeup/next/`.
The stable site, `npm i pipeup` and the stable CDN address are untouched
([design](design/prerelease.md)).

1. At the start of a milestone, start `next` afresh from `main` if its last cycle is finished (its version
   is not newer than `main`'s).
2. Feature work goes into `next` through pull requests.
3. To release a beta, open a pull request into `next` that sets version `X.Y.Z-beta.N` with
   `tools/set-version.sh` and adds its CHANGELOG section; merge it.
4. Tag the merge commit on `next` (`vX.Y.Z-beta.N`) and push the tag. The Release workflow publishes to
   npm under `next` and marks the GitHub Release as a pre-release; Pages then rebuilds both channels,
   with the beta at `/next/`.
5. Run `tools/smoke-release.sh X.Y.Z-beta.N`, then test by hand:
   - `/next/` and its Try pages show the pre-release bar with this version, and Pipeup works on them;
   - `npm i pipeup@next` (or `pipeup@X.Y.Z-beta.N`) in a blank page works;
   - the CDN tag with the SRI from the release notes loads;
   - the stable site, its `llms.txt` and `npm view pipeup dist-tags` still show the stable version.
6. Fix problems in `beta.N+1`. Promote with a stable release from `next` (above).

**A stable fix during a pre-release cycle:** branch from `main`, release `X.Y.(Z+1)` as a normal stable
version, then merge `main` into `next`.

## Website-only updates

Site and doc changes for the current stable version ship without a new library version:

1. Merge the change into `main` through a pull request. Nothing is published to npm and the GitHub
   Releases are unchanged; keep library changes out of such a pull request, since the site is built
   from `main` and runs its library.
2. Run the Pages workflow by hand: `gh workflow run pages.yml --ref main`.

## After a release

`tools/smoke-release.sh X.Y.Z` checks all of this from the outside, waiting up to 10 minutes for npm
and the site to catch up, and exits non-zero on any failure. By hand:

- `npm view pipeup dist-tags --prefer-online`: `latest` (or `next`) is the new version, and
  `npm view pipeup@X.Y.Z dist.attestations` shows provenance.
- The GitHub Release exists, with the right Pre-release mark and an SRI hash.
- The sha384 of `https://cdn.jsdelivr.net/npm/pipeup@X.Y.Z/dist/pipeup.min.js` and of the unpkg copy
  equal the SRI in the notes.
- The site's home page, Try pages, `llms.txt` and skills load, and `llms.txt` pins the new version.

## When something goes wrong

| Symptom | Cause and fix |
|---|---|
| Release fails at *Publish to npm* with `EOTP` or `ENEEDAUTH` | The trusted publisher on npm doesn't match (org, repo, workflow file name) or doesn't allow `npm publish`. Fix it on npm, then re-run the failed job: the tag stays the same. |
| Release fails at the tag check | The tag doesn't match `package.json`. Delete the tag on GitHub and locally, fix the version in a pull request, tag again. |
| Release fails at *Release notes* | No CHANGELOG section for the version. |
| npm still shows the old version | The registry lags a minute or two; ask with `--prefer-online`. |
| jsDelivr says "Couldn't find the requested release version" | It cached a miss from before the publish. Purge: `curl https://purge.jsdelivr.net/npm/pipeup@X.Y.Z/dist/pipeup.min.js`. |
| Pages deploy refused for a branch | Only `main` may deploy to `github-pages`. Run the Pages workflow on `main`. |
| Site didn't update after a release | Pages runs after the Release workflow succeeds; if the release failed, so did the deploy. For a site-only fix, run the Pages workflow by hand. |
| `/next/` still shows a beta after the stable release | Pages redirects `/next/` only once `main`'s version is newer than `next`'s; run the Pages workflow by hand if it ran before the stable release. |
| A release went out broken | Never unpublish. Release a fixed patch; if needed, `npm deprecate pipeup@X.Y.Z "…"`. |

## What is public

Everything: the code, docs, designs, tests and history are in this repository. Sample names in code,
tests and docs are fictional; there are no personal names or addresses.

---

## Change log

- 2026-10-06 — First version: GitHub as the public mirror, GitHub Pages site, npm, 0.3.0 as the first
  public release, milestone-based 0.x versioning.
- 2026-10-06 — The sync script stays in the monorepo; it refuses to sync if personal information is found
  and never pushes. Release notes carry the SRI `integrity` value.
- 2026-10-06 — Reworded for a public audience: development happens in the maintainers' private repository and GitHub receives one commit per release.
- 2026-10-06 — npm publishing moved to trusted publishing; no stored npm token.
- 2026-10-06 — Workflows run on Node 24 actions and a pinned `ubuntu-24.04` runner.
- 2026-10-06 — The release process spelled out: one-time setup, stable steps, pre-releases (designed, see `design/prerelease.md`), promotion, fixes during a pre-release cycle, checks after a release and known failures.
- 2026-10-06 — The `next` channel is built: `tools/set-version.sh`, the sync script picks the branch from the version, the site builds per channel, Pages deploys both after a release, `tools/smoke-release.sh`.
- 2026-10-07 — Roadmap renumbered: 0.4 shipped slides, views and keyboard; touch and drawer move to 0.5, the CLI to 0.6, add-ons to 0.7.
- 2026-10-07 — Website-only updates: the sync script's `--site` mode commits to `main` without a tag; the Pages workflow is run by hand.
- 2026-10-07 — GitHub is the project's only home: development, pull requests and releases happen here; the private repository and its sync script are retired. Stable work and website changes go into `main`, milestone work and pre-releases into `next`; releases are tagged on the merged commit.
