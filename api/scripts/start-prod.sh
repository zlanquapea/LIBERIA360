#!/bin/sh
# Production entrypoint for the API. Every way of starting it in production
# (root `npm start`, `npm run start:prod --workspace=api`, or this file
# directly) ends up here, so the memory settings below live in one place.
#
# Each setting is a default — set the same variable on the service to
# override it. See DEPLOYMENT.md, "Memory".
set -e
cd "$(dirname "$0")/.."

# glibc's allocator keeps large freed blocks instead of returning them to
# the OS, and raises its own threshold for doing so the first time a big
# block is freed. For this API that means one photo upload (tens of MB of
# decoded pixels) permanently raises the process's memory. Pinning the
# threshold makes every large block its own mapping, handed back the
# moment it is freed.
export MALLOC_MMAP_THRESHOLD_="${MALLOC_MMAP_THRESHOLD_:-131072}"
export MALLOC_TRIM_THRESHOLD_="${MALLOC_TRIM_THRESHOLD_:-131072}"

# Node sizes its heap from the memory it is *allowed* to use (gigabytes on
# most hosts) and is in no hurry to collect garbage below that, so the
# process drifts upward under traffic even though the data it actually
# holds is ~70MB. A ceiling makes the collector keep the heap near what is
# really in use. Raise API_MAX_OLD_SPACE_MB if the API ever logs
# "JavaScript heap out of memory".
exec node \
  --max-old-space-size="${API_MAX_OLD_SPACE_MB:-256}" \
  --max-semi-space-size="${API_MAX_SEMI_SPACE_MB:-8}" \
  dist/main "$@"
