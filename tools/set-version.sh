#!/usr/bin/env bash
# Sets Pipeup's version everywhere it is pinned, so a release can't miss one:
# package.json and package-lock.json (the core, the add-ons and the mailbox), VERSION in src/core.ts, the pinned
# CDN addresses (pipeup@X.Y.Z, @pipeup/share@X.Y.Z) and the alpha status line in the READMEs, the skills and llms.txt.
# The CHANGELOG is written by hand.
#
#   tools/set-version.sh 0.4.0-beta.1
set -euo pipefail

version="${1:?usage: tools/set-version.sh X.Y.Z[-pre.N]}"
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "not a version: $version" >&2; exit 2; }

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lib="$root/libs/ts/pipeup"
semver='[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?'

(cd "$lib" && npm version "$version" --no-git-tag-version --allow-same-version >/dev/null)
# The add-ons, their workspace and the mailbox server are released with the core, at the same version. `npm pkg
# set` edits package.json only: `npm version` inside a workspace resolves the whole tree and fails on peer ranges
# that don't yet match.
addons="$root/libs/ts/addons"
for dir in "$addons" "$addons/kit" "$addons/test" "$addons/share" "$addons/voice" "$addons/live" "$addons/assist" "$root/services/mailbox"; do
  (cd "$dir" && npm pkg set "version=$version" >/dev/null)
done
for id in share voice live assist; do (cd "$addons/$id" && npm pkg set "peerDependencies.pipeup=$version" >/dev/null); done
(cd "$addons" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)

sed -i.bak -E "s/^export const VERSION = \"$semver\";/export const VERSION = \"$version\";/" "$lib/src/core.ts"

pinned=(README.md libs/ts/pipeup/README.md apps/agent-skills/README.md
  apps/agent-skills/pipeup-integrate/SKILL.md apps/site/llms.txt apps/site/index.html apps/site/index.html.md apps/site/addons.html apps/site/addons.html.md apps/site/walk.js apps/site/add-comments.html.md apps/site/create-html.html.md)
for f in "${pinned[@]}"; do
  sed -i.bak -E "s#pipeup@$semver/#pipeup@$version/#g; s#(@pipeup/[a-z]+)@$semver/#\1@$version/#g; s#([Aa]lpha) \($semver\)#\1 ($version)#g; s#(ADDONS_VERSION = \")$semver\"#\1$version\"#g" "$root/$f"
done
rm -f "$lib/src/core.ts.bak"
for f in "${pinned[@]}"; do rm -f "$root/$f.bak"; done

grep -q "export const VERSION = \"$version\";" "$lib/src/core.ts" || { echo "VERSION in src/core.ts not updated" >&2; exit 1; }
echo "Pipeup version set to $version:"
git -C "$root" diff --stat -- . | sed 's/^/  /'
echo "Next: add a \"## [$version]\" section to CHANGELOG.md."
