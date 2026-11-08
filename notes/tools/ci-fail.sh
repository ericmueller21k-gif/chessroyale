#!/bin/sh
# Usage: ci-fail.sh <sha>. Prints every failed check on the commit and its annotations (failing test titles, error
# lines, slow-file notes) from GitHub's public API. No token needed. Use after wait-ci.sh reports a failure.
python3 -I - "$1" <<'PY'
import sys, json, urllib.request
sha = sys.argv[1]
base = "https://api.github.com/repos/ericmueller21k-gif/chessroyale"
get = lambda u: json.load(urllib.request.urlopen(u, timeout=30))
for c in get(f"{base}/commits/{sha}/check-runs?per_page=100")["check_runs"]:
    if c["conclusion"] not in ("failure", "timed_out"): continue
    print(f"== {c['name']} ({c['conclusion']}) {c['html_url']}")
    seen = set()
    for a in get(f"{base}/check-runs/{c['id']}/annotations?per_page=100"):
        m = a["message"].strip().replace("\n", " ")[:400]
        if m in seen or m.startswith("Process completed"): continue
        seen.add(m); print(f"  {a['path']}:{a['start_line']}  {m}")
PY
