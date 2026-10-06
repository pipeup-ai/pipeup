#!/usr/bin/env bash
# Sets Pipeup's version everywhere it is pinned, so a release can't miss one:
# package.json and package-lock.json, VERSION in src/core.ts, the pinned CDN addresses
# (pipeup@X.Y.Z) and the alpha status line in the READMEs, the skills and llms.txt.
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
sed -i.bak -E "s/^export const VERSION = \"$semver\";/export const VERSION = \"$version\";/" "$lib/src/core.ts"

pinned=(README.md libs/ts/pipeup/README.md apps/agent-skills/README.md
  apps/agent-skills/pipeup-integrate/SKILL.md apps/site/llms.txt)
for f in "${pinned[@]}"; do
  sed -i.bak -E "s#pipeup@$semver/#pipeup@$version/#g; s#([Aa]lpha) \($semver\)#\1 ($version)#g" "$root/$f"
done
rm -f "$lib/src/core.ts.bak"
for f in "${pinned[@]}"; do rm -f "$root/$f.bak"; done

grep -q "export const VERSION = \"$version\";" "$lib/src/core.ts" || { echo "VERSION in src/core.ts not updated" >&2; exit 1; }
echo "Pipeup version set to $version:"
git -C "$root" diff --stat -- . | sed 's/^/  /'
echo "Next: add a \"## [$version]\" section to CHANGELOG.md."
