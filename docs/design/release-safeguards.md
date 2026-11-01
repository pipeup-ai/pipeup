# Release safeguards

The 0.9.0 release stopped part way: the core and ten add-ons were published, but `@pipeup/inline` (new) couldn't
be, so the mailbox, the GitHub Release and the site waited until it was published by hand. Its signed update list
also gave the wrong hash, made from a stale local build. These changes make each of those fail before anything is
published, or never happen.

## What changed

- **One list of add-ons.** `tools/addons.mjs` reads the published add-ons from the workspaces in
  `libs/ts/addons/package.json` (packages that aren't private and are named `@pipeup/<folder>`). The release
  workflow, `tools/set-version.sh`, `libs/ts/addons/scripts/sri.mjs`, `apps/site/build.sh` and
  `apps/site/inject-sri.py` read it instead of keeping their own lists. Two places can't read it at run time (the
  site's SRI map in `apps/site/addons.js`, filled at build time, and the Add-ons page's cards); `--check` compares them
  with the list and runs first in the add-ons' `npm run check`, so CI fails when one is missing an add-on.
- **Every package exists before anything is published.** A release step runs `npm view <name>` for the core, each
  add-on and the mailbox, and stops with what to do if one has never been published. npm's trusted publishing can't
  create a package, so before this a new package failed mid-publish.
- **A new package's name, put on npm early.** `tools/first-publish.sh <add-on>` publishes an empty `0.0.0`
  placeholder under the dist-tag `placeholder` and prints where to add the trusted publisher. Run when the add-on is
  created, it keeps release day free of a hand publish; the first release publishes the real package as `latest`.
- **The update list matches the build.** For a stable release, a step compares `apps/site/updates.json`'s entry for
  the version with the hash of the `dist/pipeup.min.js` the workflow just built, before publishing. The smoke check
  also confirms the live list (added the day before).

## Not changed

- The order of publishing. npm has no transaction, so a release can still stop part way for other reasons (npm down);
  re-running with `gh workflow run release.yml -f tag=vX.Y.Z` still skips what is published.

## Change log

- 2026-11-01 — Written: one list of add-ons, the two checks before publishing, and `tools/first-publish.sh`.
