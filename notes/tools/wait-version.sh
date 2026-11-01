#!/bin/sh
# Usage: wait-version.sh <commit prefix>. Polls hunchess.com/version.json (behind Cloudflare Access: the service token
# from CF_ACCESS_CLIENT_ID2 / CF_ACCESS_CLIENT_SECRET2, sent as headers, never printed) every 30 s, up to ~25 min,
# until the live build's commit starts with the prefix; then prints it and /api/status.
want=$1
get() { curl -sS --max-time 20 -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID2" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET2" "https://hunchess.com$1"; }
for i in $(seq 1 50); do
  v=$(get /version.json 2>/dev/null)
  case "$v" in *"\"commit\":\"$want"*) echo "live after $((i / 2)) min: $v"; echo "/api/status: $(get /api/status)"; exit 0;; esac
  sleep 30
done
echo "TIMEOUT; last: $v"; exit 1
