# History: Ops, capacity and hosting

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/ops.md).

## Paid hosting and a domain are on the table (Oct 3, 2026)

Eric will front money for hosting and services, and wants a good URL. Plan: stay on Cloudflare and add a custom
domain bought through Cloudflare Registrar (sold at cost, no markup) so DNS, hosting and the Worker live in one
account. Accounts, profiles and ranked will use Cloudflare D1 (SQL) for players and match history. Workers Paid
($5/month) only if we outgrow the free limits (Durable Object requests or CPU time). Eric does the purchases; I'll
recommend specific options with prices when we get there.

## Capacity: what if 10,000 players arrived? (assessment, Oct 7, 2026)

Eric asked whether the servers could take 10,000 players at once. Short answer: the design scales, but three single
points would choke first, and we've never load-tested it.

**What already scales**
- **Matches:** each match is its own Durable Object, and Cloudflare spreads them over its machines. 10,000 players is
  about 100 Crowd matches at once, which is no problem in principle.
- **Scoring:** today it runs on players' own devices, so it grows with the player base for free.
- **The app itself:** files served from Cloudflare's edge.

**What would choke first**
1. **The matchmaker is one object for the whole world.** It handles one "Play" press at a time and waits on lobby
   objects inside each, so thousands pressing Play in the same minute would queue up behind each other.
   - Fix: keep queue tickets in memory, form lobbies on a one-second timer, and split the matchmaker by mode and
     region.
2. **The database (D1) is one SQLite database.**
   - Every request updates "last seen", and every running match reports itself at least once a minute. At 10,000
     players that's hundreds of writes a second into one database, near what a single D1 database handles.
   - Fix: write "last seen" at most once a minute per player, and keep live counts in memory (a Durable Object) instead
     of database rows.
3. **The engine server** runs on at most 2 containers with a cap of 3,000 deep searches a day. At scale the cap runs
   out early each day.
   - Then phones take over the re-checks: the game keeps working, but cuts are slightly less fair.
   - Raising the cap costs money (Eric's call).

**Rough cost at that scale**
- Cloudflare charges by use (about $0.15 per million Durable Object requests, and about $12.50 per million GB-seconds
  of object time).
- 100 matches running around the clock is very roughly $100–500 a month; real traffic peaks for a few hours a day, so
  far less in practice.
- The load test below would give a real number. Set a billing alert first.

**What to do before any launch push** (the `ops` delegate):
- **A load test:** a staging copy of the site and simulated players (scripted connections that join, pick moves and
  chat) at 1,000, then 5,000, then 10,000. Measure where it breaks.
- **Fix the three choke points** above.
- **Monitoring and alerts:** errors, object CPU, database latency, queue waits and spend.
- **Fail gracefully:** a "servers are busy, you're in line" message rather than errors.
- **Per-player rate limits** on the API.

## Capacity: built (Oct 7, 2026)

The `ops` delegate's work on the assessment above. Eric: server cost isn't his worry; make it ready so popularity
never catches us out. Reports in `reports/load/`; how to run them, staging and monitoring in DEPLOY.md.

**The load test** (`scripts/load/`)
- Simulated players speak the real protocol: a guest account (GET /api/me), the home screen's live line every 5 s,
  PLAY, the lobby's WebSocket (hello), votes, a random legal move (chess.js) within each clock (3% miss it), a
  quick-chat line in 10% of rounds, the 30 s heartbeat, then they leave (at the results, or after `--session`).
- Whoever the lobby makes host answers the host's work (scores, bot plans, the boss's move) with deterministic fake
  numbers at once, so the test measures the servers, not Stockfish.
- It measures PLAY → lobby (until the lobby's welcome), the queue wait, the round trip of a pick (until the server's
  "moved") and of a chat line, every HTTP call and the server's own time for it (a `Server-Timing` header), errors and
  dropped sockets. With `OPS_STATS` set (local and staging only) the server counts D1 statements by table, requests
  by route and Durable Object calls (`/api/ops/stats`, `ops.ts`).
- `scripts/load/burst.ts`: N PLAY presses at the same moment, no sockets: the matchmaker alone.
  `scripts/load/record-size.ts`: how big a 100-player lobby's stored record gets.
- **Local limits:** wrangler runs every Worker and Durable Object in one process, which saturates one core at about
  1,000 players. So locally we find code-level choke points (calls, writes, serialisation) and compare before with
  after; absolute capacity needs staging (below). Its dev proxy also drops requests when that process is saturated
  (the "play 500" rows in the local reports, before and after alike; not a server error).

**Before** (main at a5fd5c8 plus the counters; 500 players over 20 s, and 1,000 over 30 s)
- **The matchmaker overfilled lobbies.** It handed out the filling lobby's code until 100 people had *connected*,
  but players connect a second or two after PLAY answers, so in a surge it promised the same lobby to far more than
  100. 124 of 500 and 365 of 1,000 players got "This match has already started". In the burst test all 1,000 PLAY
  presses were given one 100-seat lobby.
- **It serialised:** one PLAY at a time, each waiting on a call to the lobby object inside `blockConcurrencyWhile`
  (1,000 presses = 1,000 locked cross-object calls; server time p50 655 ms at 500 players, 1.1 s at 1,000).
- **D1 writes:** 1.8 per player per minute in steady play (the conditional `UPDATE users SET last_seen` on every
  request and heartbeat, 1.46, and `live_lobbies` reports, 0.31), plus a guest account's two inserts once. That's
  ~300 writes/s at 10,000 players, in one SQLite database.
- **Every new Worker instance ran ~35 schema statements** (CREATE IF NOT EXISTS, PRAGMA, ALTER) against D1. In a
  surge Cloudflare starts many instances at once.
- In matches a pick's round trip was fine at 500 (p50 47 ms) and 2.2 s at the p90 with 1,000 (the one process).

**What changed**
1. **Matchmaker** (`matchmaker.ts`, pure logic in `queue.ts`): a PLAY press is a ticket in memory; tickets are seated
   in batches. A batch starts as soon as the last one finishes (so a lone press isn't held up; under load batches grow
   by themselves), and again every second (`CAPACITY.queue.formEveryMs`) while anyone waits in line. Each batch makes
   one seat-reservation call per lobby (`Lobby.reserve`), and a new lobby takes its reservation in its `create`
   call. A lobby counts promised seats (held 20 s for the player to connect) as taken, so it's never overfilled; a
   cancelled seat goes to the next player as before. Nothing waits on another object while holding the queue.
   - Kept: 60 s fill then bots, Boss raid's own queue, `?pool=` test queues, private code lobbies untouched.
   - Why not "form lobbies only on a 1 s timer", as the assessment said: it would add up to a second to every PLAY at
     quiet times. Batching as soon as the last batch is done gives the same grouping under load and none of the wait.
   - **Ranked's hook:** `MatchRules.group(tickets, now)` returns groups that never share a lobby (a ticket can carry
     `info`, such as a skill estimate); tickets it leaves out stay in line, in order. The default fills in order. The
     queue's name has a slot for a region (`queueName`, `regionOf`, location hints), off until there are players
     enough (`CAPACITY.queue.byRegion`).
2. **Overload** ("degrade, don't die"): at most `admitPerSecond` (300, burst 600) players a second are let into
   lobbies per queue, and none while more than `CAPACITY.overload.maxPlayers` (20,000) people are in lobbies (the
   live hub's count). Beyond that PLAY answers, after holding up to 2.5 s for a seat, `{ busy, ticket, position,
   waitSeconds }`. The queue screen shows **"Servers are busy, you're in line: about N s"** (N: place in line over the
   admission rate, or the last minute's real rate when the player cap holds the line; rounded up to 5 s) and asks
   again every 3 s with the ticket, keeping its place. Cancel leaves the line. People in lobbies and matches are
   never affected. An old app that doesn't know "busy" shows the same sentence as its error.
   - The queue screen change is the smallest that shows it (`QueueLine` in Queue.tsx: the queue's header, line,
     empty grid and Cancel, "You're in line"). Checked at 360 px (`e2e/busy.spec.ts`).
   - Why 300 a second and 20,000: 10,000 players arriving in one minute is 167 a second, so 300 never slows a real
     surge, but a burst far past anything we've measured is metered instead of hitting every object at once. 20,000
     people is twice the target; past it we're beyond anything tested. Both are settings.
3. **The live hub** (`live-hub.ts`, a new Durable Object, `LIVE`; pure logic `LiveBoard` in live.ts): who's online,
   which lobbies are running or filling, kept in memory. The live line's numbers are the same as before (a test
   checks the two give identical numbers for the same events):
   - Each Worker instance batches who it has seen and passes them on at most every 5 s (`presence.ts`); a player's
     first request in a minute is passed on at once, so you count the moment the home screen loads. The heartbeat's
     session lookup is cached per instance (10 min), so a heartbeat is usually no D1 call at all.
   - Lobbies report changes at most every 2 s (the latest state follows when the 2 s are up), and at least once a
     minute; the hub keeps them in its own storage, so a restart keeps the playing-now list, and seeds who's online
     from D1's last minute.
   - `users.last_seen` (profiles' "last seen") is written by the hub once a minute per account at most, in one
     statement per 500 accounts. A profile's "online now" asks the hub.
   - Without the binding (unit tests), everything falls back to D1 as before.
4. **Schema check:** a database already at the current schema answers one read (`meta.schema`, a fingerprint of
   every schema statement) instead of ~35. Production showed why it matters (the Server-Timing header from step 1,
   Oct 8): at today's low traffic requests keep landing on fresh Worker instances, and every route that touches D1
   took about 1 s (`/api/profile/x` 1,012-1,061 ms, `/api/live` 1,056-1,464 ms) while one without D1 took 0-42 ms
   (`/api/auth/config`).
5. **A lobby's stored record:** each person's last message (re-sent on reconnect) is stored under its own key, and
   only when it changes. Measured with V8's serialiser (what Durable Object storage writes), a 100-player record is
   about 150 KB (the 2.4 MB JSON size is misleading: JSON repeats the standings every message shares); a pick now
   writes about 80 KB instead of about 150 KB.
6. **Rate limits** (`limits.ts`, `CAPACITY.rateLimits`): per address 10,000 a minute (a school or a mobile network
   shares one address), per account 1,200 a minute, PLAY and new lobbies 40 a minute per account (in line asks 20
   times). The per-account limit was first 300 (the home screen asks 12 times a minute); it's 1,200 so a burst of
   reloads and reconnects (a match screen makes several calls each time it opens) never gets near it, while a script
   in a loop, making hundreds a second, still does. (A flaky panel test was first blamed on the 300; it wasn't the
   cause: see LESSONS, "One lucky pass taken for a cause". The higher limit stays on its own merits.) Past one: 429 "Too many requests. Wait a few seconds and try again."
   with `Retry-After`. Counted in each Worker instance's memory, so they stop runaway clients and scripts, not a
   determined attacker (that's Cloudflare's WAF rate-limiting rules, Eric's call if ever needed). `LOAD_TEST=1`
   (staging only) lifts the per-address one, since every simulated player comes from one machine.

**After** (same runs)

| | Before | After |
| --- | --- | --- |
| 500 over 20 s: players who got into a match | 308 of 500 (124 overfilled) | 453 of 500 (0 overfilled; 47 local proxy drops) |
| 1,000 over 30 s: players who got into a match | 406 of 1,000 (365 overfilled) | 658 of 1,000 (0 overfilled; 342 local proxy drops) |
| Burst of 1,000 PLAY at once | 1 lobby promised to 1,000; 1,000 locked calls | 10 lobbies of 100; 23 calls |
| Burst of 2,500 PLAY at once | (not run: the same overfill) | 25 lobbies of ≤ 100, 39 told "busy, in line", 0 errors |
| PLAY, server time p50 / p99 (500) | 655 / 2,725 ms | 21 / 95 ms |
| PLAY, server time p50 / p99 (1,000) | 1,072 / 3,857 ms | 66 / 263 ms |
| Heartbeat, server time p99 (1,000) | 3,514 ms | 94 ms |
| D1 writes per player per minute (steady play) | 1.8 (≈ 300/s at 10,000) | ≈ 0.01, plus one batched last_seen statement per 500 players a minute (≈ 2/s at 10,000) |
| D1 statements per new Worker instance | ~35 | 1 |
| Pick round trip p50 / p90 (1,000) | 83 / 2,166 ms | 47 / 628 ms |

**In production** (Server-Timing, the Worker's own time per request, sampled before and after the deploy on Oct 8):
`/api/live` 886-1,464 ms → 79-279 ms; `/api/profile/…` 805-1,061 ms → 34-106 ms. Most of it is the schema check: at
today's traffic requests keep landing on fresh Worker instances, and each ran ~35 D1 statements first.

**Where it breaks next** (from the numbers above and Cloudflare's published limits; staging will confirm)
- **The live hub and each matchmaker are single objects.** At 10,000 players the hub gets roughly 200-400 calls a
  second (instances' batches, lobby reports, arrivals, the live line); a Durable Object manages about 1,000 simple
  calls a second. Next step if it's hot: shard presence by account id across a few hubs and sum them.
- **Results at the end of a match** are written one statement at a time per player (about 5 each): a 100-player
  match ending is ~500 sequential D1 statements from that lobby, and 10,000 players finishing every ~15 minutes is
  ~50 writes a second. Fine for D1, but the next thing to batch (D1's `batch()`).
- **Requests (cost, not capacity):** the home screen asks for the live line every 5 s. At 10,000 players on the home
  screen that's 2,000 requests a second (≈ $0.30 per million beyond the plan's 10 million a month). Worth 10-15 s if
  it gets busy (the hub's lane).
- **The engine server** (below): 2 containers and 3,000 re-checks a day run out within the first hour at this scale;
  phones then do the re-checks (cuts slightly less fair).

**Staging and the big runs:** no Cloudflare API token was available in this session, so staging is prepared, not
run: `env.staging` in wrangler.jsonc (its own Worker, Durable Objects and D1; no engine, no sign-in, `LOAD_TEST`),
`scripts/load/staging.sh up | run N | down`, and the token's exact permissions in DEPLOY.md. One machine like this
container (4 cores) can drive about 5,000-6,000 simulated players; 10,000 needs two.

**The engine server at 10,000 players (a recommendation; not changed, it's shared with the `engine` delegate)**
- Demand: ~100 Crowd matches at once, each about 40 rounds in ~15 minutes, most with a close call re-checked (~3 s
  of one core each): ~16,000 re-checks an hour, ~45 core-hours an hour, i.e. ~13 standard-2 instances busy at peak.
  Today: 2 instances (at most ~2,400 re-checks an hour) and 3,000 a day.
- Cost: a standard-2 (1 vCPU, 6 GiB) awake costs about $0.13 an hour at Cloudflare's container rates (memory
  $0.0000025/GiB-s, CPU $0.00002/vCPU-s), about $0.0001 a re-check. 64,000 re-checks a day (four busy hours) is
  **about $200 a month**; around the clock at that load, about $1,200.
- Recommendation, when real traffic gets near it: `max_instances` 16 and `ENGINE_DAILY_SEARCHES` 60,000 (≈ $200 a
  month at the cap), plus the cheaper wins first: cache analysed positions (Crowd games share openings) and re-check
  only cuts that matter (the bottom few places). Until then, today's 2 and 3,000 keep the worst case near $25 a month.

**Rough running cost at 10,000 players at once** (estimate; staging will give a real number): Durable Object time
≈ $0.0015 a match (a lobby awake ~15 minutes at 128 MB), so 100 matches at once around the clock ≈ $400 a month;
Worker requests ≈ $20 a day at that polling; D1 well inside the plan. Real traffic peaks a few hours a day, so a
fraction of that. Set the billing alerts in DEPLOY.md first.

**Staging results (Oct 8, 2026)** (`reports/load/staging-*.md`; staging torn down afterwards). **1,000 players**
(60 s ramp, 5 min each), on a warm database: all 1,000 played, no errors and no dropped sockets. PLAY p50 71 ms /
p95 ~0.5 s; heartbeat p50 37 ms; lobby moves (pick round trip) p50 228 ms / p90 734 ms; D1 0.3 writes/s. The
strain was guest sign-in: `/api/me` p50 15.7 s / p90 19.9 s, which also made PLAY-to-lobby 12 s p50; `/api/live`
p50 1.3 s. The first 1,000 run, on a brand-new database (`staging-1000-cold-db.md`), lost 596 players: every new
request ran the whole schema migration (644 CREATE statements) into the one database and `/api/me` timed out.
**5,000 players** (120 s ramp): only 1,177 got in. 3,823 failed at `/api/me` with 500s (plus 338 `/api/live` and
370 heartbeat 500s). The players who got in played normally: PLAY p50 58 ms / p99 447 ms, moves p50 63 ms, chat
48 ms. D1 2.1 writes/s. **The choke point is D1 on the sign-in path**, made worse by a feedback loop:
`ensureSchema`'s `meta` read is `.catch(() => null)`, so a busy or timed-out D1 looks like "no schema" and the
request runs the ~35-statement migration (383 CREATEs on a warm database at 5,000). Proposed fixes, for `ops`:
(1) in `ensureSchema`, only migrate when `meta` is really missing (rethrow other errors) and share one in-flight
promise per isolate; (2) make guest creation one `db.batch` (insert user, insert session, read profile) instead of
~10 sequential round trips; (3) cache `/api/live` across isolates (KV or the LIVE Durable Object) rather than per
isolate; (4) re-run 5,000 on staging, then 10,000 from two machines.
