#!/bin/sh
# Production entrypoint for the web app (`npm run start --workspace=web`,
# or this file directly). Arguments are passed through to `next start`,
# e.g. `-p $PORT`.
#
# Runs Next under an explicit heap ceiling: Node sizes its heap from the
# memory it is *allowed* to use (gigabytes on most hosts) and is in no
# hurry to collect garbage below that, so after a burst of page renders
# the server keeps well over 100MB of already-dead objects it would
# otherwise have freed. Set WEB_MAX_OLD_SPACE_MB on the service to change
# the ceiling — raise it if the server ever logs "JavaScript heap out of
# memory". See DEPLOYMENT.md, "Memory".
set -e
cd "$(dirname "$0")/.."

# Resolved through Node rather than hard-coded: in this npm workspace
# `next` is hoisted to the repo root's node_modules, not web/node_modules.
NEXT_BIN="$(node -p "require.resolve('next/dist/bin/next')")"

exec node \
  --max-old-space-size="${WEB_MAX_OLD_SPACE_MB:-256}" \
  --max-semi-space-size="${WEB_MAX_SEMI_SPACE_MB:-8}" \
  "$NEXT_BIN" start "$@"
