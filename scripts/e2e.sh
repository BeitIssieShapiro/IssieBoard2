#!/usr/bin/env bash
# Runs the e2e suites of the three apps on one kind of device: ipad, iphone, android.phone,
# android.tablet or android.device (a phone/tablet over USB, or an emulator already running).
#   bash scripts/e2e.sh ipad            # all apps
#   bash scripts/e2e.sh iphone voice    # one app (board, voice or calc)
# Metro must be running (npm start). See e2e/README.md.
set -u
device="${1:?usage: e2e.sh <ipad|iphone|android.phone|android.tablet|android.device> [board|voice|calc]}"
apps="${2:-board voice calc}"
status=0
for app in $apps; do
  files="e2e/$app.test.ts"
  # IssieBoard as the Android system keyboard
  if [[ $app == board && $device == android* ]]; then files="$files e2e/board-ime.test.ts"; fi
  for f in $files; do
    echo "=== $app on $device: $f"
    npx detox test -c "$app.$device" "$f" || status=1
  done
done
exit $status
