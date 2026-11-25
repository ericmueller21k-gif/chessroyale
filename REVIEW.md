# Review: PR #931, residents, server side (`claude/residents-server` @ 9b19454e)

Independent, read-only review against `main` (182972e5), Nov 25. Read: the diff, `notes/residents-design.md` (§0, §1, §3 "PR 1", §4),
`notes/briefs/residents-1-server.md`, CLAUDE.md, `docs/areas/{accounts,fairplay,ops}.md`. Ran the PR's server tests in a detached
worktree: `residents`, `lobby`, `judges`, `account-data` all pass (108 tests). Two throwaway probe tests (not pushed anywhere) back the
findings marked **(probe)**.

**Verdict: no blockers.** The things that would make this unsafe to run on production tonight all hold:

- **Route access.** `/api/admin/residents` answers only an admin's session (changes only from the site's own origin), the e2e key
  (32+ characters, unset in production), or an Access JWT whose `common_name` is pinned to `RESIDENTS_CLIENT_ID` (empty) or
  `TEST_ACCOUNTS_CLIENT_ID`. Everyone else gets 404. The health view's token can't reach it.
- **Real accounts can't become residents.** The only write of `resident = 1` is the route's `INSERT … ON CONFLICT (email) DO NOTHING`,
  and an existing non-resident address gets 409. `@resident.hunchess` can't receive a sign-in code. The DOs read `resident` from the
  session (`userFromToken`), never from the client.
- **Sessions.** `residentSession`'s `DELETE … WHERE user_id = ?` only ever gets a verified resident's id. An admin caller is never signed in.
- **Kill switch.** A variable change is a deploy, so every DO socket drops. On reconnect the gate in `index.ts` refuses a resident's
  cookie with 503 before routing (the WebSocket upgrades too). The DO checks back that up, and all four socket-accepting DOs (Lobby,
  DuelGame, SquadsLobby, SquadsParty) have them. The Matchmaker's tickets are in memory, so the deploy clears queued resident tickets.
  A non-resident is never refused: the gate's read fails open and needs `users.resident = 1`.
- **Fair play.** Every automatic `by` that calls `setCase` / `raiseCase` is covered ("detection", "reports", "evasion", "reviewer";
  "auto" only closes). `decide`, `relevel`, evasion in `banCheck`, `reviewIfReported` and the deep queue all skip residents. A real
  cheater can't look like a resident.
- **Stored data.** `SCHEMA_VERSION` is a hash of `COLUMNS`/`AFTER_COLUMNS`, so the two `ALTER TABLE … ADD COLUMN` (nullable, O(1) on live
  rows) and the partial index run once on the first request after deploy. The seed is one item-only ledger op, written together with its
  `items` rows, so the ledger audit reconciles (tested with `ledgerMismatches`).

---

## Blockers

None.

## Majors

### M1. `residentsOnly` keys on *connected*, so Eric's own rounds skip the engine server whenever his socket blips

`packages/server/src/lobby.ts:232`:
`residentsOnly = r.humans.some(h => h.resident) && !r.humans.some(h => h.connected && !h.resident)`

**Scenario.** Eric plays 50 v 50 on his phone with 10 residents. Picks lock, and he locks his screen or switches apps (the moment people
look away is exactly when judging runs). His socket closes, `disconnect()` sets `connected = false`, and `residentsOnly` is now true.
Then `serverOn` (lobby.ts:3720) and the lobby-do `scores` re-check (lobby-do.ts:640) are off. So for the round that judges **his own
pick**, the close-call re-checks (4065, 4073), the dispute verdict (`askVerdict`, 4180) and the spot checks of lone answers (4211) are all
skipped. The judges' numbers stand alone, and his judges are very likely residents (computers are preferred). He's back in 3 s, but the
round has been decided. This repeats every time his phone backgrounds, for up to `LEAVING.awayMs`. It breaks the PR's own promise ("a
real person connected turns it back on"), the brief's spirit ("never compromise the game") and the question this review was asked: *yes,
a lobby with Eric in it can skip the engine server.*

The practical damage is limited, because resident judges run honest Stockfish and `tolerance` is 0. But the engine server's job here is
to check exactly those devices, and residents will be most of every lobby's devices.

**Fix (one token).** Drop `h.connected &&`. A seat that has left the match (resigned, or gone past `awayMs` and handed to a bot) is
already removed from `r.humans` (lobby.ts ~1585 `this.r.humans = this.r.humans.filter(…)`). So
`!r.humans.some(h => !h.resident)` means "no real person is still in this match". The cost is that the engine server stays on for at most
`awayMs` after a real person really leaves.

**Test.** `judges.test.ts` "residents alone … a real person connected turns it back on" currently asserts the gap: its `"p3 away"` case
expects **0** server asks. It should expect 1, the same as `"p3"`.

## Minors

### m1. When a real person reconnects, the host isn't re-picked: a resident keeps in-flight host work while Eric is back **(probe)**

`lobby.ts:1268` and `:1180`, with `resendHostWork` at `:1677`.

**Scenario (confirmed by probe).** Eric is hosting, and the lobby is in `scoring` (not judging). His phone drops. `disconnect()` makes
`pickHost` choose the resident, and `resendHostWork()` sends it the `scoreRequest`. Eric reconnects 2 s later: the existing-seat path
keeps `hostId` (the resident is connected), and the resident's `scores` are accepted with Eric connected (probe: phase `reveal`,
`hostId = p2` the resident, Eric `connected: true`). In a **boss phase**, the same path sends `sendBossRequest` to a resident, which the
program can't answer (design PR 8). Eric's return doesn't take the move back, so the boss waits for `bossTimeout`. That stall happens only
if residents are still seated in the boss phase: PR 5's "boss-final resign" must be reliable, or the server should stop this.

**Fix.** In `connect()`'s existing-seat path, when the returning seat isn't a resident and the current host is one, set
`this.r.hostId = this.hostNow()` and `resendHostWork()`. The resident's late answer is then ignored (`scores` and `bossMove` are
accepted only from `hostId`). **Test:** add the probe's case to the lobby test ("Eric drops in scoring, returns, re-asked; the
resident's answer is dropped").

### m2. "Would have" counts are per match and sticky, so the dashboard's false-positive number is inflated **(probe)**

`fairplay.ts:569-570` and `:591-595`, read by `residents.ts:256`.

**Scenario (probe).** A resident has 2 engine-like matches, then 8 human-like ones. All 10 rows get `would = 'review'`, because the
level reads the history window, and the report says `would.review: 10`. Every later match keeps saying "review" until the window rolls
off. The pool branch is worse: `newAccountPoolReason` looks at the **first** `pool.newGames` matches. For a real account that fires
once and the case becomes `pool`. A resident never gets a case, so once its first 10 matches trip the rule, **every** later match is
re-marked `'pool'`, forever. The design's "how many of them would have been flagged" (a false-positive rate per population) can't be read
from these counts.

**Fix.** Keep the column, but make the report count **distinct residents** per level (`COUNT(DISTINCT user_id)` by `would`, or each
resident's worst). Or store `would` only when it rises above that resident's previous row (the transition a real case would make). Do it
in PR 4 at the latest, and say in the decision file which one.

### m3. The Hidden Boss's phase 2 still calls the engine server for a lobby of residents alone, and `engine.md` says it never does

`lobby.ts:872-873, 2874, 2929-2934` (`phase2Search` and `warm` from `io`) aren't gated by `residentsOnly`. `docs/areas/engine.md`:
"a Crowd, raid or Classic lobby whose connected people are all residents never asks it". A residents-only Crowd lobby that reaches the
Hidden Boss final would have his moves searched (and the container woken) by the engine server. That happens unless the program always
resigns first (PR 5), and with no person to host, his own move always falls to `askHis`. The brief said "as `ENGINE_OFF`", and
`ENGINE_OFF` removes `phase2Search` (lobby-do.ts:128). **Fix:** gate `search` and `warm` in `phase2Lobby` on `!residentsOnly(lobby.r)`
(phase 2 then takes its existing "no result" path, which is fine for residents alone). Or change the doc to say "except the Hidden Boss's
phase 2" and rely on PR 5's resign.

### m4. Residents' picks are part of a real player's "crowd" for fair play's hard finds

`lobby.ts:4496-4521`: `crowd` / `crowdFound` / `picks` are built from every human pick, residents included. So the residents' Maia
strength sets the baseline that real players' (Eric's) hard-find signal is measured against. If residents play weaker than real
players, a real player's ordinary good moves look "found by few". The prompt asked whether a resident's detection can touch a real
player; this is the one indirect way it can. **Fix:** either decide and record it (realistic: residents stand in for people), or
leave resident picks out of `others` for a non-resident's `FairMove`. One line in a decision file either way.

### m5. Tests that don't prove what they say

- `residents.test.ts:402-424` "1 v 1 … a seated one's next message closes it, **a disconnect**" asserts only that the stored record
  changed (`not.toBe(seen)`). Any write passes it. Assert the side's connected/away state in the stored game instead.
- The Squads tests (`:426-455`) cover only the refused `hello`. Neither room tests "a seated resident's next message closes it and its
  seat leaves" (the `gone` callbacks, including `towerUpkeep`).
- Only the Lobby test reaches `resident` through the room's own door (`fetch` + session). DuelGame and both Squads rooms get hand-built
  attachments (`resident: true`), so `duel-do.ts:220`'s `account!.resident === 1` and `squads-do.ts:82`'s `whoIsAsking` marking are
  untested. Typecheck covers the property names, but not the wiring.
- `judges.test.ts` "p3 away" locks in M1.
- The host test doesn't cover a reconnect during `scoring` (m1).

### m6. For PR 3: `/api/admin/health` accepts *any* service token of the Access app

`ops-admin.ts:52` calls `viaAccess(request, env, now)` without pinning a client (`OPS_ACCESS_CLIENT_ID` isn't in `wrangler.jsonc` vars).
Unless it's set as a secret, the residents' token (and today the test accounts' token) can read the health view. This is pre-existing
and not this PR's code, but PR 3 is where a production token moves into a container. **Fix:** set `OPS_ACCESS_CLIENT_ID` to the health
script's client ID, and put a line in PR 3's security notes.

## Nits

- **n1.** `residents.ts:321`: `keepBeat` reads the whole body (`request.text()`) before the 16 KB check. Only trusted callers reach it,
  but checking `content-length` first is free.
- **n2.** `residents.ts:341-352`: the pause cache is keyed by the raw session token. Key it by the hash you already compute.
- **n3.** While paused, the program's `GET /api/admin/residents` with a resident's cookie gets the gate's 503, not the report. The program
  (PR 2) and dashboard (PR 4) should call the report without a resident cookie.
- **n4.** `residents.ts:332`: `banAnswer` ends whichever session the request carried and marks the caller's jar banned. If the program
  ever sends another resident's cookie (or the director's script shares one jar), a banned resident signs that one out. PR 2: one cookie
  jar per resident (the design already says so).
- **n5.** `residentEmail` folds "Mossy Bishop", "mossy-bishop" and "MOSSY  BISHOP" into one account, and the answer carries the first
  name. The program should take `name` from the answer, not its request.
- **n6.** `lobby-do.ts:691`: `markResident` runs after `core.connect()`, so the seat is unmarked while `connect()` runs, and `connect()`
  can call `startMatch()`. Harmless today (nothing there picks a host or asks the server). Passing `resident` into `connect()` would make
  it hold by construction.
- **n7.** `residentAccount` isn't atomic. If the request dies between the `INSERT` and `seedLocker`, the resident is never seeded (a retry
  sees `created: false`). The only effect is fewer seeded items, so it's fine to leave.
- **n8.** The heartbeat is arbitrary JSON from the program: PR 4's dashboard must render it as text.
- **n9.** The host order "trusted people, trusted residents, then anyone" means a **benched** Eric device loses hosting to a trusted
  resident. That's reasonable and recorded (*mine* in the decision), but the design's §4 line "Eric's device hosts whenever he's in a
  lobby" should say "unless benched".

## Changed checks

The PR edits `account-data.test.ts` (two column lists) and `recluse-online.test.ts` (one mocked SQL string to match the new `SELECT
rating, resident`). Neither weakens a guard. No test was removed. `docs/rules/eric.md` guards weren't touched.
