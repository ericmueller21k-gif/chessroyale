# Fake-human swarm: what exists, what's missing (Nov 24)

## 1. Is there a headless "fake human" client? Partly, yes.

- **`scripts/load/player.ts` + `run.ts`** (Oct 7, last touched Oct 15). It uses the app's real path: a guest account (`GET /api/me`), the home screen's live line, PLAY (`POST /api/play`, waits out "busy, you're in line"), the lobby WebSocket (`hello`), the 30 s heartbeat, random votes, random legal moves (chess.js) with 0.8 to 9 s of thinking (3% miss the clock), quick chat in 10% of rounds, and reconnects with backoff after a dropped socket. When a fake becomes the lobby's host, it answers the scoring, bot-plan and boss-move work with **made-up numbers**. Runs across processes (`--procs`, about 1,500 fakes per core). It refuses hunchess.com. Each run gets its own queue (`--pool`).
- **Missing from it:** only Crowd and raid. No Squads, ranked 1 v 1, parties or Battle Tower. No behavior profiles: every fake behaves the same. No leaving mid-game except at a fixed `--session` time, no AFK, no deliberate reconnect, no rage-quit, no human-like move quality (moves are uniformly random). It hasn't been run since the Nov 16 50 v 50 rework (team turns), so it needs checking against today's protocol (`packages/chess/src/protocol.ts`).
- **Related pieces:** `scripts/squads-headless.ts` + `e2e/squads-client.ts` (Squads over real WebSockets: queue, party or test lobby; plays or idles until bots take over). `scripts/cheater-demo.ts` (four named test accounts play real Crowd on production through an Access service token, answering judge work with real Stockfish/Maia, the way net.ts does). Test accounts (`server/src/test-accounts.ts`) and friend bots (`friend-bots.ts`, presence only, no play).

## 2. Load tests and capacity on record

- Reports: `reports/load/`. The story: `docs/history/ops.md`, "Capacity: built". How to run them: `DEPLOY.md`, "Load testing".
- **Staging, Oct 8, Crowd only:** 1,000 fakes, all played, no errors (pick round trip p50 228 ms, PLAY p50 71 ms). But guest sign-in was slow (`/api/me` p50 15.7 s). **5,000 fakes:** only 1,177 got in; 3,823 got 500s on `/api/me` because D1 choked on the sign-in path and the schema check. Fixes proposed then: the schema now runs once per instance in batches (`docs/decisions/2026-11-10-schema-fast.md`). Not done: one-batch guest creation, and its `meta` read still treats a D1 error as "no schema" (`accounts.ts` ~413). 5,000 and 10,000 have **never been re-run.**
- **Documented limits:** 300 admitted per second per queue (burst 600) and 20,000 in lobbies, then "busy" (`CAPACITY`, settings.ts ~4084). Rate limits: 10k per address per minute (lifted by `LOAD_TEST` on staging), 1,200 per account, 40 PLAY presses (settings.ts ~4117). A Durable Object handles about 1,000 simple calls a second; the live hub and each matchmaker are single objects, the first thing to get hot at 10k. A 100-player match end writes ~500 D1 statements one at a time. Engine server: 2 containers and 3,000 re-checks a day, enough for about the first hour at 10k. Fake hosts mean load tests skip it.
- **Never measured:** Squads, 1 v 1, raids, parties, the tower, the town, friends and quests at match end under load, or the fair-play ban gate "with the gate on" (ops.md line 158).

## 3. What's missing for Eric's ask

1. **Behavior profiles** in player.ts: normal, slow (near the clock), leaver (leaves at a random round, so the lobby's `LEAVING` hands the seat to a bot), AFK (stops picking), reconnect (drops the socket and comes back with its seat token), chatter, rage-quit after a loss. Plus a "human" move mode (pick from the top few legal moves, with more blunders when slow). About 1 helper-day.
2. **Every mode:** crowd and raid are there. Squads exists as a client to fold in. Ranked 1 v 1, Crowd/boss/tower parties and the tower are new. About 2 to 3 helper-days.
3. **Eric among them:** already possible. Open the staging URL with `?pool=NAME` (App.tsx 1626) and start the swarm with the same `--pool`. No new code needed.
4. **Dashboards:** today we have the run's Markdown report and `/api/ops/stats`. For a live view: a small staging-only page polling `/api/ops/stats` plus the generator's counters (fakes by state, matches, bots that took seats, errors, round trips). About 1 day.
5. **Where it runs:** this 4-core container drives about 5,000 to 6,000 fakes, which covers 100 to 2,000 easily. For 10k: two machines, or a GitHub Actions matrix (free on the public repo; 4 runners × 2,500). Cloudflare itself isn't a good generator.
6. **Cost:** staging is usage-based. About $1 to $3 for a 10-minute run with 10k fakes; idle costs nothing (DEPLOY.md). `CLOUDFLARE_API_TOKEN` is set in this session, so a helper can run `staging.sh up` (its scopes are unverified). The ops rules still say a deploy that costs anything needs Eric's OK.
7. **Guards:**
   - **Never production:** the scripts refuse hunchess.com. Fakes' made-up host scores would corrupt real judging, and they'd inflate the live line.
   - **Zero Trust:** staging is on workers.dev with no Access, which is fine for fakes and Eric. `--access` is there if it's ever gated.
   - **Rate limits:** `LOAD_TEST` lifts the per-address limit; the per-account limits hold (one guest per fake).
   - **Fair play:** random or Maia moves never look like an engine. Guests aren't test accounts, so a reported fake could open a staging case (harmless).
   - **Engine:** `ENGINE_OFF` on staging.
   - Tear down after each run (`staging.sh down`).

**Effort:** a first version (profiles, a refresh for team turns, Crowd 50 v 50 at 100 to 2,000 on staging with Eric in the pool, one report) is about 1.5 to 2 helper-days. A full version (every mode, parties, a live dashboard, 10k from two generators, the sign-in fixes re-measured) is about 5 to 7 helper-days.

## 4. Staged plan

1. **Smallest useful step (half a day, `ops`, high):** bring player.ts up to the team-turns protocol, add `--profile` mixes (leaver, AFK, reconnect, slow, chatter), stand up staging, and run 99 fakes in one pool while Eric queues the same pool from his phone. He plays a real 50 v 50 among them. Report and tear down.
2. Scale to 500, then 2,000 Crowd with a profile mix. Fix the `/api/me` path (one-batch guest creation, rethrow D1 errors in `meta`). Re-measure.
3. Add the modes: raid, Squads (reuse squads-client), ranked 1 v 1, parties, the tower.
4. Add the live staging dashboard, then 5,000 and 10,000 from a GitHub Actions matrix. Record the numbers in `reports/load/` and `ops.md`.
