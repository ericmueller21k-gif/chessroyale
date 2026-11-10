# Independent review: PR #610 (rewards, records and fair play)

Branch `claude/fable-b2` at `0ce61df`, against `main` `0506f33`. Full lane, read-only on the code. Brief:
`notes/briefs/review-fable-b2.md`. Nov 10, 2026.

**Verdict: not ready to merge.** One blocker (the PR's own full e2e run is red because of this change), one major (finding 3
is narrowed, not closed: the reviewer's token can still ban an honest player), seven minor.

**What I ran:**
- the server unit suite on the PR head: 69 files, 1,036 tests passed;
- `tsc -p packages/server --noEmit`: clean;
- `review-b2.test.ts` (on this branch; copy it into `packages/server/test/`, then `npx vitest run packages/server/test/review-b2.test.ts`):
  4 tests, all passing. Each test asserts one of the findings below.

The outside review's proof test (`notes/fable-match-end-save.test.ts`) calls `saveResults`, which this PR removes, so it no longer
runs as written. The PR's `match-end-save.test.ts` is its port and covers the same ground: a second save adds nothing (10 rows stay
10).

---

## Blocker

### B1. The full e2e run is red: `e2e/fairplay.spec.ts:20` bans with the reviewer's token, which the new ban bar refuses
- **Where.** `packages/server/src/fairplay.ts:250-253` (new: the reviewer bans only at the ban bar) vs `e2e/fairplay.spec.ts:18-20`.
  The spec sets up its banned account by banning a brand-new account with the reviewer's token.
- **Failing case.** PR #610's e2e run 42806638010, shard 13, `[phone] e2e/fairplay.spec.ts:9`: expected
  `{ ok: true, status: "banned", by: "reviewer" }`, got the new 409 `"a ban needs the ban bar (policy.levels)…"`. The `result` job
  is red. The PR body's "Changed checks" doesn't list this spec.
- **Fix.** Keep the reviewer call, but assert it is now refused (409, case unchanged): that checks the new rule end to end. Then ban
  as an admin. E2e already has per-lane admin emails (`playwright.config.ts:40` `ADMIN_EMAILS`, `e2e/helpers.ts:437-453`); use the
  admin page's POST `/admin/fairplay/case/<id>` with `action=ban`, a reason and the `Origin` header. List the changed check in the PR
  body. `docs/rules/eric.md` doesn't guard this spec.

## Major

### M1. The ban bar still rests on numbers that devices send, and the reviewer's token can ban an honest player there (finding 3 isn't closed)
- **Where.** `packages/server/src/fairplay-deep.ts:69-81` (`deepResult` keeps only `best`, `rank`, `loss`, `top`);
  `packages/core/src/fairplay.ts:98-110` (`skipReason`); `packages/server/src/lobby.ts:3398-3411` (`gap`, `bestExp`, `crowdFound`
  and `recapture` all come from the judges' scores); `packages/server/src/fairplay.ts:250-253` (the reviewer's new check uses the
  same level).
- **What.** The deep re-check now scores every legal move, which closes "confirms a forged candidate list". But it throws away what it
  learned about the position:
  - Which moves count is still decided from the judges' numbers: `gap` (only move), `bestExp` (decided), `crowdFound` (obvious) and
    `recapture`.
  - The match's strength (`perf`, needed for `banPerf` and `banOnePerf`) is still computed from the judges' `loss`.

  Two lying judges (finding 1, still open) can therefore report an honest player's forced or obvious moves as hard finds that aren't
  only moves. The server's deep search then confirms each pick as its best, which is true because the moves were obvious. The deep
  share reaches 100% and the level reaches `ban`. Detection now only opens a review, but the reviewer's token passes the new check and
  bans.
- **Failing case (ran it).** `review-b2.test.ts`, "M1: end to end":
  1. Two matches of an honest player's obvious moves, as lying judges report them (gap 3, the crowd "missed" every fourth).
  2. Detection opens a review (enforcement `"review"`).
  3. `deepCheckRun` runs with a server search that finds each pick an only move, 35 points clear.
  4. `decide(…, "ban", "reviewer", …)` returns `{ ok: true, status: "banned" }`.

  "M1: the deep re-check scores every legal move…": 16 moves counted, 16 deep matches. By the server's own numbers, three in four of
  those moves are only moves (`skipReason` → `"only"`).
- **Why it matters.**
  - The PR's claim that "a leaked token or a steered reviewer can't ban an honest player" (`fairplay.ts:250-251`;
    `docs/fairplay-reviewer.md`) holds only for a player with no matches.
  - Turning `enforcement` back to `"ban"` would reopen the automatic path unchanged.
  - The reviewer reads the same forged evidence (`gap`, `crowdFound`, `top`), so it has nothing to catch the forgery with.
- **Fix.**
  1. The search already scores every legal move. Store its own facts per move in `deep`: second-best gap, best expected score, and the
     crowd recounted against its scores (each move's `picks` are the room's own).
  2. Make `skipReason` and `matchSignals` prefer those when present. A deep-checked move that the server finds forced, an only move,
     decided or obvious should count neither as checked nor as a match.
  3. Compute the strength used for `banPerf` and `banOnePerf` from deep losses.
  4. Until this lands, let the reviewer review, watch and clear only (the audit's alternative). Say in the decision note that bans
     stay off until it lands.

## Minor

### m1. A fair-play write retried after its row went in never opens the review or queues the deep re-check
- **Where.** `packages/server/src/fairplay.ts:440` (`if (!added) return { …, acted: "none" }`).
- **Failing case (ran it).** `review-b2.test.ts` "m1": the first try inserts the row, then D1 fails once at `queueDeep`. The retry,
  as `writeResult` makes it, returns `acted: "none"`:
  - no case is opened, though the verdict is `review` (the control player's case opens);
  - no match is queued for the deep re-check.

  The case waits for the player's next flagged match.
- **Fix.** On `!added`, still run `queueDeep` (when flagged) and `actOn`. Both are safe to repeat: `raiseCase` only adds a note, and
  `setCase` and the mail skip a case that's already banned.

### m2. While results wait to be written, every event waits on the write before it arms the match's alarm and sends the engine jobs
- **Where.** `packages/server/src/lobby-do.ts:255-261`. `await this.writeResults()` comes before `armAlarm` and before the
  `serverQueue` dispatch, and `writeResults` hands every caller the write that's already running.
- **Failing case (ran it).** `review-b2.test.ts` "m2": with one result queued and D1 slow, `persist` makes no `setAlarm` call until D1
  answers.
- **When it bites.** A result is queued mid-match (a resign, someone gone too long) and D1 is slow. Each pick and each round's alarm
  then waits for up to `perWake` players' writes before arming the next event. During an outage this repeats on every retry (each
  minute).

  Before this PR, only the one event that took the results waited. This is not a correctness bug, but it makes the game lag when D1
  is unwell (computing priority 1: smooth play).
- **Fix.** Arm the alarm and dispatch the engine queue first, then run the write in the background:
  `this.ctx.waitUntil(this.writeResults().then(() => this.armAlarm(core)))`. Or don't await a write that another event started.

### m3. `strictTries` counts tries, not time, so a failure of about a minute drops a player's XP, fair-play row, Welcome Crate check and boss token for good
- **Where.** `packages/server/src/lobby-do.ts:710`; `MATCH_SAVE.strictTries: 3` (`settings.ts:2499`).
- **Failing case.** A player's XP grant fails at the end-of-match burst, say from contention, while the other players' writes succeed.
  1. The first failed try sends the player to the back of the queue; the following wakes come 1 s apart while others succeed.
  2. Once that player is the only result left, failures are spaced 60 s apart.
  3. Within about a minute or two the third strict try fails. The fourth writes the result row with `xp: null`, logs the soft parts,
     and drops them; nothing tries them again.
- **Fix.** Go lenient only after some time since the first failure (store `firstFailAt`; 30 minutes, say). Or, once the result row is
  in, keep the soft parts queued on their own: they're keyed, so retrying them is safe.

### m4. The deep re-check now costs 4 to 5 searches per move on the same budget
- **Where.** `packages/server/src/fairplay-deep.ts:124-151`; `FAIRPLAY.deep.dailySearches: 500` (`settings.ts:3492`), shared with
  1 v 1's checks.
- **What.** A middlegame position has about 30 to 40 legal moves: 4 or 5 searches of 2M nodes each, where before it was 1.
  - A Crowd match's ~25 counted moves cost about 110 to 125 searches, a quarter of the day's budget.
  - `queueDeep` queues every kept match of a flagged player (`fairplay.ts:449`), so one player's backlog of 10 matches takes 2 to 3
    days of budget (about half a day before), and 1 v 1 checks wait behind it.
  - A position the budget cuts off partway throws away the searches already made (`:135-148`).

  The money stays capped; it's the throughput that drops by about five times.
- **Fix.** Either:
  - raise `dailySearches` (Eric: it's spend); or
  - stop deep-checking a match once it has `banMatchChecked` moves, unless the case is in review.

  In either case, take the whole position's budget before its first search.

### m5. Engine cap: not measured against an honest solo player, and the app keeps calling after a refusal
- **Where.** `packages/app/src/engine.ts:132-135` stops asking only after a 404. Each 401 or 429 still costs a session read and a D1
  upsert (`engine-calls.ts:28-31`). `ENGINE_SERVER` is at `settings.ts:3110-3111`.
- **What.**
  - A solo game makes one `/api/engine/score` call per round in which a pick on the player's board falls in the re-check range
    (`runner.ts:839-840`, `runner-tools.ts:93-106`), plus a ping. 200 a day may cover only a few long games for a keen player; after
    that the device re-checks (acceptable under "devices first", but unmeasured).
  - `soloDailySearches` (1000) is an absolute number, not a share. On a server with `ENGINE_DAILY_SEARCHES` below 1000 (staging, a
    lowered cap), solo can take the whole day.
- **Fix.**
  - Treat 401 and 429 like 404 for the rest of the game.
  - Count calls in one solo e2e game before settling on 200.
  - Make solo's limit `min(soloDailySearches, a third of ENGINE_DAILY_SEARCHES)`.

### m6. Welcome Crate: short solo games and old progress don't count, and the screen doesn't say so
- **Where.** `packages/server/src/welcome.ts:50-52`. The meter still reads "Finish 5 games to unlock" (`welcome-rows.ts:63`).
- **What.**
  - A solo game finished in under 3 server minutes no longer moves the meter. That includes a Classic solo knocked out in the first
    stage, a quick boss loss, and a game started while offline (never timed). Nothing on screen says why.
  - Every pre-Nov 9 or untimed solo row stops counting, so a meter at 3/5 can drop back to 0/5 after the deploy. Before launch, only
    Eric's accounts are affected.
  - Eric set the rule "the first one you get after 5 games". This narrows what a game is, so the director may want his OK.
- **Fix.**
  - Say it where the meter is, or in the FAQ ("solo games count from 3 minutes").
  - Or count a solo game by its moves (`XP.minMoves`) plus a shorter server-time floor.

### m7. The reviewer's token can still put any account in review
- **Where.** `packages/server/src/fairplay.ts:248-260`. A reviewer `review` needs no evidence.
- **What.** Review holds results off ranking and keeps the player out of ranked until a person clears them (`fairplay.ts:98`). A
  leaked or steered token can no longer ban anyone, but it can still keep everyone out of ranked. The audit accepted "review, watch
  and clear".
- **Fix.** One line in the decision note. Optionally, a bar for review too: a stored match at watch level or above, or a cheating
  report.

---

## Checked, fine

**A match's end (lobby).**
- Results are queued in the record and stored before any write.
- Every write is keyed:
  - the result row is written once per lobby (`since` = its `createdAt`; codes are always `[A-Z2-9]{5}`, so the guard applies);
  - the fair-play row likewise;
  - XP, the daily reward and quests by ledger key, and a replayed grant answers the same parts (`xp.ts:229-250`), so a retried row
    still shows its XP;
  - the Welcome Crate by milestone, the boss token by its op.
- A restart mid-save, a deploy, or a record the old code stored mid-save (re-queued, then skipped by the once-guards): nothing
  doubles.
- The rating is the latest counting result's, by `played_at` (the queue time). A late write never brings an older rating back. That a
  late result's rating change is overtaken by a newer match is inherent.
- Lobby closing:
  - Every close goes through `closeIfDue`, which holds the lobby while the queue isn't empty, up to 24 h past its closing time.
  - The alarm keeps waking at the retry time; the close then makes one last try and reports `resultsLost`.
  - So a lobby can't close forever-open or early. A held lobby keeps its code; `create` picks another.
- Per-wake cap: 100 players take 5 wakes about 1 s apart, roughly 400 D1 calls a wake (under 1,000), and a failure goes to the back.
  No starvation.
- A player in two lobbies: separate keys, separate rows. The DO is SQLite-backed (2 MB values), so a 100-entry `saveQueue` fits.

**Squads and ranked 1 v 1.**
- Squads only sees `recordResult`'s new batch. Its results are `ranked: false`, so no rating is written: no change in behavior.
- 1 v 1 retries 4 times 15 s apart, then every 60 s, until 24 h after the game ended. The close waits for the next try (the alarm
  doesn't spin), and a give-up is counted on the ops page.
- A repeat recording answers with each rank as it stands (`ranked.ts:272-280`). XP and the Welcome Crate are keyed and their errors
  caught, so a retry pays nothing twice.
- A held room only reserves its code; the queue never looks at it.

**Engine routes.**
- `accountOf` only reads the session, so strangers create no guest rows. Guests are refused where sign-in is set up. Dev and e2e
  guests are allowed and counted.
- Refusals are 401 or 429, and the app falls back to the device.
- `engine_calls` is:
  - created with the other tables (`accounts.ts` SCHEMA);
  - included in the data download and in account deletion (`account-data.ts`);
  - deleted from the guest's side at a merge;
  - on the privacy page;
  - cleared of past days.

**Fair play.**
- `actOn` under `"review"` never bans (`fairplay.ts:500-519`). Evasion bans (`:164`) only follow an existing ban, which now needs a
  person, or the reviewer at the bar (M1).
- The reviewer can't touch banned cases or open appeals.
- Clearing a case and then banning gets around nothing: levels count from the last decision, so clearing lowers the level.
- The only routes to a ban are `decide` (through the API and the admin page) and `actOn`.
- Emails are stripped from the case list (`reason`) and from the detail (player, case, log, appeals). The list rows carry no
  `decided_by`.

**Guest merge.**
- `PAID_LEVELS` finds the guest's level ops through the merge's legs on the account. A guest that was paid levels always had XP, so
  the account always has a merge row.
- Levels the guest was owed but never paid are still paid, once.
- Nothing lost found.

**Welcome Crate.** Online rows and ranked 1 v 1 games count as before. Server-timed solo games of 3 minutes or more count (and so do
the tests' `xpgame` games).

## Does it close what the proof test shows?

- **Finding 9:** yes. No doubled rows, no swallowed failures, and a bounded number of D1 calls per wake.
- **Findings 4, 6 (emails), 7 (lost results) and 10 (empty posts):** yes, with the minors above.
- **Finding 3:** still open (M1), though the PR and `docs/fairplay-reviewer.md` describe it as closed for the reviewer's token.
- **CI:** red (B1).
- **Not in this batch:** findings 1, 2 and 5 are still the root of M1.
