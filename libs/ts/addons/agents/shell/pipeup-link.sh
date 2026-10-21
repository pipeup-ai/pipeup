#!/bin/bash
# Pipeup's shell link: the live link between a page and an agent on this computer, with nothing but what macOS and
# Linux come with (bash, nc, openssl). It runs beside whatever already shows the page (a localhost preview, or the
# file itself) and never changes the page. Everything stays on this computer.
#
#   bash pipeup-link.sh <page.html>             start the link (stop it with Ctrl-C, or kill)
#   bash pipeup-link.sh comments <page.html>    print the open comments the page shared, as Markdown
#   bash pipeup-link.sh reply <page.html>       read a pipeup-replies block on stdin and leave it for the page
#
# Files next to the page, all named after it (lisbon.html → lisbon.*):
#   lisbon.link.js        where the link is; the page looks for it. Removed when the link stops.
#   lisbon.comments.json  the comments, as the page last shared them (with the person's switch on).
#   lisbon.replies.js     the agent's replies, which the page reads.
set -u

say() { printf '%s\n' "$*" >&2; }
die() { say "pipeup-link: $*"; exit "${2:-1}"; }

usage() { die "usage: bash pipeup-link.sh [comments|reply] <page.html>" 2; }

resolve() {
  [ -f "$1" ] || die "there is no file $1" 2
  local dir
  dir=$(cd "$(dirname "$1")" && pwd) || die "can't read the folder of $1"
  printf '%s/%s' "$dir" "$(basename "$1")"
}

# lisbon.html → /path/to/lisbon
stem() { printf '%s' "${1%.*}"; }

# The session key the page sent with its comments: the page adds replies tagged with it by itself.
session_of() {
  [ -f "$1" ] || return 0
  sed -n 's/.*"session":"\([A-Za-z0-9_-]\{16,\}\)".*/\1/p' "$1" | head -n 1
}

cmd_comments() {
  local json
  json="$(stem "$(resolve "$1")").comments.json"
  [ -f "$json" ] || die "no comments yet: start the link, and ask the person to switch on Share with my agent"
  if command -v plutil >/dev/null 2>&1 && plutil -extract open.markdown raw -o - "$json" 2>/dev/null; then return; fi
  if command -v python3 >/dev/null 2>&1 &&
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["open"]["markdown"])' "$json" 2>/dev/null; then
    return
  fi
  cat "$json"
}

cmd_reply() {
  local page base text key tag esc
  page=$(resolve "$1")
  base=$(stem "$page")
  # Every byte of the block, without the trailing newlines, so the tag and the text agree.
  text=$(cat; printf x)
  text=${text%x}
  while [ "${text%$'\n'}" != "$text" ]; do text=${text%$'\n'}; done
  case "$text" in *pipeup-replies*) ;; *) die "stdin has no \`\`\`pipeup-replies block" 2 ;; esac
  tmp=$(mktemp) || die "can't make a temporary file"
  trap 'rm -f "$tmp"' EXIT
  printf '%s' "$text" >"$tmp"
  key=$(session_of "$base.comments.json")
  tag=""
  if [ -n "$key" ] && command -v openssl >/dev/null 2>&1; then
    tag=$(openssl dgst -sha256 -hmac "$key" <"$tmp" | sed 's/^.*= *//')
  fi
  # A JavaScript string: backslashes, quotes and line breaks escaped; everything else as it is.
  esc=$(awk '{ gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); gsub(/\r/, "\\r"); printf "%s%s", (NR > 1 ? "\\n" : ""), $0 }' "$tmp")
  printf '(globalThis.pipeupReplies ||= []).push({ format: "pipeup-replies-block", v: 1, text: "%s", tag: "%s" });\n' \
    "$esc" "$tag" >>"$base.replies.js" || die "can't write $base.replies.js"
  local n replies
  n=$(grep -c '^[[:space:]]*thread[[:space:]]*:' "$tmp")
  if [ "$n" = 1 ]; then replies="1 reply"; else replies="$n replies"; fi
  if [ -n "$tag" ]; then
    say "Wrote $replies to $(basename "$base").replies.js, tagged for this session: the page adds them by itself while sharing stays on."
  else
    say "Wrote $replies to $(basename "$base").replies.js. They aren't tagged (sharing isn't on, or this computer has no openssl), so the page asks the person before adding them."
  fi
}

# An origin this link answers: a page opened from a file ("null"), or one shown on this computer.
local_origin() {
  case "$1" in
    null | http://localhost | http://localhost:* | http://127.0.0.1 | http://127.0.0.1:* | 'http://[::1]' | 'http://[::1]:'*) return 0 ;;
  esac
  return 1
}

cmd_link() {
  command -v nc >/dev/null 2>&1 || die "this computer has no nc. Use Copy for my agent instead."
  local page base port secret fifo origin_ok
  page=$(resolve "$1")
  base=$(stem "$page")
  # A free port, chosen at random among the ones no program reserves.
  port=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    local p=$((49152 + RANDOM % 16000))
    if ! nc -z 127.0.0.1 "$p" >/dev/null 2>&1; then port=$p; break; fi
  done
  [ -n "$port" ] || die "couldn't find a free port on this computer"
  secret=$(LC_ALL=C tr -dc 'A-Za-z0-9_-' </dev/urandom | head -c 24)
  [ ${#secret} -eq 24 ] || die "couldn't make a secret"
  fifo=$(mktemp -u)
  mkfifo "$fifo" || die "can't make a pipe"
  linkfile="$base.link.js"
  # Stopping (Ctrl-C, or kill) ends the listener at once, and takes the link file away so the page knows.
  trap 'pkill -P $$ 2>/dev/null; rm -f "$fifo" "$linkfile"; exit 0' INT TERM HUP
  trap 'pkill -P $$ 2>/dev/null; rm -f "$fifo" "$linkfile"' EXIT

  handle() {
    local method path line host="" origin="" len=0
    IFS=' ' read -r method path _ || return
    while IFS= read -r line; do
      line=${line%$'\r'}
      [ -z "$line" ] && break
      case "$line" in
        [Hh][Oo][Ss][Tt]:*) host=${line#*:}; host=${host# } ;;
        [Oo][Rr][Ii][Gg][Ii][Nn]:*) origin=${line#*:}; origin=${origin# } ;;
        [Cc][Oo][Nn][Tt][Ee][Nn][Tt]-[Ll][Ee][Nn][Gg][Tt][Hh]:*) len=${line#*:}; len=${len# } ;;
      esac
    done
    local status="403 Forbidden" allow=""
    case "$len" in '' | *[!0-9]*) len=0 ;; esac
    if local_origin "$origin"; then allow="Access-Control-Allow-Origin: $origin"$'\r\n'"Vary: Origin"$'\r\n'; fi
    if [ "$host" != "127.0.0.1:$port" ] || [ -z "$allow" ]; then
      status="403 Forbidden"
    elif [ "$method" != POST ] || [ "$path" != "/$secret/comments" ]; then
      status="404 Not Found"
    elif [ "$len" -gt 8388608 ]; then
      status="413 Content Too Large"
    else
      if head -c "$len" >"$base.comments.json.tmp" && mv "$base.comments.json.tmp" "$base.comments.json"; then
        status="204 No Content"
      else
        status="500 Internal Server Error"
      fi
    fi
    printf 'HTTP/1.1 %s\r\n%sCache-Control: no-store\r\nContent-Length: 0\r\nConnection: close\r\n\r\n' "$status" "$allow"
  }

  # Check that this computer's nc listens the way this script needs before telling the page anything.
  (nc -l 127.0.0.1 "$port" <"$fifo" | handle >"$fifo") &
  local first=$!
  origin_ok=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then origin_ok=1; break; fi
    sleep 0.1
  done
  if [ -z "$origin_ok" ]; then
    kill "$first" 2>/dev/null
    die "this computer's nc can't listen on 127.0.0.1 the way this link needs. Use Copy for my agent instead."
  fi
  wait "$first" 2>/dev/null

  printf '(globalThis.pipeupLink ||= []).push({ format: "pipeup-link", v: 1, url: "http://127.0.0.1:%s/%s" });\n' \
    "$port" "$secret" >"$linkfile" || die "can't write $linkfile"
  say "Pipeup's link for $(basename "$page"), on this computer only (127.0.0.1:$port)."
  say "Wrote $(basename "$linkfile") next to the page. Open the page (or keep it open): within a few seconds its"
  say "menu offers Share with my agent. Once the person switches it on, the comments arrive in"
  say "$(basename "$base").comments.json. Stop with Ctrl-C; that also removes $(basename "$linkfile")."
  # In the background and waited for, so a signal is heard while nc waits for the next request.
  while :; do
    nc -l 127.0.0.1 "$port" <"$fifo" | handle >"$fifo" &
    wait $!
  done
}

case "${1:-}" in
  comments) [ $# -eq 2 ] || usage; cmd_comments "$2" ;;
  reply) [ $# -eq 2 ] || usage; cmd_reply "$2" ;;
  -h | --help | '') usage ;;
  *) [ $# -eq 1 ] || usage; cmd_link "$1" ;;
esac
