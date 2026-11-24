#!/bin/zsh
# Puts Safari's toolbar back to its default layout, after a test run has left it without its address field.
#
#   open -a Terminal tools/safari-toolbar-reset.command
#
# It runs in the Terminal app on purpose: macOS lets Terminal read Safari's settings (it may ask once) where a
# shell inside another app is refused. It quits Safari, forgets every saved toolbar layout, and opens Safari again.
pkill -x Safari; sleep 3
if ! defaults read com.apple.Safari >/dev/null 2>&1; then
  echo "This shell can't read Safari's settings. Run this file from the Terminal app: open -a Terminal $0"
  exit 1
fi
defaults read com.apple.Safari | grep -o '"NSToolbar Configuration[^"]*"' | tr -d '"' | while read -r key; do
  defaults delete com.apple.Safari "$key" && echo "forgot: $key"
done
open -a Safari
echo "Safari is back with its default toolbar. You can close this window."
