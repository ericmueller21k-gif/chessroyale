# Putting Battle Royale Chess online (one time, about 3 minutes, free)

You already have a Cloudflare account from Word Trap, so this is just importing a second repository.

1. In the Cloudflare dashboard, open **Workers & Pages** and select **Create application**.
2. Next to **Import a repository**, select **Get started**, and pick `chessroyale` (allow access to it on GitHub if
   asked).
3. On the settings screen:
   - **Project name:** `chessroyale`
   - **Build command:** `npm run build`
   - Leave the deploy command as `npx wrangler deploy` and everything else as it is.
4. Select **Save and Deploy**. After a minute or two you get a link like `https://chessroyale.<your-name>.workers.dev`.

Every push to `main` redeploys it. Everything runs on the free plan: the chess engine runs in each player's browser.

## The engine server (Workers Paid, from Oct 5, 2026)

The account is on **Workers Paid** ($5/month), which Containers need. `wrangler.jsonc` declares the engine server: `engine/Dockerfile` (native Stockfish 17.1 behind a small Node API), class `EngineServer`, binding `ENGINE`. Workers Builds builds the image and deploys it with the Worker on every merge to main; nothing to do by hand.

- **What it does:** re-checks the close calls before cuts (online in the lobby Durable Object, solo through `POST /api/engine/score`). Routine scoring still runs on players' devices.
- **Cost guard:** at most `ENGINE_DAILY_SEARCHES` re-checks a day (default 3000), counted in the D1 table `engine_usage`. Past it, or with no server, players' devices' numbers stand. To change the cap, set `ENGINE_DAILY_SEARCHES` as a variable on the Worker (Settings → Variables).
- **Locally:** `npx wrangler dev` builds and runs the container with Docker; `--enable-containers=false --var ENGINE_OFF:1` runs without it (the e2e suite does, to test the device fallback).
- **Budget alert:** Billing → Add Budget Alert in the Cloudflare dashboard (suggested: $20/month).

## Fair play: the review page, the reviewer and the deep re-check

- **Admins** (the review page at `https://hunchess.com/admin/fairplay`): in the Worker's Settings → Variables and
  Secrets, add `ADMIN_EMAILS` (type Secret or Text) with the sign-in emails allowed, comma-separated, e.g. Eric's. Sign
  in to HunChess with one of them and open the page. Anyone else gets "Not found".
- **The automated reviewer's token:** add `FAIRPLAY_REVIEW_TOKEN` as a **Secret** (any random string of 16+
  characters, e.g. `openssl rand -hex 24`), and give the same string to the reviewer's scheduled task. Never commit it.
  `docs/fairplay-reviewer.md` is the reviewer's brief.
- **The deep re-check** runs from the Worker's schedule (`triggers.crons` in wrangler.jsonc, every 15 minutes; deployed
  with the Worker). It uses the engine server on an instance of its own (`fairplay-1`, inside `max_instances`), within
  `FAIRPLAY.deep.dailySearches` searches a day (default 500, about 25 minutes of one standard-2 instance: well under
  $0.10 a day), counted in the D1 table `fairplay_budget`. Without the engine server nothing is re-checked, and nobody
  is auto-banned (a ban needs the deep re-check).
- **Emails** about bans and clearings go through Resend with the sign-in key, from `fairplay@` the domain of
  `EMAIL_FROM` (default hunchess.com). Nothing to set up if sign-in codes already send.

## Load testing (staging only, never production)

Simulated players (`scripts/load/`) speak the app's real protocol: a guest account, the home screen's live line, PLAY,
the lobby's WebSocket, votes, legal moves within the clock, the odd quick-chat line, the 30 s heartbeat, then leave.
One of them is faked as each lobby's host with made-up scores, so the test measures the servers, not Stockfish.
Results go to `reports/load/`. See DECISIONS.md, "Capacity: built", for what was measured and fixed.

**Locally** (finds code-level choke points; one machine runs everything, so absolute numbers are low):

```sh
npm run build
npx wrangler dev --port 8787 --enable-containers=false --var ENGINE_OFF:1 --var OPS_STATS:local --var LOAD_TEST:1
npx tsx scripts/load/run.ts --url http://localhost:8787 --players 500 --ramp 20 --session 200 --ops-key local --name local-500
npx tsx scripts/load/burst.ts --url http://localhost:8787 --players 1000 --ops-key local   # the matchmaker alone
```

Run wrangler from a copy of the repo you aren't editing: it reloads the Worker on every file change, which drops
every connection mid-test.

**Staging** (the real numbers). One-time, Eric:
1. Cloudflare dashboard → **My Profile → API Tokens → Create Token → Custom token**, with: Account · Workers Scripts ·
   Edit; Account · D1 · Edit; Account · Account Analytics · Read; Account · Workers Observability · Read; User ·
   Memberships · Read; Zone: none. Copy it.
2. Give it to the session as the environment variable `CLOUDFLARE_API_TOKEN` (claude.ai → the environment's
   settings → environment variables/secrets). Never paste it into a chat or a file.

Then (any session with the token):

```sh
scripts/load/staging.sh up                    # creates D1 "hunchess-staging", deploys chessroyale-staging, a stats key
scripts/load/staging.sh run 1000 60 300       # players, ramp seconds, seconds each stays
scripts/load/staging.sh run 5000 120 300
scripts/load/staging.sh run 10000 180 300     # spreads over Node processes, ~1,500 players each
scripts/load/staging.sh down                  # deletes the staging Worker, its Durable Objects and its database
```

- Staging is `env.staging` in `wrangler.jsonc`: its own Worker (on workers.dev, no hunchess.com route), Durable
  Objects and D1; no engine server, no sign-in (guests play online), `LOAD_TEST=1` (the per-address rate limit is off,
  since every simulated player comes from one machine). `OPS_STATS` is set as a secret by the script.
- **Cost:** usage-based on Workers Paid. A 10,000-player run of 10 minutes is roughly 1-2 million Worker and Durable
  Object requests and ~150k GB-s of Durable Object time: about $1-3. Idle, a deployed staging Worker costs nothing,
  but `down` deletes it anyway.
- **The generator's limits:** one Node process handles about 1,500 players (one core); this container has 4 cores,
  so about 5,000-6,000 players is the most it can drive at once. For 10,000, run `staging.sh run 5000` from two
  machines at the same time with the same `--pool` (or a bigger machine).

## Monitoring and alerts

What to watch in the Cloudflare dashboard (the names move around; search the dashboard if one isn't where it says):

- **Workers & Pages → chessroyale → Metrics:** requests, errors (exceptions), CPU time (p50/p99). Healthy: errors
  well under 0.1% of requests; CPU p99 under 50 ms.
- **Workers & Pages → chessroyale → Observability (Logs):** search for `matchmaker:`, `live hub:` and
  `closing without D1` (each means something degraded), and `Error`.
- **Durable Objects (Workers & Pages → chessroyale → Durable Objects, or Storage & Databases → Durable Objects):**
  per class: requests, CPU, wall time, active objects, storage. Watch:
  - `Lobby`: one object per match; CPU per object should stay well under a second per second.
  - `Matchmaker` and `LiveHub`: one object each (per queue for Matchmaker), so they're the ones to watch at scale.
    Healthy: under ~500 requests/s each (a single object handles roughly 1,000 simple requests a second).
- **Storage & Databases → D1 → hunchess → Metrics:** read and write queries, rows written, query latency, size.
  After the capacity work, writes are about one per player per hour plus match results; reads about one per page
  view. Healthy: write latency p90 under 10 ms, and no "overloaded" errors in the logs.
- **The live line itself:** `https://hunchess.com/api/live` answers with online / matches / queue; an uptime monitor
  on it is the simplest health check.

**Alerts to set (Eric, about 10 minutes):**
1. **Billing (do this first):** Manage Account → **Billing → Billable usage / Budget alerts → Add budget alert**:
   one at **$25/month** (normal use stays well under it) and one at **$100/month** (something is up).
2. **Usage notifications:** account home → **Notifications → Add → Usage Based Billing**: for Workers requests over
   **50 million a month** and Durable Objects duration over **5 million GB-s a month** (roughly the $25 mark each).
3. **Errors:** Workers & Pages → chessroyale → Observability → **Alerts** (if offered on the plan): error rate over
   1% for 5 minutes, emailed. If alerts aren't offered, the weekly Workers summary email (Notifications →
   Add → Workers) plus the uptime check below cover it.
4. **Uptime:** a free external monitor (e.g. UptimeRobot) on `https://hunchess.com/api/live` every 5 minutes, emailed
   when it fails twice. (Cloudflare Health Checks need a Pro zone plan, $20/month; not needed.)
