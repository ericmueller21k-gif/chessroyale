#!/bin/sh
# Usage: wait-ci.sh <sha>. Polls every 60 s (up to ~80 min) until every workflow run for the commit has completed (a main
# run waiting its turn since #438 has no check runs yet, so the runs are checked too); then prints the check runs.
# On main a commit whose e2e run was replaced by a newer push reads "cancelled": the next run covers it.
sha=$1
for i in $(seq 1 80); do
  out=$(python3 - "$sha" <<'PY'
import sys, json, urllib.request
sha = sys.argv[1]
base = "https://api.github.com/repos/ericmueller21k-gif/chessroyale"
get = lambda u: json.load(urllib.request.urlopen(u, timeout=30))
runs = get(f"{base}/actions/runs?head_sha={sha}&per_page=50").get("workflow_runs", [])
checks = get(f"{base}/commits/{sha}/check-runs?per_page=50").get("check_runs", [])
pend = [r for r in runs if r["status"] != "completed"] + [c for c in checks if c["status"] != "completed"]
print("PENDING" if (pend or not checks) else "DONE")
for r in runs: print("run", r["name"], r["status"], r["conclusion"])
for c in checks: print(c["name"], c["status"], c["conclusion"])
PY
)
  case "$out" in DONE*) echo "$out"; exit 0;; esac
  sleep 60
done
echo "TIMEOUT"; echo "$out"
