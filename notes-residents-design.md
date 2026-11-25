# 200 resident players: a living soft launch (design, Nov 25)

Eric (Nov 25): "a big thing I think we need to do is literally have 200 bots made which just sit on the server and play ranked, play
50v50 ... so like any time of day I can login and see games played, we need to simulate a small soft launch as much as we can, should
see them on the leaderboards, etc. ... the main thing is playing the game modes and seeing what we learn from this and what needs to
be fixed".

A design only: nothing deployed, nothing spent, no sims run. Lane `ops`. Every claim below cites the code or doc it comes from.

## 0. The short version

- **Residents are real accounts with a stored flag (`users.resident` = 1)**, made and signed in through a new admin route copied
  from test accounts (`packages/server/src/test-accounts.ts`). Unlike test accounts they **count on rankings** ("Top N%", 1 v 1's
  top places), because Eric wants to see them there.
- **They run outside the game's servers as headless clients** (a Node program, `scripts/residents/`, grown from
  `scripts/cheater-demo.ts`, which already plays real 50 v 50 on hunchess.com through an Access service token and answers judge
  work with real Stockfish and Maia). They use the same HTTP and WebSocket paths as the app, so what breaks for them would break
  for players.
- **Where that program runs: a Cloudflare Container in Eric's account** (recommended; about **$35-55 a month** for the container,
  about **$50-80 a month** in all). The cheap alternative is a small VM elsewhere (about $5-9 a month, but a new account for Eric).
  GitHub Actions is ruled out (section 1).
- **One kill switch, `PAUSE_RESIDENTS` = "1"**, enforced by the **server**, not the program: every request from a resident
  session gets a 503, every resident socket is closed (their seats go to bots under the usual leaving rules), and the cron stops
  the container. It works even if the program has gone wrong.
- **One purge** (`DELETE /api/admin/residents`, a dry run first) that **hard-deletes** every resident row in all 50 D1 tables. It
  does not use "Delete account", because that keeps results under `deleted` and keeps ledger rows. A test fails when a new table
  isn't covered.
- **Fair play:** residents play Maia moves. Their signals are recorded and shown, but no case ever opens for them, their reports
  never count, they're never pooled, and they get no deep re-checks. The dashboard shows how many of them **would have been
  flagged**, which gives us a false-positive rate on a human-like population for free.
- **The order:** server pieces first (full lane), then 1 v 1, the always-on host, a dashboard, then 50 v 50, then crates and the
  town, then Squads. Raids and the tower come last, if ever: residents can't host a boss (section 3, PR 8).

## 1. The director's calls (kept), and where the residents run

**Kept as given:** production (hunchess.com), not staging. 200 real accounts with a stored resident flag, through the real paths
with real judging. One kill switch, one purge. Modes in the order 1 v 1, 50 v 50, Squads, then raids and the tower if cheap; crates
in phase 2. Maia-like moves; no resident is ever flagged; residents never report anyone.

**One call changed, with its reason:** "200 accounts, ~40 online on average" asks each resident to play about 4.8 hours a day
(200 x 4.8 h / 24 h = 40). A real player base has 10 to 20 accounts per player online at once. Accounts cost nothing, so the
count is a setting (`RESIDENTS.accounts`, default 200), and so is the target (`RESIDENTS.targetOnline`, default 30, waves between
about 15 and 55). The scheduler gives each resident at most 6 hours a day. Raising the count to 400-600 for realism is a one-number
change. All costs below are worked out at **40 online on average**, as the brief asks, so they're an upper bound.

### The options weighed

| | (a) Inside Cloudflare (a Residents Durable Object driving internal players) | (b1) GitHub Actions cron, 6 h jobs back to back | (b2) A Cloudflare Container running the headless program (**recommended**) | (b3) A small VM elsewhere |
|---|---|---|---|---|
| Real paths exercised | **No.** Internal players skip the edge, Access, the Worker's routes, the rate limits and the WebSocket client. | Yes | Yes (its traffic leaves the container and comes back through the public edge and Access; **verify in PR 3**) | Yes |
| Where moves come from | Nowhere good. A Durable Object has 128 MB and CPU limits: Stockfish's full network plus Maia's 25 MB model and onnxruntime don't fit. The only other choice is the engine server, which would eat its budget. | Node's Stockfish (WASM, the browsers' build) and Maia (`packages/maia-worker` cli), as cheater-demo does | Same as b1 | Same as b1 |
| New code | The most, and it lives **inside the production Worker** (a bug there is a bug in the game) | The program, a workflow that starts its own next run, and a watchdog cron | The program, a generic image (Node plus git), a container class and the existing 15-minute cron pinging it | The program, plus a systemd unit and a script that pulls `main` |
| Ways to break | Shares the objects real players use | Cron runs are often 5 to 30 minutes late and sometimes dropped. A 6 h cap means all residents leave mid-game four times a day. It takes 1 of the 20 concurrent job slots that CI's 15 shards need. Logs are public (public repo). **GitHub's terms bar Actions for "serverless computing" and anything not about building or testing the project, and a 24/7 player farm is close enough to put CI at risk.** | A container restart (host maintenance, or a deploy if it turns out to restart it) is the same as every resident reloading: they sign in again and rejoin. | A box to keep patched, holding a production token |
| Cost a month | DO time plus engine-server time (both high) | $0 | ~$35-55 (below) | ~$5-9 |
| Needs Eric | — | Two repo secrets | A new Access service token (free), a one-time image push, OK to spend | A sign-up and card with a VM provider, a token, OK to spend |

**Recommendation: (b2), the Cloudflare Container.** It keeps everything in one account (Eric's standing preference, Oct 3), adds
no machine to look after, and stops with the game's own switch. The image never changes: at boot it clones `main` (the repo is
public, so no credentials), runs `npm ci` and starts `scripts/residents/run.ts`. A code change reaches it at its next restart,
with no image rebuild. This matters because the engine image is pushed by hand (`DEPLOY.md`: "build and push the image from a
machine with Docker"); here that happens **once**. If Eric would rather save about $30 a month, (b3) runs the same program
unchanged (`git pull` and restart on a timer). Only the host differs.

How it stays up: the existing `*/15 * * * *` cron (`wrangler.jsonc` `triggers.crons`) pings the container (`sleepAfter` about 30
minutes) unless `PAUSE_RESIDENTS` is set, and stops it if it is. No new Durable Object or alarm is needed. The program also
watches `/api/version`: after a deploy it lets its games finish, then restarts and pulls the new `main`, as a real tab reloads.

**What the program reuses** (from `notes/swarm-audit.md`, section 1):
- `scripts/cheater-demo.ts`: Access headers, the account route, the 50 v 50 seat (hello, speed, votes, picks, `judge` /
  `planBots` / `hostScore` answered with the app's own code: `runJudgeJob`, `judgeBotPicks`, `TopMovesCache`), Maia "drawn as
  people play" at a rating, and the boss-final resign.
- `scripts/load/player.ts`: the 30 s heartbeat, reconnect with backoff, quick chat, the PLAY queue's "busy" ticket. Its random
  moves and made-up host scores are **not** reused: residents never send a made-up number.
- `e2e/squads-client.ts` and `scripts/squads-headless.ts` for Squads (PR 7).
- New: the 1 v 1 client (`/api/1v1/*`, the `DuelGame` socket, clock-aware think time), the scheduler, behavior profiles and the
  heartbeat to the dashboard.

**Engines in the program:** a shared pool of 3 to 4 Node Stockfish (`STOCKFISH_FULL_BUILD`, single thread, the browsers'
computer build) and one Maia process. Residents declare themselves computers (`speed` with the pool's measured nodes per second,
as cheater-demo does), so the lobby pairs them with computers (`drawJudges`, `kindOf`). Two honest answers are identical
(`JUDGES.tolerance` 0, `reports/judge-determinism.md`: "identical numbers on separate engines, used or fresh"). When two residents
judge the same job, the program searches once and answers both. Otherwise the second answer arrives after the grace
(`graceMs` 150), and the lobby sends a quarter of lone answers to the engine server as spot checks (`spotCheckShare` 0.25).

## 2. Running cost per month (200 residents, 40 online on average)

**The activity this assumes:** 50% of online time in ranked 1 v 1 (20 residents, 10 games at once, about 10 minutes each with
queue and versus), 35% in 50 v 50 (14 residents; lobbies formed in waves of 8 to 20 residents, so about 1.5 lobbies at once, about
20 minutes a match: `crowdMoveLimit` 60 team turns), 15% on home, profiles and the locker. That works out to about 1,440 1 v 1
games and about 100 50 v 50 matches a day.

**Prices** (Workers Paid, already on the account at $5 a month, from Cloudflare's pricing pages, Nov 2025):

| Item | Included | Over |
|---|---|---|
| Worker requests / CPU | 10M / 30M CPU-ms | $0.30 per M / $0.02 per M ms |
| DO requests (incoming WebSocket messages count 20:1, alarms count) | 1M | $0.15 per M |
| DO duration (128 MB per object; **not billed while hibernation-eligible**; all our objects use `acceptWebSocket`) | 400k GB-s | $12.50 per M GB-s |
| D1 rows read / written / storage | 25B / 50M / 5 GB | $0.001 per M / $1.00 per M / $0.75 per GB |
| Containers: memory / CPU (**active use only** since Nov 21, 2025) / disk | 25 GiB-h / 375 vCPU-min / 200 GB-h | $0.0000025 per GiB-s / $0.000020 per vCPU-s / $0.00000007 per GB-s |

**The working** (one month = 2.59M s = 720 h):

| Line | Working | $ a month |
|---|---|---|
| Worker requests | Home polls `/api/live` every 5 s (`FRONT_DOOR.livePollMs`): 6 residents give 1.2 a second. Queue asks and game HTTP: 34 residents x 1 every 30 s gives 1.1 a second. About 2.5 a second, so 6.5M (13M with double the traffic). | **$0** (up to $0.90) |
| Worker CPU | 6.5M x ~3 ms = 20M CPU-ms | **$0** |
| DO requests | WebSocket messages in: 1 v 1 about 2.7 a second (moves plus heartbeats), 50 v 50 about 2.1, together 13M divided by 20 = 0.65M. Matchmaker asks about 2.6M, hub calls about 1.5M, alarms about 1.3M, game calls about 1M. About 7M, so 6M over. | **~$0.90** |
| DO duration | With hibernation, objects are billed only while busy. The matchmaker holds a long-poll ask nearly always (about 100%: 324k GB-s), the hub about 50% (162k), 12 game objects about 20% (778k), 1.5 crowd lobbies about 50% (243k). 1.5M minus the included 0.4M = 1.1M GB-s. If nothing ever hibernated (the worst case): 5.0M GB-s, $58. | **~$14** (at most $58) |
| D1 writes | Per resident per counted game about 30 rows (results, ranked rows, ledger legs and wallet, quests 3-5 plus `quest_games`, `fairplay_matches`, with indexes): 1 v 1 86k a day, 50 v 50 about 43k a day, `last_seen` 58k a day. About 6M a month. | **$0** |
| D1 reads | Ban gate (one a minute per session per instance), the "Top N%" counts, game reads: well under 1B | **$0** |
| D1 storage | About 65k new rows a day x ~300 B is about 20 MB a day, 0.6 GB a month: under the 5 GB included for about 6 to 8 months. Watch the size of `fairplay_matches.summary`. | **$0** for now |
| Engine server | **$0 by design:** a lobby whose people are all residents never asks the engine server (its judges re-check close calls, as with `ENGINE_OFF`), and residents get no deep re-checks. Otherwise residents would keep its `standard-2` container (6 GiB) awake all day (about $40-60 a month) and use up the 3,000 re-checks a day (`ENGINE_DAILY_SEARCHES`) and fair play's 500 (`FAIRPLAY.deep.dailySearches`) before Eric's own games. Lobbies Eric is in use it as normal. | **$0** |
| The residents' container | A custom 1 vCPU / 3 GiB / 8 GB (the smallest custom size allowed: at least 1 vCPU and 3 GiB per vCPU). Memory: 2,160 - 25 = 2,135 GiB-h, so $19.20. CPU at 0.3 vCPU on average (Maia about 30 ms a pick; judge jobs at 250k nodes, `engineNodes`; re-checks at 700k, `recheckNodes`, in residents-only lobbies): 12,960 - 375 = 12,585 vCPU-min, so $15.10. Disk: 5,760 - 200 = 5,560 GB-h, so $1.40. If custom sizes aren't offered, `standard-2` (1 vCPU / 6 GiB / 12 GB) is about $56. | **~$36** (up to $56) |
| Access service token | Zero Trust's free plan | **$0** |
| **Total** | | **~$50 a month** (range about $40-80; ~$20-35 with a VM instead of the container) |

Every line except the container is the game's real cost per concurrent player. **The resident dashboard should show it**: what
40 people online really costs is one of the most useful things we'll learn, in time for launch.

**What needs Eric:**
1. **OK to spend** about $50 a month (or say "VM", about $5-9 a month plus a Hetzner-style sign-up and card).
2. **A new Access service token, "residents"** (Zero Trust, Access, Service Auth; free), added to the Worker's secrets so the
   container can get it. A separate token from `CF_ACCESS_CLIENT_ID2`, so it can be revoked alone. Its client ID goes in
   `RESIDENTS_CLIENT_ID` (`wrangler.jsonc` `vars`; an identifier, not a secret).
3. **The image's one-time push** (`npx wrangler containers build ... --push`). The director can do it if
   `CLOUDFLARE_API_TOKEN` has the Containers scope; otherwise Eric does, once.
4. Nothing else: no domain, no new paid plan.

## 3. The plan in PRs

The full lane is used wherever stored data, accounts, security or fair play change (CLAUDE.md, "Test lanes"). Effort follows
CLAUDE.md's tiers. One Opus helper at a time (RULES.md, Nov 13).

| # | PR | Lane | Effort | Helper-days | What Eric sees after it |
|---|---|---|---|---|---|
| 1 | **Server foundations**: the flag, the route, the kill switch, the purge, fair-play and engine guards, the host rule | **Full** (`full-e2e`, independent review, delta re-reviews) | `xhigh` | 1.5-2 | Nothing in the game yet. The director runs the purge's dry run on production (0 rows). |
| 2 | **The program plus ranked 1 v 1** (`scripts/residents/`): names, looks, schedule, profiles, the 1 v 1 client, the heartbeat | Targeted (a script; its unit tests; a local run against `wrangler dev`) | `high` | 1.5 | A first 2-hour run from a director session (as cheater-demo ran): 200 accounts, 1 v 1 games, residents on the live count, his own queue meeting one |
| 3 | **The always-on host**: generic image, container class, cron ping and stop, version-aware restart | **Full** (a production token moves into a container: security) | `xhigh` | 0.5-1 | 1 v 1 played around the clock. Residents in "Top N%", on profiles, on the live line any time he logs in |
| 4 | **The resident dashboard** (a card on `/admin/ops`) | Targeted | `high` | 1 | Who's online by mode, games today, errors by kind, judge answer times, "would have flagged", cost per player, the kill switch's state, the purge's dry-run counts |
| 5 | **50 v 50**: the crowd client (from cheater-demo), waves, in-match behaviors, the boss-final rule | Targeted | `high` | 1-1.5 | Full 50 v 50 lobbies with 8-20 residents among the bots, any time; his PLAY usually lands with them |
| 6 | **Crates, the locker and the town (phase 2)**: open earned crates, put on what they own, appear in the town's presence | Targeted (existing endpoints only; no server change). If a server change turns out to be needed, it goes to the full lane. | `high` | 0.5-1 | Residents in changing outfits, crate openings in their histories, people walking the town |
| 7 | **Squads**: fold in `squads-client.ts`, parties of 2-4 residents, singles | Targeted | `high` | 1-1.5 | Squads lobbies with residents |
| 8 | **Raids and the Battle Tower: not now.** A raid's boss moves and his powers' extras are always the host's (`bossRequest`, `phase2Ask`, … in `app/src/net.ts`, 1,634 lines). A headless host would mean moving that code where Node can use it. | — | — | 3-5 (estimate) | Recommend: skip until the town and Squads have taught us what they will |

Order: 1, then 2 (its first run is the proof), then 3 and 4 together, then 5, then 6 and 7. **Launch:** the purge, then
`RESIDENTS_CLIENT_ID` emptied, the token deleted and the container removed. These go on ROADMAP's launch checklist next to
`TEST_ACCOUNTS_CLIENT_ID`'s.

### PR 1, server foundations (full lane, `xhigh`)

- **The flag.** `users.resident INTEGER` (an `ALTER TABLE` migration, `accounts.ts`). Residents are **not** `test`: they stay in
  the "Top N%" counts (`accounts.ts` ~1226), 1 v 1's top places (`ranked-schema.ts` ~107) and name search (`friends.ts` ~394).
- **The route, `/api/admin/residents`**, a copy of `handleTestAccounts`. Its caller is an admin, the e2e key, or Access with the
  token `RESIDENTS_CLIENT_ID` names (empty: nobody).
  - `POST {name, look?}`: makes `<slug>@resident.hunchess` (no real domain, so no mail and no code sign-in), name through
    `cleanName` and the name filter. On creation only, it seeds 0 to 3 common locker items through the ledger (op
    `resident-seed:<id>`, purgeable) so looks vary from day one. It signs the program in, **reusing the newest unexpired session**,
    so restarts don't pile up session rows. Refused while `PAUSE_RESIDENTS` is set.
  - `GET`: the residents' list, today's numbers and fair-play summaries (what the dashboard reads).
  - `POST /beat`: the program's minute heartbeat (counts by state, errors by kind, judge times). The latest one is kept in D1
    `meta`; per-day totals come from `results` joined to `users.resident`.
  - `DELETE?dry=1`, then `DELETE`: the purge (below).
- **The kill switch, `PAUSE_RESIDENTS`** (the `PAUSE_<NAME>` family, `pauses.ts`, ops.md "Kill switches"):
  - the ban gate's place in `index.ts`: a resident session gets 503 "Residents are paused." on every `/api/*` route;
  - every Durable Object (Lobby, DuelGame, SquadsLobby, SquadsParty) refuses a resident's `hello` and closes resident sockets on
    their next message. Their seats go to bots by `LEAVING.awayMs` (120 s) at the latest, as for any player who leaves. 1 v 1:
    the resident's clock runs out, or the abort rule applies, as with a real disconnect;
  - the cron stops the container. Within seconds no new resident action is accepted; within 2 minutes every seat is a bot's or
    finished. A test checks each part.
- **Fair play** (`fairplay.ts`): a resident's judged moves are recorded as anyone's (`fairplay_matches`, its level and score).
  The step that opens or escalates a case returns early for a resident and adds 1 to a "would have: watch / review / pool" count
  on its row. No reports from residents count (like `reviewIfReported`'s `u.test IS NOT 1`, `fairplay.ts` ~485). Residents never
  enter the engine pool or its `.engine` queues, and the deep re-check's cron skips them. A real player's report of a resident
  is kept as usual (it's Eric's to read).
- **The engine server:** `serverOn` is false for a lobby whose connected people are all residents (`lobby.ts` ~3861: the judges
  re-check close calls themselves, as with no engine server). A real player joining turns it back on from the next round.
- **The host rule:** `pickHost` (`lobby.ts` ~1097) passes over residents while a non-resident is connected. Residents still
  judge. This is what lets Eric's device host a boss final, which residents can't play (PR 8). With no real person there, a
  resident hosts as cheater-demo's seats do.
- **The purge** is a **hard delete**, not `deleteAccount` (which re-keys results to `deleted` and keeps ledger rows:
  `test-accounts.ts` ~149). In one batch per resident chunk: every row whose user column is a resident, across the 50 tables
  (`users`, `sessions`, `results`, `ledger` with `ledger_accounts`, `wallets`, `inventory`, `equipped`, `equipped_items`,
  `series_crates`, `welcome_crates`, `boss_crates`, `boss_tokens`, `boss_token_drops`, `solo_battles`, `solo_games`, `quests`,
  `quest_days`, `quest_progress`, `quest_games`, `ranked_1v1`, `ranked_1v1_games`, `ranked_conduct`, `queue_waits`, `friends`,
  `friend_requests`, `friend_limits`, `blocks`, `invites`, `reports`, `chat_picks`, `chat_mod_log`, `claw_plays`,
  `tower_runs`, `tower_best`, every `fairplay_*`, `engine_calls`; `ops_errors` and `ops_reports` keep their counts with the id
  taken out). The live hub forgets them (online, global chat lines), as account deletion already makes it. The ledger: **whole
  operations** that touch a resident are deleted, every leg, so the 15-minute ledger audit stays balanced (its own test). 1 v 1's
  kept top places are worked out again afterwards.
  - **A guard test**, like `account-data.test.ts` ("fails on a table in neither"): every table in the schema must be in the
    purge's list or marked "has no user column". A table added later can't escape the purge unnoticed.
  - The dry run answers the count per table. The real run is done by an admin or the token, logged, and refused while any
    resident is in a match (the switch first).

### PR 2, the program and ranked 1 v 1 (targeted, `high`)

- **Names:** a fixed, reviewed list of 200 handle-style names in `scripts/residents/names.json` (for example `mossybishop`,
  `PawnStorm77`, `quietrook`). Never a real person's name or a hint of one (RULES.md), and never "bot" or "resident" in a name.
  Every name still goes through the server's filter.
- **Looks:** the seeded items plus pawn color and an icon from the free set, set once by `PATCH /api/me`.
- **Skill:** each resident has a fixed Maia rating drawn from a ladder-like curve (a bell around 1150 from 600 to 2200, steps of
  100, the same curve as the bots: `BOT_LOBBY.ratings`). Moves are Maia's, **drawn** from its policy (not its likeliest move), so
  they blunder as people at that level do. The hidden ratings then sort them out as a real ladder would.
- **Schedules:** each resident has a home time zone (about 55% Americas, 25% Europe, 15% Asia and Oceania, 5% elsewhere) and a
  daily shape (evening peak 18-23 local, a lunch bump, more on weekends). Each day it plays with some chance (0.3 to 0.9, its
  "keenness") in 1 to 3 sessions of 10 to 60 minutes. The scheduler tops up or holds back to stay near `targetOnline`, giving
  waves, not a flat line. Everything is seeded by resident and day, so a restart reproduces the same day.
- **Behaviors** (small shares, set per resident, in settings): normal 70%; slow 8% (thinks near the clock, flags now and then);
  leaver 5% (leaves about 10% of its games midway); AFK 4% (misses picks; in 50 v 50 that ends in "Removed for being away");
  chatty 8% (quick chat presets only, never typed text); rage-quit 5% (logs off after a loss, sometimes resigns a lost 1 v 1
  early); and in any profile 2% of games drop the socket and come back with the seat token. These go through ranked's leaving
  rules for real (dodges, lockouts, the delayed queue: `ranked.md`, "Leaving early"), which is part of what we learn.
- **1 v 1:** the queue (`/api/1v1`, asking again with the ticket), the stage's vote (a pick by temperament), first-move rules,
  think time by the clock and the position (more when in check or when Maia's lines are close), and draw offers rarely. Two
  residents queue alone now and then, so **a queuing Eric usually meets one within seconds**.
- **The heartbeat** to `POST /api/admin/residents/beat` each minute.
- **Device cookies:** every resident keeps its own cookie jar (session and fair play's device marker), as separate browsers
  would. One shared jar would break 1 v 1 ("never two accounts on one device", the hashed device on the ticket) and tie the
  residents together in fair play.
- **Proof:** unit tests for the scheduler and profiles; a local run against `wrangler dev`; then a 2-hour run on production from a
  director session, results read on `/admin/fairplay` and the profiles.

### PR 5, 50 v 50 (targeted, `high`)

- The crowd seat from cheater-demo: hello, `speed`, the pre-game and final votes, picks by Maia at the resident's rating, power-ups
  now and then, quick chat, and honest answers to `judge`, `planBots` and `hostScore` from the shared engine pool.
- **Waves:** about every 8 to 12 minutes the scheduler sends 8 to 20 of the residents who are online to PLAY within the same
  minute, so they land in one lobby (`MATCH_FILL_SECONDS` 60). With a trickle instead, most lobbies would hold one resident,
  who would score alone (`pickHost`) and the match would be **unvouched: paid as solo and unranked** (`LobbyRecord.unvouched`).
  **A real launch with few players has the same problem**, and the residents will show how often it happens.
- **The boss final:** residents vote for the team final or the duel. If the Hidden Boss wins the vote anyway: with Eric there,
  his device hosts (PR 1's host rule) and residents play on; with no real person there, residents resign as its intro begins
  (cheater-demo's rule), the match ends, and the dashboard counts it.

### PR 6, crates, the locker and the town (phase 2)

Open earned Winter Crates and boss picks through the same endpoints the app uses, now and then put on something new, and appear in
the town's presence through its poll (`town-here.ts`). Residents never buy anything with real money and never type in the town's
chat. If either is wanted later, canned lines go through the filter.

## 4. Risks

**To real play and Eric's account**
- **Eric's ratings move when he plays residents.** Fine, per the brief. The purge leaves his ratings, XP and results. At launch,
  Eric picks: keep them (the default) or reset his ratings (one option on the purge).
- **The purge can't touch** Eric's own rows from games with residents (his crowd placements among them, his 1 v 1 history,
  ratings, XP and quests), aggregate counters (`engine_usage`, `fairplay_budget`, the counts in `ops_errors`), D1 Time Travel's
  30 days of backups, Discord alert history and Cloudflare logs. Everything a resident owns is purged cleanly. The one subtle
  part is the ledger, handled by deleting whole operations under its audit's test.
- **Residents never report, never send friend requests, never type chat.** If Eric friends or reports one, the purge clears it.
- **Device bans:** each resident has its own cookie jar, so a resident Eric bans by hand marks only that resident's jar. Bans
  key on devices, not addresses, so the residents' shared egress address links nobody.
- **Hosting:** with PR 1's host rule, Eric's device hosts whenever he's in a lobby. A resident never decides a round for him
  alone.
- **Judging pairs:** if Eric plays on his phone and draws a resident judge (a computer), the lite and full networks can differ.
  That's the existing dispute path (a third device plus the engine server's verdict; `blameMargin` 4), not a new risk, and
  residents will exercise it.
- **A slow program slows rounds:** if the container falls behind, residents answer judge jobs late, which means lone answers,
  spot checks and benches. The dashboard shows judge answer times, and the pool's size is a setting.

**Load on the single objects:** at 40 online the matchmaker and the live hub see a few calls a second, against about 1,000 a
second per object (ops.md). There's nothing to fear here. These objects are what to watch at launch scale, not at this one.

**The engine server's daily re-checks:** spared by design (residents-only lobbies don't ask it, and residents get no deep
re-checks). Without that rule, residents would use the 3,000 a day and fair play's 500 before Eric's games each day, and keep its
container awake.

**Fair play:** the signals are recorded and shown, nobody is flagged, and the residents' would-flag rate is a free
false-positive measurement. The risk is a resident's report or case reaching a real person: residents never send reports, and
PR 1 makes the server ignore any that arrive.

**Security:** a production Access token sits in the container's environment. It has its own client ID, is revocable on its own,
and the route accepts only it. The repo is public, so the program never logs cookies or tokens. Before launch the token is
deleted and `RESIDENTS_CLIENT_ID` emptied.

**Noise:** the residents' own errors are real errors and stay in `ops_errors` and the Discord alerts (that's the point). The
morning digest gains a "residents: N of M players" line so Eric can tell them apart.

**Deploys:** each deploy restarts Durable Objects and drops every socket. Residents reconnect as real players would, so any bug
in that path will show up in their numbers. Worth knowing before launch.

**To verify in PR 3, not assumed here:** that a container's outbound requests to hunchess.com pass through the public edge and
Access as an outside client's do, whether a Worker deploy restarts a running container, and whether custom instance sizes are
offered on the account.

## Sources

- Cloudflare Containers pricing: https://developers.cloudflare.com/containers/platform/pricing/ (CPU billed on active use since
  https://developers.cloudflare.com/changelog/post/2025-11-21-new-cpu-pricing/)
- Durable Objects pricing (duration, hibernation, the 20:1 WebSocket rule): https://developers.cloudflare.com/durable-objects/platform/pricing/
- Workers and D1 pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Code and docs: `docs/areas/{ops,accounts,ranked,matchmaking,crowd,engine,fairplay}.md`; `packages/server/src/{test-accounts,lobby,accounts}.ts`;
  `packages/core/src/settings.ts` (`JUDGES`, `CROWD_SETTINGS`, `FAIRPLAY.deep`); `scripts/cheater-demo.ts`; `notes/swarm-audit.md`.
