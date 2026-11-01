#!/usr/bin/env bash
# Puts a new package's name on npm once, by hand, so the Release workflow can publish it. npm only lets a workflow's
# trusted publishing publish a package that already exists, so a new add-on would otherwise stop a release part
# way through. Run it when the add-on is created, not on release day: it publishes an empty 0.0.0 placeholder under
# the dist-tag `placeholder` (nothing anyone installs), then says where to add the trusted publisher. The first
# release publishes the real package as `latest`.
#
#   tools/first-publish.sh inline        (an add-on's folder in libs/ts/addons, or "mailbox")
set -euo pipefail

id="${1:?usage: tools/first-publish.sh <add-on folder, or mailbox>}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $id == mailbox ]]; then dir="$root/services/mailbox"; else dir="$root/libs/ts/addons/$id"; fi
[[ -f "$dir/package.json" ]] || { echo "no package at $dir" >&2; exit 2; }
name="$(node -p "require('$dir/package.json').name")"
license="$(node -p "require('$dir/package.json').license || 'MIT'")"

if npm view "$name" name >/dev/null 2>&1; then
  echo "$name is already on npm; nothing to do."
else
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  cat >"$tmp/package.json" <<JSON
{
  "name": "$name",
  "version": "0.0.0",
  "description": "Placeholder: the first Pipeup release that includes this package publishes it.",
  "license": "$license",
  "repository": { "type": "git", "url": "git+https://github.com/pipeup-ai/pipeup.git" }
}
JSON
  printf '# %s\n\nA placeholder. The first Pipeup release that includes this package publishes it.\n' "$name" >"$tmp/README.md"
  echo "Publishing a 0.0.0 placeholder for $name. npm asks you to sign in, or for a code from your authenticator."
  (cd "$tmp" && npm publish --access public --provenance=false --tag placeholder)
fi

echo
echo "Now add the trusted publisher, so releases can publish $name:"
echo "  https://www.npmjs.com/package/$name/access"
echo "  Trusted Publisher → GitHub Actions: organization pipeup-ai, repository pipeup, workflow release.yml"
