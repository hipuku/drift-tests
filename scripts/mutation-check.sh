#!/usr/bin/env bash
#
# Runs the suite against Drift, breaks one line of Drift, runs it again, and
# checks that it failed on the 409 step. Then restores Drift.
#
# The restore runs from an EXIT trap, so an interrupted or failed run also
# puts app.ts back.
#
# Needs Redis, Chromium for Playwright, and nothing else on the port.
#
#   ./scripts/mutation-check.sh            expects ../drift
#   DRIFT=~/code/drift ./scripts/mutation-check.sh
#   PORT=3101 ./scripts/mutation-check.sh
#
set -euo pipefail

DRIFT="${DRIFT:-../drift}"
PORT="${PORT:-3001}"
URL="http://127.0.0.1:$PORT"
TARGET="$DRIFT/src/server/app.ts"
BACKUP="$(mktemp)"
SERVER_PID=""

# POST /discover with no url is a 400 with no Redis, Playwright or network
# involved. Bounded by --max-time: a socket that accepts and never answers
# would otherwise hold curl, and the loop around it, indefinitely.
answering() {
  [ "$(curl -s --connect-timeout 2 --max-time 5 -o /dev/null -w '%{http_code}' \
        -X POST "$URL/discover" -H 'content-type: application/json' -d '{}')" = "400" ]
}

stop_drift() {
  [ -n "$SERVER_PID" ] || return 0
  kill "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
  # The next run must reach the next server. If this one still holds the port,
  # the suite would run against the build it was meant to replace.
  for _ in $(seq 1 20); do
    answering || return 0
    sleep 0.5
  done
  echo "Drift is still answering on :$PORT after being stopped." >&2
  exit 1
}

cleanup() {
  # Restore first: stop_drift can exit, and an exit inside a trap skips the rest.
  [ -s "$BACKUP" ] && cp "$BACKUP" "$TARGET"
  rm -f "$BACKUP"
  stop_drift || true
  # Say so, because a silent restore is indistinguishable from no restore.
  echo "Drift restored: $(cd "$DRIFT" && git status --porcelain -- src/server/app.ts | wc -l | tr -d ' ') changes to app.ts"
}
trap cleanup EXIT

[ -f "$TARGET" ] || { echo "No Drift at $DRIFT. Set DRIFT=/path/to/drift." >&2; exit 1; }
if answering; then
  echo "Something is already answering on :$PORT. Stop it, or set PORT." >&2
  exit 1
fi
cp "$TARGET" "$BACKUP"

start_drift() {
  stop_drift
  # exec, so SERVER_PID is tsx and not a subshell. Killing a subshell leaves
  # its children running: the first version of this script did that, kept the
  # unmodified server on the port, and reported the suite as blind.
  ( cd "$DRIFT" \
    && exec env REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}" PORT="$PORT" \
       DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1 DRIFT_WEBHOOK_SECRET=drift-tests-secret \
       node_modules/.bin/tsx --tsconfig tsconfig.runtime.json src/server/index.ts ) \
    > /tmp/drift-mutation.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 45); do
    answering && return 0
    kill -0 "$SERVER_PID" 2>/dev/null || { echo "Drift died on boot:" >&2; tail -20 /tmp/drift-mutation.log >&2; exit 1; }
    sleep 1
  done
  echo "Drift never came up on :$PORT" >&2; exit 1
}

echo "── 1. the suite against an unmodified Drift"
start_drift
DRIFT_URL="$URL" npm test

echo
echo "── 2. breaking the 409 on an unfinished audit"
# lifecycle.feature expects a 409 for the audit of a failed crawl. This makes
# the endpoint return a 200 with an all-zeros audit instead.
python3 - "$TARGET" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1]); s = p.read_text()
old = '        res.status(409).json({ error: "the crawl has not finished" });'
new = '        res.json(collectAudit({ pages: [], startedAt: 0, finishedAt: 0 } as never));'
assert old in s, "the 409 guard has moved; update this script rather than the assertion"
p.write_text(s.replace(old, new, 1))
PY

echo
echo "── 3. the suite against the broken Drift, which must fail"
start_drift
if DRIFT_URL="$URL" npm test > /tmp/drift-mutation-run.log 2>&1; then
  echo >&2
  echo "The suite passed against a Drift that returns 200 where lifecycle.feature expects 409." >&2
  exit 1
fi

grep -q 'returns status 409' /tmp/drift-mutation-run.log || {
  echo "The suite failed, but not on the 409 step. Read /tmp/drift-mutation-run.log:" >&2
  tail -30 /tmp/drift-mutation-run.log >&2
  exit 1
}

grep -Eq 'scenarios \([0-9]+ passed, 1 failed\)' /tmp/drift-mutation-run.log || {
  echo "More than the one lifecycle scenario failed. Read /tmp/drift-mutation-run.log:" >&2
  tail -30 /tmp/drift-mutation-run.log >&2
  exit 1
}

echo
sed -n '/Failed scenarios/,$p' /tmp/drift-mutation-run.log
echo
echo "Failed on the 409 step only. docs/a-failing-run.md has a recorded run."
