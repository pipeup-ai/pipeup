#!/usr/bin/env bash
# Builds the website into apps/site/_site: the page, fonts, favicon, skills, llms.txt,
# llms-full.txt, robots.txt, the Markdown page, the Try pages and the current pipeup.min.js.
#
# Works from any directory: paths are relative to the project root (two levels up from here),
# which is projects/pipeup/ in the monorepo and the repository root on GitHub.
#
#   apps/site/build.sh                 build the library, then the site
#   apps/site/build.sh --no-lib-build  use the library already in libs/ts/pipeup/dist
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
site="$root/apps/site"
lib="$root/libs/ts/pipeup"
out="$site/_site"

build_lib=1
for arg in "$@"; do
  case "$arg" in
    --no-lib-build) build_lib=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ $build_lib == 1 ]]; then
  (cd "$lib" && npm run build)
fi
[[ -f "$lib/dist/pipeup.min.js" ]] || { echo "missing $lib/dist/pipeup.min.js: build the library first" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out/skills"
cp -R "$site/index.html" "$site/fonts" "$out/"
cp "$lib/dist/pipeup.min.js" "$out/"
cp "$site/llms.txt" "$site/robots.txt" "$site/index.html.md" "$site/favicon.svg" "$out/"
cp -R "$root"/apps/agent-skills/pipeup-* "$out/skills/"
python3 "$site/build-try.py" "$out"

# llms-full.txt: the short guide followed by every skill.
{
  cat "$site/llms.txt"
  for f in "$root"/apps/agent-skills/pipeup-*/SKILL.md; do
    printf '\n\n---\n\n<!-- %s -->\n\n' "${f#"$root"/apps/}"
    cat "$f"
  done
} > "$out/llms-full.txt"

echo "Built $out"
