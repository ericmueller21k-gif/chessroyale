#!/bin/sh
# Usage: wait-pr.sh <sha>: waits for CI, prints failures and flaky tests.
S=/tmp/claude-0/-home-user-chessroyale/37426f64-a77b-5541-afaa-1847c6a1f530/scratchpad; SHA=$1
sh $S/wait-ci.sh $SHA | grep -v "completed success"; sh $S/ci-fail.sh $SHA 2>&1 | head -14
R=$(curl -s "https://api.github.com/repos/ericmueller21k-gif/chessroyale/commits/$SHA/check-runs?per_page=100" | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[c['html_url'] for c in d['check_runs'] if c['name']=='result']; print(r[0].split('/runs/')[1].split('/')[0] if r else '')")
echo "run $R"; [ -n "$R" ] && python3 $S/flaky-of.py $R 2>&1 | tail -6; true
