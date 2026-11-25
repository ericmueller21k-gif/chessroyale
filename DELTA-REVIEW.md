# Delta review: Payments PR 2, play coins (#950), the review's fixes a4de7fcc..158d12db (Nov 25, 2026)

Read-only, Opus at `xhigh`. I read the brief (`notes/briefs/payments-pr2-delta.md`), the first review (`REVIEW.md` on
`review/pay-play-coins`), the director's calls (`notes/briefs/payments-pr2-fixes.md`), `DELTA.md`, and the whole diff
`a4de7fcc..158d12db`. For the paths the fixes touch, I followed them into the code around them: `grantXp`, `settleCoins`,
`recordFinished` and the room's retry, Squads' queue and its alarm, the solo endpoint, `dailyOp`, `ensureSchema`, and the base's
(`ca760a5`) `ranked:` and `squads:` writers.

**Verdict: every finding is fixed at its cause, and each fix has a test that fails without it. No blocker, no major.** The fixes
add 3 minor problems:

- **N1:** a ranked retry can pay a second daily reward.
- **N2:** a lasting `grantXp` fault now holds ranked outcomes for 24 hours, and holds Squads rewards one after another.
- **N3:** the ranked old-key guard reads the player's whole ledger.

None of them pays coins twice or loses them. N1 and N3 are one-line fixes. There are also 4 nits (N4-N7). The new findings are
numbered N so they aren't confused with D1, the database.

## What I ran

- `npx vitest run packages/core packages/server`: **136 files, 1961 tests, all pass.**
- `npm run typecheck`: passes.
- Two throwaway tests, deleted and not pushed. Results are quoted below.
  - A `duel:` grant replayed 15 s after the XP day rolls over.
  - A lasting grant fault in a Squads queue of 3 rewards.
- `EXPLAIN QUERY PLAN` (`node:sqlite`, the ledger's own columns and indexes) on the new guards and the day's sums.
- Not run: e2e (no screen or flow changed) and `coin-report.ts`.

## The first review's findings

| Finding | Status | At its cause? | Test that fails without it |
| --- | --- | --- | --- |
| M1 Squads | **fixed** | `writeReward` lets the grant's error through inside `MATCH_SAVE.strictMinutes` of `failedAt`, as `soft()` does; `grantXp` no longer swallows a `settleCoins` failure | "M1, Squads…" (the reward would leave the queue, 0 coins); "M1: settling the coins failing partway…" (25 coins, not 65) |
| M1 ranked | **fixed** (but see N1 and N2) | `withXp` makes 3 tries at once, then throws; `recordDuel`'s answer is kept (`DuelRecord.ranks`), so the alarm's retry never records twice | duel-do "XP and its coins when D1 fails…": the once case fails without it (White's outcome would say `coins: 0`), and so does the 3-times case |
| m1 | **fixed** | `STRICT = 4`: the batch, then 3 strict retries, then the loose try, logged after the 5th. I counted the loop: i = 0..2 strict, i = 3 loose, i = 4 logs. The words match the code in the module comment, the `coinOps` and test comments, call 1 and `accounts.md` | The burst test starts mid-day and asserts the cap only, as asked. Nothing tells 4 strict tries from 3 (nit N5) |
| m2 | **fixed** | `XpGame.soloCoins` → `CoinPlan.solo`, coins only (XP's cap, time op and win op unchanged); `writeRewardQueue` passes `rec.unvouched?.[r.squadId]` | "m2" (Ann would get 65, not 25). `unvouched` is set only by a squad's own matches and never cleared, so it is final by the time that squad's reward is queued |
| m3 | **fixed** (but see N3) | `oldCoins` is ANDed into both coin ops (strict and loose), and `settleCoins` checks it once | "m3" (Ann would get 30 + 27 + 15). The ids match the base's writers exactly: `ranked:${g.id}:${c}` paid to that player's ledger id (`ranked.ts:240` at `ca760a5`), and `opKeys.squadsReward(code, created)(ledger id)` with legs `[coins?, crates?]` (`grantReward`). The new code writes no `ranked:` op and always passes 0 coins to `grantReward`, so a game the new code alone wrote is never blocked |
| m4 | **fixed** | The core comment and call 8 now say what the rounding does; the core test runs to 45 wins, 120 draws and a mixed day, and checks each share against its step to within half a coin | The old bound is replaced (old → new is listed in `DELTA.md`). New: "a Squads member who resigned after 10 or more moves" |
| n1 | fixed | FAQ: "no XP, coins, daily reward…" | — |
| n2 | fixed | Only `//` comments outside the SQL strings, so `SCHEMA_VERSION` doesn't move for them | — |
| n3 | fixed | Call 13 | — |
| n4 | left, as the director said | — | — |
| n5 | noted for PR 3 | Call 14 | — |
| n6 | fixed | `CoinTry.won` replaces the `"Win"` label check | Equivalent: the label appears exactly when `won` was passed. The one difference is Squads' 1st, whose bonus op now also needs XP's win op. That op always goes in for Squads (no win cap), and a refused one would be worked out again without it |
| n7 | fixed | `ledger_reason (account, reason, created_at)` in `LEDGER_SCHEMA` | `EXPLAIN`: `daySum`, `coinDayOf` and `squadsDailyCap` search it (`account=? AND reason=? AND created_at>? AND created_at<?`) |
| n8 | fixed | The two checks are folded into one, which is equivalent | — |

## New findings

### Minor

#### N1. A ranked grant replayed after the XP day rolls over pays a second daily reward (the M1 retry)

`packages/server/src/duel-do.ts:371` (`now: Date.now()` on every try); `packages/server/src/rewards.ts:42` (`dailyOp`: keyed
`daily:<day>:<ledger id>` only, no guard).

- **Before:** a ranked side's grant ran once per recording. Nothing ran it again after it went in.
- **Now:** when one side's grant fails its 3 tries, the recording throws. The room's next try, 15 s later and then every minute for
  up to 24 h, runs `withXp` again for both sides, including the side that was already granted, at the new time.
- **Failure scenario (reproduced):**
  1. A game ends 5 s before the XP day rolls over.
  2. White's grant goes in, with that day's daily reward (200 XP and 1 crate).
  3. Black's grant fails 3 times.
  4. The alarm's try, 15 s later, grants White again with `now` in the new XP day. The `daily:<new day>` op applies and names this
     game.
  - Result: one game pays two daily rewards, 400 XP and 2 crates. The second box shows "Daily reward +200" again.
  - Its coins don't double, because they're keyed by the game. The replay's `coins.today` does read the new day (`{play: 0, bonus: 0}`).
- **Squads has the same shape:**
  - It has existed since Nov 9. `writeReward`'s `now` is the write's time, and a reward is written again after its grant went in when
    `recordResult` or the crate op fails.
  - M1 adds one more way in: a settle failure after the batch.
  - The 50 v 50 lobby is safe: it grants at `p.at`, a fixed time.
- **Bounds:**
  - At most one extra daily reward per account per day.
  - It takes the new day's slot, so the player's next game that day pays none.
  - It needs a failure to straddle the XP day's rollover.
- **Fix (at the cause):** a game pays at most one daily reward. Add a guard to `dailyOp`:
  `NOT EXISTS (SELECT 1 FROM ledger WHERE account = ? AND reason = 'daily' AND source_id = <game key>)`. The new `ledger_reason`
  index serves it, and it covers every caller.
- **Or:** pass each game a fixed time: ranked `finished.endedAt`, as the 50 v 50's `p.at`; Squads a time stamped on the reward when
  it's queued.

#### N2. A lasting `grantXp` fault now holds ranked outcomes for 24 hours, and Squads rewards one after another

**Ranked** (`packages/server/src/duel-do.ts:126-142`, `:160`):

- There is no lenient window. A grant that throws every time keeps failing each recording try for `RANKED_1V1.recordRetryHours` (24).
  That could be a bug in `grantXp`, or a statement D1 always refuses.
- **What the players see:** they never get the `outcome` message, so no rank change and no coins line on the end page. (The rank
  change itself is stored in the database, and the queue doesn't wait on it.)
- **What the room does:**
  - It tries every minute. Each try is up to 3 grants per side, and each failed try goes to `serverError`.
  - At 24 h it closes with `ranked.recordLost`, "closing with the game never recorded", although `recordDuel` did record it.
- **Before the fix,** the same fault cost only the XP box.
- **Elsewhere,** the 50 v 50 (`soft()`) and now Squads stop holding the result `MATCH_SAVE.strictMinutes` after the first failure.

**Squads** (`packages/server/src/squads-do.ts:941-962`, `writeRewardQueue`):

- **How the queue works:**
  - The loop stops at the first reward that fails, and only that reward gets `failedAt`.
  - The next reward starts its own 30 minutes only when it is first tried, after the one ahead of it has gone.
- **Reproduced (3 rewards, a grant that always fails, 31 minutes between wakes):**
  ```
  wake 0: written 0, left 3, failedAt set on p0
  wake 1: written 1, left 2, failedAt set on p1
  wake 2: written 1, left 1, failedAt set on p2
  wake 3: written 1, left 0
  ```
- **A full lobby (32 humans):** about 16 hours to write its last placement row and crates. That is inside the 24 h the lobby waits,
  so nothing is lost.
- **The lobby's `writeSome` differs:** it moves a failed result to the back and tries the others in the same wake, so all their
  windows start together.
- **Before the fix,** a grant fault held no Squads reward.

**What isn't affected:** a short D1 outage. Everything fails together, then everything goes through.

**Fix:**

- **Ranked:** use the same window. Stamp when the first XP try failed on the record, beside `ranks`. Once
  `MATCH_SAVE.strictMinutes` have passed, send the outcome from the kept ranks without XP, logged and counted, as `soft()` does. The
  24 h close message should then say the ranks are in.
- **Squads:** when one reward fails, stamp `failedAt` on every reward still waiting
  (`for (const w of rec.rewardQueue) w.failedAt ??= now`), so the queue shares one window.

**Severity:** it needs a lasting fault, it's pre-launch, and nothing is paid twice or lost.

#### N3. The ranked old-key guard (m3) reads the player's whole ledger on every ranked coin op

`packages/server/src/play-coins.ts:43`:
`NOT EXISTS (SELECT 1 FROM ledger WHERE op_id IN (?, ?) AND account = ?)`.

- **The plan:** nothing here runs `ANALYZE` or `PRAGMA optimize`, so SQLite's planner has no statistics. It picks the account index
  over two primary-key lookups:
  - with this PR: `SEARCH ledger USING INDEX ledger_reason (account=?)`;
  - before n7's index: `ledger_account (account=?)`.
- **The cost:**
  - SQLite reads every ledger row of the account and looks each one up to compare `op_id`.
  - This runs in both of a ranked game's coin ops (play and bonus) for each side, and once more in `settleCoins` when a share was
    refused.
  - The reads grow with a player's history, which is what n7 fixed for the day's sums.
- **Fix:** add `AND leg = 0`. The old ranked op had one leg, so the answer doesn't change. The plan becomes
  `SEARCH ledger USING INDEX sqlite_autoindex_ledger_1 (op_id=? AND leg=?)`.
- **The Squads guard is fine:** `op_id = ? AND asset_kind = 'coins'` already searches the primary key.
- **Severity:** cost and latency only, never a wrong answer.

### Nits

- **N4. Solo** (`packages/server/src/api.ts:858-881`):
  - A settle failure now throws. The endpoint catches it, so the result row keeps `xp: null`, and a share a race refused isn't
    tried again.
  - This is documented (call 11).
  - Optional: 2-3 tries inline, as `withXp` does (the grant is keyed), would keep the box.
- **N5. No test pins the fourth strict try (m1).** A fake that refuses the first three strict tries would show the fourth pays the
  strict step. Optional: the director asked for the try, and the burst test covers the cap.
- **N6. `docs/areas/accounts.md:77` contradicts line 90.**
  - Line 77 is older and not in this diff. It says a Squads lobby of one party "pays as a solo game, under both solo caps".
  - But Squads' XP isn't solo-capped (`writeReward` passes no `cap`), and since m2 only its coins go the solo way, as line 90 says.
  - Line 77 should say so.
- **N7. Call 8 and the core comment say draws run "up to 16 ahead midway".** The test pins 16.5.

## Checked and fine

- **No retry pays twice, except N1.** Everything in `grantXp` is keyed by the game:
  - the time, win and coin ops;
  - quests (`quest_games`, `attempt`);
  - levels, keyed by level;
  - the Welcome Crate, once ever.

  The daily reward is the one exception (N1).
- **An inline retry after a batch that committed but answered an error:**
  - The replay answers from the ledger's own rows.
  - A share the first attempt had refused is worked out again against the day as it stands, which now includes this game's own play
    coins. That is correct.
- **Ranked's kept ranks:**
  - `recordDuel` is never replayed, and dodges and leaves are counted once (`!kept`).
  - The outcome carries the first recording's rank change (tested).
  - `ranks` is set on the same object every `persist()` stores, and it's stored before the rethrow, so it survives a restart.
  - No client message carries the whole record.
- **Strict and loose tries:**
  - The play op's guard is the day's 300 in every try.
  - The loose bonus guard is `sum + c <= 300`.
  - The old-key guard is in every try.
  - The day never passes 300 and 300.
- **No loop:**
  - Squads' `writeRewards` stops on a failure (its do/while runs only while `ok`). The next try is the lobby's alarm
    (`rewardRetrySeconds`) or its next store.
  - Ranked retries on the room's alarm.
  - The 50 v 50's code is unchanged.
- **`writePending`:**
  - It stores the record after a failure too, so `failedAt` survives a restart.
  - The daily crate cap's refusals are still told. They're now handled after the loop, including those written before a failure.
- **The index on the live D1:**
  - `CREATE INDEX IF NOT EXISTS` sits in `LEDGER_SCHEMA`, which is part of `SCHEMA_VERSION`'s fingerprint. So the schema run goes
    once after the deploy, inside the schema batch, and it's safe if two isolates race.
  - The ledger is small before launch, so the build is quick.
  - Each ledger insert now keeps one more index.
  - For launch: a later index on a large ledger should be checked against D1's per-statement limits before it ships. That's not
    this PR's concern.
- **Checks changed** (`DELTA.md`, old → new):
  - core "a game's share never drifts" → "…within half a coin…";
  - the server burst's exact 300/300 from an empty day → the cap only, from mid-day.

  No guard test in `docs/rules/eric.md` is touched.
