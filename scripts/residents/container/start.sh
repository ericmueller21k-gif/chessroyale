#!/bin/bash
# HunChess residents host (docs/areas/ops.md, "Residents, the host"): the container's one process. Forever: fetch the public
# repository's main, install it, run the residents program until it exits, then again. Exit 75 from the program means a new version
# went live and its games are done (restart at once); 78 means Access turned the token away, which ends the container (no retry with
# the same secret: the cron's next start brings the Worker's current one); anything else waits a minute, doubling to 15 (a crash at
# start can't spin). SIGTERM (the Worker stopping the container: off, paused, a new token) goes to the program, which ends its games.
#
# The Access token's secret comes in as CF_ACCESS_CLIENT_SECRET. It's unset here and handed to node alone, so git's and npm's
# environments don't carry it; this script's own startup environment still does (any process of this user could read it there).
# What protects it: git and npm run no code from the repository or its packages (npm ci --ignore-scripts), and what does run with
# it, the program and what it imports, comes from main, trusted as the Worker's own bundle is (that runs with every Worker secret).
# The program drops it from its own environment once read, so Maia doesn't get it. Nothing here prints it.
set -u
# (Docker sets HOME from the image's USER, and the image sets it too; in case a runtime does neither.)
: "${HOME:=/home/node}"
REPO="${RESIDENTS_REPO:-https://github.com/ericmueller21k-gif/chessroyale.git}"
REF="${RESIDENTS_REF:-main}"
DIR="$HOME/hc"
secret="${CF_ACCESS_CLIENT_SECRET:-}"
unset CF_ACCESS_CLIENT_SECRET

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)  host: $*"; }
child=0
stopping=0
on_term() {
  stopping=1
  log "stopping"
  if [ "$child" -ne 0 ]; then kill -TERM "$child" 2>/dev/null; wait "$child"; fi
  exit 0
}
trap on_term TERM INT
# Runs a command in the background and waits for it, so SIGTERM reaches the trap at once. Its exit code.
run() {
  "$@" &
  child=$!
  wait "$child"
  local code=$?
  child=0
  return $code
}

# The newest main in $DIR (a fresh shallow clone the first time, fetched after), installed (npm ci only when the lockfile changed),
# and the working directory there.
fetch() {
  cd "$HOME" || return 1
  if [ -d "$DIR/.git" ]; then
    run git -C "$DIR" fetch --quiet --depth 1 origin "$REF" && run git -C "$DIR" reset --quiet --hard FETCH_HEAD && run git -C "$DIR" clean -fdq || return 1
  else
    rm -rf "$DIR"
    run git clone --quiet --depth 1 --branch "$REF" "$REPO" "$DIR" || return 1
  fi
  cd "$DIR" || return 1
  local lock
  lock=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$lock" != "$(cat "$HOME/.lock-installed" 2>/dev/null)" ]; then
    rm -f "$HOME/.lock-installed"
    local t0=$SECONDS
    run npm ci --ignore-scripts --no-audit --no-fund --no-update-notifier --loglevel=error || return 1
    echo "$lock" > "$HOME/.lock-installed"
    log "installed in $((SECONDS - t0)) s"
  fi
}

wait_s=60
while [ "$stopping" -eq 0 ]; do
  t0=$SECONDS
  if fetch; then
    commit=$(git -C "$DIR" rev-parse HEAD)
    log "running ${REF} at ${commit:0:12}"
    # (The program's options come from the Worker: RESIDENTS_ARGS, plain words. The secret goes into node's environment only, never
    # a command line; node is the job itself, so the trap's signal reaches the program.)
    # shellcheck disable=SC2086
    CF_ACCESS_CLIENT_SECRET="$secret" RESIDENTS_COMMIT="$commit" run node --import tsx scripts/residents/run.ts ${RESIDENTS_ARGS:-}
    code=$?
    [ "$stopping" -eq 0 ] || break
    if [ "$code" -eq 75 ]; then
      log "a new version is live: starting over"
      wait_s=60
      continue
    fi
    if [ "$code" -eq 78 ]; then
      log "Access turned the token away: ending the container (the next start brings the Worker's current secret)"
      exit 78
    fi
    # (A run that lasted half an hour wasn't a crash loop: back to a minute.)
    [ $((SECONDS - t0)) -lt 1800 ] || wait_s=60
    log "the program exited with ${code}: again in ${wait_s} s"
  else
    [ "$stopping" -eq 0 ] || break
    log "couldn't fetch or install ${REF}: again in ${wait_s} s"
  fi
  run sleep "$wait_s"
  wait_s=$((wait_s * 2 > 900 ? 900 : wait_s * 2))
done
