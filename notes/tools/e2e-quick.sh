#!/bin/sh
# Usage (inside a worktree): E2E_PORT=90xx e2e-quick.sh <playwright args...>
# The shared machine's local e2e lane. Refuses runs over 15 tests or --repeat-each over 3 (those go to CI: push and
# wait-ci.sh), waits for the shared lock at most 15 min (then says so instead of queueing for hours), and caps the run at
# 10 min. Prints how long it queued. Big runs, the full suite and repeat sweeps run in CI, never here.
n=$(npx playwright test --list "$@" 2>/dev/null | grep -cE '^\s+\[(phone|desktop)\]')
case "$*" in *repeat-each*) r=$(echo "$*" | sed -n 's/.*repeat-each[ =]\([0-9]*\).*/\1/p'); [ "${r:-1}" -gt 3 ] && { echo "REFUSED: --repeat-each $r > 3 (ask the director)"; exit 2; };; esac
[ "$n" -gt 15 ] && { echo "REFUSED: $n tests > 15. Narrow it (-g, one file) or push and let CI run it."; exit 2; }
t0=$(date +%s)
exec 9>/tmp/claude-0/e2e.lock
flock -w 900 9 || { echo "LOCK BUSY 15 min: push and use CI (wait-ci.sh) instead"; exit 3; }
echo "queued $(( $(date +%s) - t0 )) s; running $n tests"
timeout 600 npx playwright test "$@"
