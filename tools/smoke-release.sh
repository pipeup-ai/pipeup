#!/usr/bin/env bash
# Checks from the outside that a release landed: npm, the GitHub Release, the CDNs and the site.
# It changes nothing except asking jsDelivr to drop a cached copy of the file.
#
#   tools/smoke-release.sh 0.4.0           a stable release (npm latest, the site's root)
#   tools/smoke-release.sh 0.4.0-beta.1    a pre-release (npm next, the site's /next/)
#
# Needs curl, jq, node, npm and openssl. Waits up to 10 minutes for npm and the site to catch up.
set -euo pipefail

version="${1:?usage: tools/smoke-release.sh X.Y.Z[-pre.N]}"
repo="pipeup-ai/pipeup"
stable_site="https://pipeup-ai.github.io/pipeup/"
file="dist/pipeup.min.js"
if [[ $version == *-* ]]; then channel=next site="${stable_site}next/"; else channel=latest site="$stable_site"; fi

failures=0
ok() { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; failures=$((failures + 1)); }
check() { local what="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }
wait_for() { # wait_for DESCRIPTION COMMAND...: retry for up to 10 minutes
  local what="$1"; shift
  for _ in $(seq 1 60); do "$@" >/dev/null 2>&1 && { ok "$what"; return 0; }; sleep 10; done
  bad "$what (gave up after 10 minutes)"
  return 1
}
fetch() { curl -fsSL --retry 2 "$1?smoke=$RANDOM$RANDOM"; } # a fresh query string skips stale caches
sha384() { echo "sha384-$(openssl dgst -sha384 -binary | openssl base64 -A)"; }

echo "Pipeup $version ($channel)"

echo "npm"
npm_has() { [[ "$(npm view "pipeup@$version" version --prefer-online)" == "$version" ]]; }
wait_for "pipeup@$version is published" npm_has
tag_is() { [[ "$(npm view pipeup dist-tags --json --prefer-online | jq -r ".$channel")" == "$version" ]]; }
check "dist-tag $channel → $version" tag_is
check "provenance attestation" test -n "$(npm view "pipeup@$version" dist.attestations.provenance.predicateType --prefer-online)"
if [[ $channel == next ]]; then
  latest="$(npm view pipeup dist-tags.latest --prefer-online)"
  check "latest stays on a stable version ($latest)" test "${latest#*-}" == "$latest"
fi

echo "GitHub Release"
release="$(curl -fsSL "https://api.github.com/repos/$repo/releases/tags/v$version" || true)"
check "v$version exists" test -n "$release"
want_pre="$([[ $channel == next ]] && echo true || echo false)"
check "marked pre-release: $want_pre" test "$(jq -r .prerelease <<<"$release")" == "$want_pre"
sri="$(jq -r .body <<<"$release" | grep -oE 'sha384-[A-Za-z0-9+/=]+' | head -1 || true)"
check "notes give the SRI hash" test -n "$sri"

echo "Integrity of $file"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$(npm view "pipeup@$version" dist.tarball)" | tar xz -C "$tmp"
check "npm tarball matches the notes" test "$(sha384 <"$tmp/package/$file")" == "$sri"
curl -fsS "https://purge.jsdelivr.net/npm/pipeup@$version/$file" >/dev/null || true
jsdelivr_ok() { [[ "$(fetch "https://cdn.jsdelivr.net/npm/pipeup@$version/$file" | sha384)" == "$sri" ]]; }
unpkg_ok() { [[ "$(curl -fsSL "https://unpkg.com/pipeup@$version/$file" | sha384)" == "$sri" ]]; }
wait_for "jsDelivr serves it" jsdelivr_ok
wait_for "unpkg serves it" unpkg_ok

echo "Site $site"
site_pins() { fetch "${site}llms.txt" | grep -qF "pipeup@$version/"; }
wait_for "llms.txt pins $version (the site is deployed)" site_pins
for page in "" try/document.html try/slides.html try/website.html llms-full.txt skills/pipeup-integrate/SKILL.md pipeup.min.js; do
  check "${page:-home page} loads" fetch "$site$page"
done
if [[ $channel == next ]]; then
  check "home page says Pre-release $version" bash -c "curl -fsSL '${site}?s=$RANDOM' | grep -qF 'Pre-release $version'"
  check "pages are noindex" bash -c "curl -fsSL '${site}?s=$RANDOM' | grep -qF 'noindex'"
  check "skills point at /next/" bash -c "curl -fsSL '${site}llms.txt?s=$RANDOM' | grep -qF '${site}skills/'"
else
  check "stable home page is not marked pre-release" bash -c "! curl -fsSL '${site}?s=$RANDOM' | grep -qF 'Pre-release'"
  check "/next/ answers" fetch "${stable_site}next/"
fi

echo
if [[ $failures -gt 0 ]]; then
  echo "$failures check(s) failed."
  exit 1
fi
echo "All checks passed."
