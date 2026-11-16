#!/usr/bin/env bash
# The staging copy of HunChess, for load tests (never load-test production). See DEPLOY.md, "Load testing".
#
#   CLOUDFLARE_API_TOKEN=... scripts/load/staging.sh up            # D1 database, deploy, a stats key
#   scripts/load/staging.sh run 1000 [ramp-s] [session-s] [procs]  # the load test against it
#   scripts/load/staging.sh down                                   # delete the Worker (and its Durable Objects) and the database
#
# Staging is `env.staging` in wrangler.jsonc: its own Worker (chessroyale-staging on workers.dev), Durable Objects
# and D1 database "hunchess-staging"; no engine server, no sign-in, the per-address rate limit off (LOAD_TEST).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN to a token with Workers Scripts, D1 and Account Analytics edit rights (DEPLOY.md, Load testing)}"
CFG=wrangler.staging.jsonc
STATE=.wrangler/staging.env
mkdir -p .wrangler

d1_id() {
  npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).find(d=>d.name==="hunchess-staging");process.stdout.write(r?r.uuid:"")})'
}

case "${1:-}" in
  up)
    id=$(d1_id)
    if [ -z "$id" ]; then
      npx wrangler d1 create hunchess-staging >/dev/null
      id=$(d1_id)
    fi
    [ -n "$id" ] || { echo "Couldn't create the D1 database hunchess-staging"; exit 1; }
    # The staging config: wrangler.jsonc with the staging database's id (kept at the root so its paths still work).
    sed "s/STAGING_D1_ID/$id/" wrangler.jsonc > "$CFG"
    npm run build
    out=$(npx wrangler deploy -c "$CFG" --env staging 2>&1 | tee /dev/stderr)
    url=$(grep -oE 'https://chessroyale-staging\.[a-z0-9-]+\.workers\.dev' <<<"$out" | head -1)
    [ -n "$url" ] || { echo "Deployed, but no workers.dev address in the output"; exit 1; }
    key=$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')
    printf '%s' "$key" | npx wrangler secret put OPS_STATS -c "$CFG" --env staging >/dev/null
    printf 'STAGING_URL=%s\nSTAGING_KEY=%s\n' "$url" "$key" > "$STATE"
    echo "Staging is up at $url"
    ;;
  run)
    # shellcheck disable=SC1090
    source "$STATE"
    n=${2:-1000}
    ramp=${3:-60}
    session=${4:-300}
    procs=${5:-$(( (n + 1499) / 1500 ))}
    access=()
    if [ -n "${CF_ACCESS_CLIENT_ID:-}" ]; then access=(--access); fi
    npx tsx scripts/load/run.ts --url "$STAGING_URL" --players "$n" --ramp "$ramp" --session "$session" --procs "$procs" \
      --home 10 --ops-key "$STAGING_KEY" --name "staging-$n" "${access[@]}"
    ;;
  down)
    npx wrangler delete -c "$CFG" --env staging --force || true
    npx wrangler d1 delete hunchess-staging -y || true
    rm -f "$STATE" "$CFG"
    echo "Staging deleted (Worker, Durable Objects, D1)."
    ;;
  *)
    sed -n '2,9p' "$0"
    exit 1
    ;;
esac
