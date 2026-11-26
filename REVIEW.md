# Review: Payments PR 4, the coin boost and the Crate Bonus (#966)

Independent review, full lane (wallets, stored data). PR head `2dcde2b7` (`claude/pay-boost`), against `origin/main` `85530107`.
Read-only on the PR branch; this file is the only thing pushed (branch `review/pay-boost`). Nov 26, 2026.

## Verdict

**Not ready to merge: 1 blocker, 1 major.** The money paths themselves are sound. I found no way to pay a drop twice,
re-roll it, boost a game twice, use more minutes than there are, or double keys, and the three new kinds reconcile
everywhere. But:

- **B1:** the PR makes two existing unit tests and one e2e test fail at random, about 8% of runs each. `check` will be
  red on roughly 1 run in 7, on every PR and on `main`. One of them failed during this review.
- **M1:** the game that *crosses* the day's 300 is charged all its minutes for the few play coins it still pays. That
  breaks the design's "past the 300 the boost waits".

Both fixes are small. Minor findings and nits follow; none blocks.

## What I ran

| Run | Result |
| --- | --- |
| `npm run typecheck` (PR head) | clean |
| `npx vitest run packages/core packages/server` (PR head) | 2,000 / 2,001 pass. **The 1 failure is B1** (`quests.test.ts:326`, a random drop). The 2,001 includes my 6 probes below. |
| Server suite with the boost drop forced to 100%, then the Crate Bonus forced to 100% (local edit of `settings.ts`, restored) | 1,566 / 1,568 pass each time. The **same 2 tests** fail both times (`quests.test.ts:308`, `:326`). `coin-boost.test.ts` was left out because it depends on the odds by design. |
| Throwaway merge `main` + PR 5 (`claude/pay-storage` `018c851d`) + PR 4, conflicts resolved as a union | core and server typecheck clean; core + server 2,034 / 2,035 pass. The 1 failure is again B1, this time `quests.test.ts:308`. Two flaky tests seen in two runs. |
| PR 5's migration test (`purchases.test.ts`: today's live schema copy) on that merge | fails until its `wallets` expectation includes PR 4's 3 columns (m2); with that, it passes |
| 6 throwaway probes (appendix; `packages/server/test/zz-review-boost.test.ts`, not committed) | all pass, confirming M1 and m1 and that the races hold |

## Findings

### B1 (blocker): the drop makes tests that finish a daily nondeterministic (about 8% each)

- **Where:** `packages/server/src/quests.ts:331`. The drop is rolled from the completion op's key, which holds the
  account's ledger id, and the ledger id is random in every test world. Affected:
  - `packages/server/test/quests.test.ts:308`, which compares `rewards` exactly (a drop adds `boost: 1` or `crateBonus: 5`);
  - `packages/server/test/quests.test.ts:326`, which counts `reason = 'quest'` *legs* (a drop adds a second leg);
  - `e2e/quests.spec.ts:171`, `not.toContainText("Warm Up")`. With a drop, `RewardBox.tsx:35` (`forEndScreen`) now
    keeps Warm Up on the card, so the card says "Quest done: Warm Up …" plus the drop line, and the title becomes
    "Coin Boost Crate!".
- **Scenario:** any CI run. Seen here: `:326` failed at the PR head, and `:308` failed on the merge. CI's vitest has no
  retries, so `check` fails about 15% of runs (1 − 0.92²). The e2e test runs in two projects, so it fails on first try
  about 15% of runs, and on `main` a pass-on-retry turns the run red (CLAUDE.md, Nov 10).
- **Why it's a blocker:** "never merge red" and "a flake is fixed at its cause, never hidden". Patching the three
  assertions would fix today's tests, but every future test that finishes a daily would be 8% flaky again.
- **Fix (at the cause, test switch only, no schema):** let the test switch decide each dealt quest's drop. The default
  is none.
  - `setTestQuests` (`quests.ts:365`, test servers only) is how every one of these tests deals quests: unit tests through
    `set`, e2e through `?quests=`.
  - It already makes each quest's id (`:384`, `newId()`) and can read the account's ledger id (`ledgerAccount`). So it
    can keep drawing ids until `questDrop(questOpId(kind, id, account))` gives what the test asked for:
    `{ kind, progress, drop?: "boost" | "bonus" }`, and `?quests=warm-up:2:boost` in e2e. That's about 1 draw for none
    and about 25 for a drop.
  - The three tests above then pass as they are, and the PR's own `rolling()` helper (`coin-boost.test.ts:62-70`,
    which plants a ledger id by hand) becomes `drop: "boost"`.
  - Production is untouched. A quest that gets dealt for real and then finished in a test would still be random. The
    server suite has none today (the forced-odds runs), and from reading the e2e specs, only `quests.spec.ts:149`
    finishes a daily at all.

### M1 (major): the game that crosses the day's 300 burns all its minutes

- **Where:** `packages/core/src/coin-boost.ts:46-50` (`boostFor` charges `min(left, minutes)` of the game's counted
  minutes whenever `play > 0`), fed by `packages/server/src/xp.ts:452`.
- **Scenario (probe R1):** the day stands at 290 play coins, the boost is on with 120 minutes, and the player finishes
  a 30-minute game. Play coins are capped to 10. The boost pays 15 extra and takes **30 minutes**, leaving 90. A
  quarter of the crate goes for 15 coins.
  - At full value those 30 minutes are worth about 81 coins, plus the bonus.
  - This happens once a day to anyone whose boost is running when they reach the 300.
  - It contradicts section 7 ("the day's 300 … past the 300 it waits"), the decision note's call 2 ("a crate is
    always worth about 420 coins"), and the dialog's "It counts down only while a game earns play coins".
- **Not an over-pay:** the player only gets less than promised. It's still a money rule that's wrong at its edge,
  and the suite's "past the 300 the boost waits" test only covers a game entirely past it
  (`coin-boost.test.ts:200`).
- **Fix:** charge the minutes that earned play coins, not the game's.
  - In `boostFor`, take the game's minutes as `min(m, max(1, ceil(base.play / PLAY_COINS.perMinute)))`. That gives 30
    for a full 54-coin game, 12 for a 22-coin 12-minute one, and 6 for the capped 10, then the same share formula.
  - Or have the server pass the paid minutes.
  - Add the crossing game to the server test: day at 290, then a 30-minute game uses 6 minutes and leaves 114.

### m1 (minor, design call for the director/Eric): short games multiply what a crate is worth

- **Where:** `packages/core/src/coin-boost.ts:46-53`. The extra is 1.5 × (play + bonus) for the game's share of
  minutes, and every game counts at least 1 minute.
- **Scenario (probe R2):**
  - A 40-second online win (12 moves, so XP counts 0 minutes and pays 1 play coin) gets **24 extra for 1 boost
    minute**.
  - A 30-minute win gets 104 for 30 minutes: 3.5 a minute against 24.
  - Over a fresh day, 120 one-minute games with about 37 wins (win-trading would do it) reach the bonus ceiling. A
    crate is then worth up to 1.5 × (240 play + 300 bonus) ≈ **810**, about twice the design's ~420, and the day's
    600 cap becomes about 1,400.
- **Is it a bug?** Not against the design's text: "both play coins and bonus are multiplied". But Eric's words were
  "2.5 times coin boost for your next certain hours of play", and the bonus steps exist to cap abuse, which the boost
  multiplies by 2.5.
- **Fix, if wanted:** charge each boosted game at least a few minutes (one setting, e.g. `COIN_BOOST.minGameMinutes:
  5`). Or boost the bonus only by the game's minutes over a typical game's. Otherwise record in the decision note
  that a crate's worth is ~420 at 15-minute games and up to ~810 with short ones.

### m2 (minor): a semantic conflict with PR 5 that the PR body doesn't mention

- **Where:** PR 5's `packages/server/test/purchases.test.ts:103`. Its live-schema migration test reads `SELECT * FROM
  wallets` before and after `ensureSchema` and expects the rows unchanged.
- **Scenario:** whichever of #963 / #966 merges second sees `check` fail. The wallet row gains `boost_crates: 0,
  boost_minutes: 0, crate_bonus: 0`. CI catches it, but it isn't in the PR body's overlap section, which expects only
  the textual `AssetKind` / `HOLDINGS` conflict.
- **Fix:** the second PR sets the expected `wallets` rows with the three zeros before the first comparison.
  Done on the throwaway merge, the rest of that test passes: on a copy of today's live schema the three columns
  arrive as 0, the ledger check stays empty, the shape matches a fresh database, and a second run changes nothing.
  The textual conflicts are as predicted: `ledger.ts` (the schema comment, `AssetKind`, `HOLDINGS`, the merge comment)
  and `account-data.test.ts` (`SCHEMA_COLUMNS`). Each resolves as a union.

### m3 (minor, copy): the reward card's Crate Bonus line says "level-ups" and the drop's 5, not what's left

- **Where:** `packages/core/src/xp.ts:119`: "Crate Bonus: your next 5 level-ups give double crates".
- **Scenario:**
  - Only every 2nd level pays crates, so "next 5 level-ups" means about the next 10 levels. The blurb
    (`coin-boost.ts` `crateBonusBlurb`) and the FAQ say it right: "level-ups that give crates".
  - With 3 left from an earlier drop, the card says "next 5" while the player has 8.
- **Fix:** "Crate Bonus: your next 5 level-ups that give crates give double crates", or add "(8 left)" from the locker.
  Light lane.

### n1 (nit): a boost op guarded with bonus 0 doesn't check the bonus op is absent

- **Where:** `packages/server/src/coin-boost.ts:81`.
- **Scenario (from reading the code):** if a game's bonus op was refused all the way through and a later retry of the
  whole grant pays it, the boost already in (worked out without the bonus) stands, so the bonus goes unboosted. That
  is under-pay only: the guard still checks the play op's amount, and probe R6 shows a later attempt answers the boost
  already in, whatever coins it's handed.
- **Fix, optional:** with `coins.bonus === 0`, add `NOT EXISTS (… op_id = coinsbonus … leg = 0)` to the guard.

### n2 (nit): record two calls in the decision note

- **Boss picks:** the Crate Bonus doubles a level's series crates but never its boss crate pick (`rewards.ts:144`,
  `levelBonusOp`). Reasonable, but section 7 says "double crates" and doesn't say which.
- **Odds and replays:** the roll reads the odds live (`settings.ts:4707`, `:4719`). A replay after a tuning builds
  different legs, which is harmless because leg 0 conflicts. But "checkable from the ledger alone" holds only with
  the odds of the day the op was written.

## The brief's questions, one by one

1. **Money and wallets:**
   - **Drop paid once:** the drop is a leg of the quest's own op (one per quest id); retries, two tabs and two games
     finishing it at once all hit `(op_id, leg)`. Tested.
   - **The roll can't be gamed:**
     - The seed holds the 96-bit ledger id, and no player ever sees it. The data download leaves out `op_id`, the quest
       answer's `quest` is the kind (`quests.ts:348-349`), and only an admin's own test grants carry it in `source_id`.
     - Rerolling or abandoning a quest gives a new id and a roll nobody can see before finishing.
     - FNV-1a with a secret suffix plus mulberry32 is fine for this.
   - **A game is boosted once:** `boost:<game>:<ledger id>` is one op per game and account. Replays, a second tab and
     room restarts (the duel room's `XP_TRIES`, its record retry) find it and answer it. Solo isn't retried at all
     (`endSoloGame` takes the game first).
   - **Minutes never overdrawn:** the guard `boost_minutes >= used` is in the same statement as leg 0. Tested with 3
     games at once on 10 minutes.
   - **The coin-amount guard:** probe R5 shows a boost worked out from coins the ledger doesn't hold is refused all 3
     tries.
   - **Base coins only toward the 300 and the steps:** the boost's reason is `coin-boost`, and `daySum`/`coinDayOf`
     count only `play` and `play-bonus`.
   - **Waits past the 300:** right for a game wholly past it, wrong for the crossing game (**M1**).
   - **No stacking; XP never boosted:** yes, and yes.
   - **Crate Bonus:** exactly 5 per drop, one per paying level (guard `crate_bonus >= 1`, so it never goes negative).
     Keys and boss picks are never doubled. Two games at once reaching the same level pay one bonus (probe R3).
   - **Opening:** two opens at once on one crate open one (probe R4).
2. **The ledger:**
   - The daily check (`differences`), the backfill, the merge (`BALANCES`, plus the wallet statement now built from
     `WALLET_COLUMN`) and the erase all iterate `HOLDINGS`, so the three kinds are covered.
   - The download has the counts (`account-data.ts:96`) and every leg (`ledgerDownload`).
   - The static guard (`ledger.test.ts`, "a balance changes only through ledger.ts") already lists `wallets`, so no
     other path can write the columns. Every existing `delta` read filters by `asset_kind`, so the new legs leak into
     no sum.
   - Not tested: `backfillLedger` / `ledgerCheck` with the new kinds non-zero. The code is generic, so the risk is low.
3. **The schema on the live D1:**
   - `SCHEMA_VERSION` is a fingerprint of `COLUMNS`, so the live D1 runs the adds.
   - Each add happens only if `pragma_table_info` lacks the column, falling back to one column at a time on
     "duplicate column", so it's re-runnable.
   - `INTEGER NOT NULL DEFAULT 0` is a constant default, which SQLite allows on `ADD COLUMN`.
   - Proven on PR 5's copy of today's live schema (m2).
   - During a rolling deploy, old code keeps working: its column lists are explicit.
4. **The open endpoint:**
   - Signed session required (401 without).
   - Idempotent on `request`: `boost-open:<ledger id>:<request>`, a replay answers ok, and the app's `postOnce`
     resends the same id.
   - `PAUSE_SHOP` gives 503. With none left, the guard is in the same statement and the answer is 400
     `NO_BOOST_CRATE`. Both tested.
5. **After both PRs merge:**
   - Typecheck is clean and the textual conflicts are trivial.
   - PR 5's "`leg.coins` throws for a negative amount" auto-merges correctly onto PR 4's `walletLeg`.
   - PR 4 has no coin spend anywhere: its boost credits coins, and its debits are boost crates, minutes and bonus
     counts, not coins. The boost's coins count as earned, which is right.
   - One test needs updating (m2).
6. **The tests:**
   - Good: drop wiring (with a planted ledger id), the weekly, open once, held, paused, test and short games,
     the 300 and the steps, no stacking, the share, replays and races, the 5 doublings, merge, download and erase.
   - Gaps: the crossing game (M1), short games (m1), the Crate Bonus race and the open race (my R3 and R4 pass), and
     backfill/check with the kinds non-zero.
   - Changed checks: honest as listed (`account-data.test.ts` columns and download, `xp.test.ts` `drops: []`). But the
     PR should also have changed, or better made deterministic, the two quest tests that the drop now breaks (B1).

## Appendix: the probes (throwaway; not committed)

These ran in `packages/server/test/zz-review-boost.test.ts`, with the same helpers as `coin-boost.test.ts`
(`signedIn`, `grantTestItems`, `openBoostCrate`, `grantXp`).

- **R1 (M1):** 5 × 30-minute games and an 11-minute one leave the day at 290 play coins. Then a crate is opened and a
  30-minute game played: `coins` is `{ play: 10, boost: { coins: 15, minutes: 30, left: 90 } }`.
- **R2 (m1):** a boosted game of 40 s, 12 moves, won: `{ play: 1, bonus: 15, boost: { coins: 24, minutes: 1 } }`.
  Then a 30-minute win: `boost: { coins: 104, minutes: 30 }`.
- **R3:** `crate_bonus` 5, XP 400, two 12-minute games at once (`Promise.all`). Winter crates 2, `crate_bonus` 4, one
  `crate-bonus` op, `ledgerMismatches` empty. The first game's card shows `doubled: 1`; the second shows none.
- **R4:** one crate and three opens at once (two request ids, one with none): one ok, `boost_crates` 0,
  `boost_minutes` 120.
- **R5:** `settleBoost` on a paid 54-coin game, given coins `{ play: 999 }`: refused 3 times, no op, minutes still
  120.
- **R6:** `settleBoost` on a boosted win, given `bonus: 0`: it answers the boost already in, not a new one (n1).
