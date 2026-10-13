# Pre-releases: the `next` channel

Status: **built** (2026-10-06). The process is in [RELEASE.md](../RELEASE.md).


> **Since 2026-10-07** the project is developed on GitHub only and the sync script is retired: `next`
> is a normal branch that takes pull requests, betas are tagged on it, and promotion merges it into
> `main` through a release pull request ([RELEASE.md](../RELEASE.md)). The sections on the sync script
> below record how it worked before.

## Why

Pipeup is public (0.3.x on npm, the site on GitHub Pages). Before a milestone such as 0.4 goes to
everyone, it should be tried for real: installed from npm, loaded from the CDN with its integrity
hash, and used on the published site and Try pages. Today every release goes straight to `latest`
and replaces the live site, so the only way to test a release is to ship it.

A pre-release must:

- leave `npm i pipeup`, the stable site and the stable CDN address untouched;
- be installable and loadable exactly as a stable release is (npm, jsDelivr, unpkg, SRI);
- have its own copy of the site, Try pages, `llms.txt` and skills, clearly marked as a pre-release;
- be promotable to stable without rebuilding anything by hand;
- be checked by a script, not by memory.

## The two channels

| | Stable | Pre-release |
|---|---|---|
| Version | `0.4.0` | `0.4.0-beta.1`, `0.4.0-beta.2`, … |
| npm dist-tag | `latest` | `next` |
| Public repo branch | `main` | `next` |
| Git tag | `v0.4.0` | `v0.4.0-beta.1` |
| GitHub Release | normal | marked *Pre-release* |
| Site | `https://pipeup-ai.github.io/pipeup/` | `https://pipeup-ai.github.io/pipeup/next/` |
| CDN | `pipeup@0.4.0` | `pipeup@0.4.0-beta.1` (or `pipeup@next`) |

A version with a hyphen is a pre-release everywhere: the release workflow, the sync script, the site
build and the smoke test all decide from the version alone.

## What already works

`release.yml` publishes a hyphenated version under the npm `next` tag and creates the GitHub Release
with `--prerelease`. CI runs on every branch. jsDelivr and unpkg serve any published version. Nothing
here changes for pre-releases.

## Changes

### 1. One command sets the version

`tools/set-version.sh <version>`
writes the version everywhere it is pinned, so a release can't miss one:

- `libs/ts/pipeup/package.json` and `package-lock.json` (via `npm version --no-git-tag-version`);
- `VERSION` in `libs/ts/pipeup/src/core.ts` (the size check already fails if it differs);
- the pinned CDN addresses `pipeup@X.Y.Z` in `README.md`, `libs/ts/pipeup/README.md`,
  `apps/agent-skills/README.md`, `apps/agent-skills/pipeup-integrate/SKILL.md` and
  `apps/site/llms.txt`;
- the alpha status line in both READMEs.

It does not touch the CHANGELOG (written by hand) or historical "done in 0.3.0" notes.

### 2. The sync script gets a channel

`sync-github.sh` stays the only way content reaches GitHub. It reads the version and chooses the
public branch from it: a pre-release commits to `next`, anything else to `main`. There is no
`--channel` flag, so a beta can't be synced to `main` by mistake. Local `main` and `next` in the
working copy must match GitHub's before a sync. Versions are compared with `tools/version-newer.mjs`
(semver precedence), which the Pages workflow uses too.

On `next`:

- If the public `next` branch doesn't exist, or its version is not newer than `main`'s (a finished
  pre-release cycle), the script starts `next` afresh from `main`. That replaces the old `next`, so
  the printed push command uses `--force-with-lease` for that branch only.
- Otherwise it adds one commit to `next`, as on `main`.
- Commit message `Pre-release vX.Y.Z-beta.N`; the tag is pushed the same way as today.

Stable syncs are unchanged. `next` is never merged into `main` on GitHub: promotion is a normal
stable sync from the private repo, which already holds the same code.

### 3. The site is built per channel and deployed after a release

`apps/site/build.sh --channel next` builds the same site with three differences, applied to the
built files only (the sources stay channel-free):

- every absolute `https://pipeup-ai.github.io/pipeup/` becomes `https://pipeup-ai.github.io/pipeup/next/`
  (in `llms.txt`, `llms-full.txt`, `index.html.md` and the skills; the page and Try pages already
  derive addresses from their own location);
- a slim bar at the top of the home page and in the Try bar: "Pre-release 0.4.0-beta.1 — for testing.
  The stable version is 0.3.1 →" linking to the stable site;
- `<meta name="robots" content="noindex">` on every page, so search engines index only stable.

The Pages workflow builds both channels into one deployment:

1. Check out `main` and build it into `_site/`.
2. If the `next` branch exists and its version is newer than `main`'s (semver, so
   `0.4.0-beta.3` < `0.4.0`), check it out and build it into `_site/next/` with `--channel next`.
3. Otherwise write `_site/next/index.html` as a short page that redirects to the stable site.
4. Upload and deploy.

When it runs: after the **Release workflow succeeds** (`workflow_run`), and by hand
(`workflow_dispatch`). It no longer runs on every push to `main`. This fixes two things:

- the site only ever shows a version npm and the CDN already have (today a push to `main` can deploy
  CDN addresses a few minutes before npm has that version);
- `workflow_run` and `workflow_dispatch` run on the default branch, which GitHub's `github-pages`
  environment allows, so `next` never needs deploy rights (a branch deploy is refused, as seen on
  2026-10-06).

A site-only fix between releases is deployed by running the workflow by hand.

### 4. A smoke test after every release

`tools/smoke-release.sh <version>` checks, from the outside, that a
release landed. It waits for npm (the registry can lag a minute or two) and then checks:

- npm: the version exists, the dist-tag (`latest` or `next`) points at it, and it has a provenance
  attestation;
- GitHub: the Release `vX.Y.Z` exists, is or isn't marked Pre-release to match, and its notes give
  the SRI hash;
- CDN: it purges jsDelivr's cache for the file first (a check before publishing caches "not found"),
  then confirms jsDelivr and unpkg both serve a `dist/pipeup.min.js` whose sha384 equals the SRI in
  the notes and the npm tarball's;
- site: the channel's home page, the three Try pages, `llms.txt`, `llms-full.txt` and a skill return
  200; `llms.txt` pins this version; on `/next/`, the pre-release bar names this version; for a
  stable release, `/next/` redirects.

It prints one line per check and exits non-zero on the first failure. It changes nothing except the
jsDelivr cache purge.

### 5. Tidy-ups on promotion

When `0.4.0` ships, npm's `next` tag still points at the last beta. The release process moves it with
`npm dist-tag add pipeup@0.4.0 next` (run by a maintainer; the trusted publisher may only publish).
Pages redirects `/next/` automatically because `next` is no longer newer than `main`.

## Testing this design

Once built, the whole path is tried with `0.4.0-beta.0` cut from today's `main` (no library change):
sync to `next`, tag, watch the release and Pages runs, run the smoke test, open `/next/` and its Try
pages, `npm i pipeup@next` in a blank page, and confirm `npm i pipeup`, the stable site and its
`llms.txt` still say 0.3.1. That beta is left as is; 0.4.0 supersedes it.

## Not doing

- A separate repo or host for pre-release sites: one repo, one Pages site, one set of links.
- Alpha/RC naming: `-beta.N` only, until there is a reason for more.
- Automatic promotion: a person decides when a beta becomes stable.

---

## Change log

- 2026-10-06 — First version: `next` channel (npm `next`, public `next` branch, `/next/` site), one
  version command, Pages deployed after a release, smoke-test script.
- 2026-10-06 — Built. `apps/site/channel.py` applies the pre-release changes to the built site.
- 2026-10-07 — GitHub only: the sync script is retired; `next` takes pull requests and betas are tagged on it.
