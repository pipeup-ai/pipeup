#!/usr/bin/env bash
# Builds the website into apps/site/_site: the page, fonts, favicon, link-preview image (og.png), skills, llms.txt,
# llms-full.txt, robots.txt, the Markdown page, the Try pages and the current pipeup.min.js.
#
# Works from any directory: paths are relative to the repository root (two levels up from here).
#
#   apps/site/build.sh                 build the library, then the site
#   apps/site/build.sh --no-lib-build  use the library already in libs/ts/pipeup/dist
#   apps/site/build.sh --channel next  build the pre-release copy, published under /next/ (channel.py)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
site="$root/apps/site"
lib="$root/libs/ts/pipeup"
out="$site/_site"

build_lib=1 channel=stable
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-lib-build) build_lib=0 ;;
    --channel) channel="${2:?--channel needs stable or next}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ $channel == stable || $channel == next ]] || { echo "unknown channel: $channel" >&2; exit 2; }

addons="$root/libs/ts/addons"
if [[ $build_lib == 1 ]]; then
  (cd "$lib" && npm run build)
  (cd "$addons" && npm run build)
fi
[[ -f "$lib/dist/pipeup.min.js" ]] || { echo "missing $lib/dist/pipeup.min.js: build the library first" >&2; exit 1; }

[[ -f "$addons/examples/save-to-github/dist/save-to-github.min.js" ]] || { echo "missing the Save to GitHub example build: build the add-ons first" >&2; exit 1; }
[[ -f "$addons/examples/send-to-git/dist/send-to-git.min.js" ]] || { echo "missing the Send to Git example build: build the add-ons first" >&2; exit 1; }
for id in voice live assist; do
  [[ -f "$addons/$id/dist/$id.min.js" ]] || { echo "missing $addons/$id/dist/$id.min.js: build the add-ons first" >&2; exit 1; }
done

rm -rf "$out"
mkdir -p "$out/skills"
cp -R "$site/index.html" "$site/addons.html" "$site/add-comments.html" "$site/create-html.html" "$site/walk.css" "$site/walk.js" "$site/fonts" "$out/"
cp "$lib/dist/pipeup.min.js" "$out/"
mkdir -p "$out/addons"
for id in voice live assist; do cp "$addons/$id/dist/$id.min.js" "$out/addons/"; done
cp "$addons/examples/send-to-git/dist/send-to-git.min.js" "$addons/examples/save-to-github/dist/save-to-github.min.js" "$out/addons/"
cp "$site/llms.txt" "$site/robots.txt" "$site/index.html.md" "$site/addons.html.md" "$site/add-comments.html.md" "$site/create-html.html.md" "$site/favicon.svg" "$site/og.png" "$out/"
cp -R "$root"/apps/agent-skills/pipeup-* "$out/skills/"
python3 "$site/build-try.py" "$out"
python3 "$site/build-guide.py" "$out"
python3 "$site/inject-sri.py" "$out"

# llms-full.txt: the short guide followed by every skill.
{
  cat "$site/llms.txt"
  for f in "$root"/apps/agent-skills/pipeup-*/SKILL.md; do
    printf '\n\n---\n\n<!-- %s -->\n\n' "${f#"$root"/apps/}"
    cat "$f"
  done
} > "$out/llms-full.txt"

if [[ $channel == next ]]; then
  python3 "$site/channel.py" "$out" "$(node -p 'require(process.argv[1]).version' "$lib/package.json")"
fi

echo "Built $out"
