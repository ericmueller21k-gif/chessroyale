# Independent review: PR #618, the engine pool (one round, read-only)

Branch reviewed: `claude/engine-pool` at `12e443f`. Lane: full (fair play and matchmaking). Read: CLAUDE.md, the diff, the decision note,
the brief it answers, `docs/areas/fairplay.md`, the queue, Squads party, lobby, deep re-check and admin code it touches.

Tests: the server unit tests and core's fair play tests on the PR's code: **81 files, 1121 tests, all pass**. My proofs are in
`zz-review-engine-pool.test.ts` (on this branch; drop it into `packages/server/test/` to run). All 4 pass on the PR's code, which shows
each defect as it stands; the fix flips the marked line. e2e: not run here (CI runs it).

**No blockers. Four majors, three of them small fixes.**

---

## Majors

### M1. The pool's JSON download contains admins' email addresses
`packages/server/src/admin.ts:252` builds each player's file with `caseDetail(..., { email: false })`. That leaves out the player's own
email, but not the log's `by` ("admin:eric@…"), `case.decided_by`, appeals' `decided_by`, or emails typed into reasons. `forReviewer`
(admin.ts:532) scrubs exactly these for the reviewer's API, but the export never calls it.

- **Failing case** (proof M1): Pat is pooled, Eric releases Pat, then Pat plays another match at the bar and is pooled again. The
  download now contains `eric@example.com` in Pat's log and in `case.decided_by`. The PR's own test (`not.toMatch(/@/)`) passes only
  because its players have never had a person's decision. The brief says "no emails in the download", and this file is meant for an
  article.
- **Fix:** `file: d && forReviewer(d)` (or apply `byForReviewer`/`noEmails` to the export's log, case and appeals). Extend the PR's test
  with one admin decision before the export.

### M2. The "getting crushed: likely a false positive" hint fires on Boss Battle losses, even for a player still playing at the ban bar
`poolHint` (admin.ts:241-244) adds crowd-mode team results (`team_won = 1 OR placement = 1`) to 1 v 1 results. If fewer than 30% are
wins, it says "getting crushed: likely a false positive", and it checks that before "still playing like an engine". But in the pool,
crowd games are almost all against bots. Most of these results don't measure what Eric asked for ("if they start getting crushed" by
other engine players):

- In Boss Battle, the boss wins most raids for everyone (the crowd scores 0.15 to 0.45 in the boss sims). So nearly anyone who plays
  raids is "crushed", cheater or not.
- In 50 v 50 with ~98 bots, the team result is close to a coin flip, whoever the player is.
- **Failing case** (proof M2): Pat is pooled at the ban bar. In the pool, Pat plays 5 raids that the boss wins, and one more match at
  the bar (in-pool deep match 20 of 20). The list tells Eric: "getting crushed: likely a false positive". This is the line Eric uses
  to decide Release.
- **Fix (small):** base "crushed" on results against people only: 1 v 1 games against pooled players (`vsPool`), at least 5, scoring
  under 30%. Show crowd and raid results as plain numbers, never in the hint. Check "still playing like an engine" first: in-pool
  engine play outranks any result. Optionally compare in-pool match strength (`avgPerf`) with the strength that pooled them. A big
  drop is the crowd-mode version of "crushed".

### M3. An honest player can be pooled automatically by two lying judges (the #610 review's M1, still open), and nothing tells Eric
The PR changes `review-b2.test.ts:77`. That test's honest player has obvious moves reported as hard by two lying judges, and used to
end in **review** (a person looks). With this PR the same player ends in the **pool**, silently. The decision note accepts this
("the bar rests on judges' numbers … unlike a ban, the pool is reversible"). `ROADMAP.md` (fair play) also lists M1 steps 1-3 as
needed before detection acts on its own.

What changed is how the player gets out. A pooled player is never told and can't appeal. The only way back is Eric spotting them on
the list, and M2's hint is the wrong tool for that. Also note that one match is enough: `atBanBar` via `playerLevel` pools any account,
new or old, on one match. Eric's words for new accounts were "2 out of the first 3".

- **Failing case:** `review-b2.test.ts`, "M1: an honest player's obvious moves, reported by lying judges…", on this branch: status
  `pool`, and the reviewer gets 409.
- **Fix (Eric's or the director's call, cheapest first):**
  1. Pool on the level path only when the ban verdict covers **two matches from different lobbies**: the multi-match path, or a
     second one-match hit. A single match at the bar opens a review instead. Forged judges would then have to judge the same target
     in two separate lobbies.
  2. And/or keep the deep search's own second-best gap on each `deep` result (one more number in `deepResult`; M1 step 1). Show on the
     pool row how many of the deep-matched moves were only moves by the server's own numbers ("12 of 20 only moves: the judges' numbers
     may be forged").

If Eric keeps one match as the trigger, record it in the decision note as his call, with the M1 risk named.

### M4. The review page and the download run D1 queries for every pooled player; they stop loading as the pool grows
`poolPlayers` (admin.ts:163) runs about 6 queries per pooled player, and it runs on **every** load of `/admin/fairplay`
(admin.ts:517), whichever tab is open. The export (admin.ts:250) runs about 16 per player.

- **Measured** (proof m2, counted statements): list 31 queries for 5 players, 61 for 10. Download 81 for 5, 161 for 10.
- **Failing case:** D1 limits the queries one Worker request can make (1,000 on Workers Paid per Cloudflare's limits page; check the
  current figure). Past about 160 pooled players the **whole fair play page fails, appeals included**. The JSON download fails past
  about 60. Nobody leaves the pool on their own (deleted accounts' cases stay forever), so the list only grows. Eric wants the data
  kept for an article, and that is exactly what breaks.
- **Fix:** build the list with one query per column over all pooled players (`GROUP BY user_id` joined to
  `fairplay_cases WHERE status = 'pool'`). Show the "Engine pool" section only on the `pool` tab (or with a paged link from the main
  page). Have the export page through players (`?after=<userId>`, about 50 a file) or build each file with the same grouped queries.

---

## Minors

- **m1. The deep re-check checks pooled players' matches like a watch's** (`fairplay-deep.ts:154`, and the order at 134/141). A pooled
  match gets only 8 moves checked, and only off-peak, after watch cases. A review's matches are checked in full (proof m1: review 20,
  pool 8). As a result, the pool list's in-pool deep numbers and the kept data for the article are partial and late. **Fix:**
  `cap = Infinity` for `pool` too (it's kept and small), and put `pool` beside `watch` in the order.
- **m2. The new-account rule never decides anything today.** Outside a review, the deep check stops at 8 moves, short of
  `banOneDeepChecked` (12). Inside a review, the level path pools on the first such match. The decision note says so. Also, "first 10"
  counts fair-play rows, not games: 1 v 1, Squads and unvouched matches make none. So a veteran's first crowd matches count as "new".
  Fine as Eric's floor. Worth one line in the note.
- **m3. Pooled, or Released, while holding a ticket.** In 1 v 1, the next ask goes to the other queue and gets `{ expired: true }`.
  The old ticket can still be paired in its old queue until it goes stale, which can leave a clean opponent with a no-show game. A
  Cancel after Release goes to the clean queue (index.ts:456) and leaves the `.engine` ticket behind. **Fix:** Cancel asks both
  queues; or accept it (the window is seconds).
- **m4. Anyone with the code can join a matchmade lobby while it waits** (`lobby.ts:932`). A pooled player who opens a clean friend's
  shared lobby link joins up to 98 clean strangers. The decision note only exempts private lobbies and invites. This one is a public
  match. **Fix:** the matchmaker passes `engine` into the lobby's overrides when it creates a lobby. `lobby-do` refuses a new, unseated
  account whose pool status doesn't match the lobby's, with the usual "This match has already started." Or record it in the note as
  accepted.
- **m5. Fail-open.** On a D1 error, `mayPlay`'s `banCheck` catch (index.ts:522), `anyPooled`'s catch (squads-do.ts:621) and `inPool`
  all route the player to the clean queue for that one request. Bans already fail open the same way, so this is consistent. Noted only.
- **m6. Ways a pooled player could notice** (they come with the design, recorded here so they're a choice):
  - The pool queue almost always waits the full fill time and fills with bots. A lone pooled player in 50 v 50 sees 1 human and 99
    bots, while the home page's typical wait and counts reflect everyone. Pool lobbies also feed `queue_waits`.
  - In Squads, clean friends in a party with a pooled member get pool matches too, so friends may notice "always bots with X".
  - `topPlace` and "Top N%" leave out pooled players above a clean player. So a clean player can show the same "#1" as the pooled player
    above them.

---

## Checked, fine

- **Routing comes from the account, never the browser.** `mayPlay` → `banCheck` → `queueName(…, engine)`. The `.engine` suffix can't
  come from `?pool=`, whose pattern has no `.`. Covered: `/api/play` (crowd and raid, Default and Bots off), `/api/squads/play`,
  Squads parties (members' accounts read at every ask; `userId` comes from the session cookie and is now stored for Squads members
  too), and 1 v 1 play and Cancel. The answers have the same keys and status. Boss parties, private lobbies and friends' invites are
  not matchmaking (`inviteTarget` accepts private lobbies only).
- **Release returns the player everywhere.** It's a person's decision (the reviewer gets 409 on every decision for a pooled case), with
  no email, logged as "released from the engine pool", identities forgotten. Every queue goes back to normal on the next ask (tested),
  Squads parties at their next ask, and public rankings count the player again. Matches from before the Release don't put them back.
- **Nothing tells the player.** No email on entry or Release (`decide` emails only after a review or a ban). The account download
  shows only `banned`. `fairStatus` reports only bans. `deleteAccount`'s `keptFairPlay` never reaches the app. Results aren't held,
  `eligibleForRanked` is true, and the player's own "Top N%" and 1 v 1 place are worked out to look unchanged (tested). There's no
  public leaderboard list yet beyond these.
- **Evidence is kept.** `OPEN` includes `pool`. `purgeEvidence` and `purgeDuelGames` keep pooled players' data. Deleting a pooled
  account keeps the case and its hashed identities. A new account with the same email or Google id goes back into the pool
  (`evasion`), unless that account was cleared. Device markers don't spread the pool, which is consistent with "families share
  devices".
- **Honest players and evidence.** Unvouched matches write no fair-play rows (`lobby-do.ts:723`). A guest's pooled file carries over to
  the account it signs in to, as review and ban files already do (`strength` puts pool at 3). Reports and higher levels only add notes
  to a pooled case.
- **Admin access and numbers.** `/admin/fairplay/pool.json` needs the admin cookie (the reviewer token works only on `/api/admin/*`).
  The Release form posts through the existing origin check. 1 v 1 W-L-D scoring is right for 1-0, 0-1 and ½-½, with aborted games left
  out. `atBar` uses the level's own bar. `since` is the latest "pool" log line. The topPlace subtraction counts each pooled ladder above
  once.
- **Changed guard tests** (the PR body should list them): `fairplay-admin.test.ts` (detection pools instead of reviewing),
  `fairplay-deep.test.ts` (enforcement "pool"), and `review-b2.test.ts` M1 (an honest player at the forged bar now ends in the pool,
  and the reviewer can't move them; see M3).
