#!/usr/bin/env bash
#
# Does this suite actually detect anything?
#
# Stands the stack up, runs the suite green, breaks Drift in one line, runs it
# again, and asserts that it failed for the right reason. Then puts Drift back.
#
# The restore is a trap rather than a final line: a script that leaves the
# repository next door broken when it is interrupted is worse than no script.
#
#   ./scripts/mutation-check.sh            expects ../drift
#   DRIFT=~/code/drift ./scripts/mutation-check.sh
#
set -euo pipefail

DRIFT="${DRIFT:-../drift}"
PORT="${PORT:-3001}"
TARGET="$DRIFT/src/server/app.ts"
BACKUP="$(mktemp)"
SERVER_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -s "$BACKUP" ] && cp "$BACKUP" "$TARGET"
  rm -f "$BACKUP"
  # Say so, because a silent restore is indistinguishable from no restore.
  echo "Drift restored: $(cd "$DRIFT" && git status --porcelain -- src/server/app.ts | wc -l | tr -d ' ') changes to app.ts"
}
trap cleanup EXIT

[ -f "$TARGET" ] || { echo "No Drift at $DRIFT. Set DRIFT=/path/to/drift." >&2; exit 1; }
cp "$TARGET" "$BACKUP"

start_drift() {
  [ -n "$SERVER_PID" ] && { kill "$SERVER_PID" 2>/dev/null || true; sleep 1; }
  ( cd "$DRIFT" \
    && REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}" PORT="$PORT" \
       DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1 DRIFT_WEBHOOK_SECRET=drift-tests-secret \
       npm run dev:server ) > /tmp/drift-mutation.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 45); do
    curl -s -o /dev/null "http://127.0.0.1:$PORT/discover" && return 0
    kill -0 "$SERVER_PID" 2>/dev/null || { echo "Drift died on boot:" >&2; tail -20 /tmp/drift-mutation.log >&2; exit 1; }
    sleep 1
  done
  echo "Drift never came up on :$PORT" >&2; exit 1
}

echo "── 1. the suite against an unmodified Drift"
start_drift
DRIFT_BASE_URL="http://127.0.0.1:$PORT" npm test

echo
echo "── 2. breaking the 409 on an unfinished audit"
# lifecycle.feature pins: a failed crawl's audit is a 409, never a 200 with an
# all-zeros audit. This is what you would write if you decided the endpoint
# should always return an audit shape.
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
if DRIFT_BASE_URL="http://127.0.0.1:$PORT" npm test > /tmp/drift-mutation-run.log 2>&1; then
  echo >&2
  echo "The suite PASSED against a Drift that returns 200 where it promises 409." >&2
  echo "That is the failure this script exists to find: lifecycle.feature is not" >&2
  echo "pinning what its wording says it pins." >&2
  exit 1
fi

grep -q 'returns status 409' /tmp/drift-mutation-run.log || {
  echo "The suite failed, but not on the 409 step. Read /tmp/drift-mutation-run.log:" >&2
  tail -30 /tmp/drift-mutation-run.log >&2
  exit 1
}

echo
sed -n '/Failed scenarios/,$p' /tmp/drift-mutation-run.log
echo
echo "The suite caught it. docs/a-failing-run.md has the reading of this."
