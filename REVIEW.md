# Independent review: Payments PR 2, play coins (#950), head a4de7fcc (Nov 25, 2026)

Full lane, read-only. I read the brief, the design (section 6 and "Calls made here"), the PR body (`8d9d4ac5:.pr-body.md`), the
decision note, and the whole diff against `origin/main`, and followed every grant path (lobby, duel, Squads, solo) into the ledger.

**Verdict: no blocker.** No path pays a game twice in normal running, and the day never passes 300 play + 300 bonus, even when many
games land at once. There is **1 major** finding: ranked's and Squads' coins can now be lost when a single D1 call fails, where they
used to be retried. That one should be fixed in this PR. There are 4 minor findings and 8 nits.

## What I ran

- `npm ci`; `npx vitest run packages/core packages/server`: **136 files, 1955 tests, all pass**. App: `faq.test.ts`,
  `squads-reward-line.test.ts`: 63 pass.
- A throwaway test, not pushed (`packages/server/test/zz-review-throwaway.test.ts`): the bonus steps over 45 wins in a row; 4, 6, 10
  and 50 wins at once starting mid-day (after 12 wins, bonus 166); and one failed XP batch in a Squads reward write. The results are
  quoted below.
- Not run: typecheck, e2e and `coin-report.ts` (CI and the author cover those).

## Major

### M1. Ranked's and Squads' coins can be lost when one D1 call fails (they used to be retried)

`packages/server/src/duel-do.ts:342-354` (`withXp`: `grantXp(...).catch(() => null)`), `packages/server/src/squads-do.ts:953-965`
(`writeReward`: the same).

- **Before:** ranked's coins were in `recordDuel`'s batch, so they went in with the game's row, and the room retried that batch for
  `recordRetryHours`. Squads' coins were in `grantReward`, which throws on failure, so the lobby kept the reward and retried it for
  24 h.
- **Now:** both are paid inside `grantXp`, whose errors both callers swallow.
- **Failure scenario (reproduced):** a Squads 1st place in a 14-minute lobby. D1 refuses only the XP grant's batch once ("D1_ERROR:
  Network connection lost."). `recordResult` and `grantReward` (crates) succeed, so `writeReward` answers `"applied"` and the reward
  leaves the queue.
  - Result: wallet coins 0 instead of 65, and the result row has `xp_before` NULL and `coins` NULL.
  - Nothing tries again.
- **Ranked:** the same thing through `withXp`. The recording is already stored, so the outcome goes out with `coins: 0`, and the
  game's coins are never paid.
- **The 50 v 50 lobby is not affected:** its `soft()` throws during `MATCH_SAVE.strictMinutes`, so the room retries.
- **Also:** if `settleCoins` throws partway through (`xp.ts:434-440`), an op refused by a race is never retried either. That is rarer,
  because it needs a race and an error together.
- **Fix:** copy the lobby's pattern.
  - **Squads:** let `grantXp`'s error propagate from `writeReward`, at least within a strict window as `soft()` does. Everything
    after it is keyed (the XP and coin ops by the game, `recordResult`'s `since`, the reward's op), so the retry pays once.
  - **Ranked:** retry `grantXp` inline two or three times in `withXp`. It is keyed, so this is safe. Throwing out of
    `recordFinished` instead would replay `recordDuel`, and its replay answers no rank-point change.
  - **Test:** one failed XP batch in a Squads write keeps the reward queued, and the next write pays 65 once.

## Minor

### m1. Under a burst of games, the last loose retry is neither "a coin or two off the steps" nor "never starved"

`packages/server/src/play-coins.ts:73-74, 97-101, 142-143`; the decision note, call 1; `docs/areas/accounts.md:85`;
`packages/server/test/play-coins.test.ts:85-89`.

- **The ceiling holds:** the loose guard is `sum + c.bonus <= 300`, so the day never passes 300.
- **The steps do not hold:** each game's `c.bonus` comes from the day as last read, so a wave of loose tries all pay the old step's
  rate.
- **Reproduced:** 12 wins in a row (bonus 166), then 50 at once:
  - 16 games paid 8 each and took the day to 294, although past 250 a win pays 4. Played one after another, those 16 wins would
    pay 106 (to 272).
  - The other 34 games were refused 4 times and logged, and paid 0 while 6 coins of room were left. Played one after another, the
    day would have reached 300.
  - The PR's "50 wins at once end at exactly 300" passes only because it starts from an empty day.
- **The realistic case is fine:** with 4, 6 and 10 wins at once, every game was paid exactly what sequential play pays, and no try
  reached the loose one. The test database switches between the games at every await, so this burst is a worst case that one person
  can't produce. That's why this is minor, not major.
- **Fix:** make the words match what the code does: "never past 300; in a burst of many games of one account at once, some may be
  paid at an earlier step and the last ones may get nothing". Update them in the note, `accounts.md`, the module comment and the
  test's comment. Optionally, add a fourth strict try before the loose one. In the test, start mid-day and assert the cap only.

### m2. A lone-party Squads lobby pays the full placement bonus

`packages/server/src/squads-do.ts:961`; `squads-lobby.ts` `rewardFor`; `docs/decisions/2026-11-10-boss-and-lone-devices.md`.

- **The rule elsewhere:** call 5 says "an online game on one device's word: no bonus", and the 50 v 50 room does that:
  `rec.unvouched` → `cap: "solo"`.
- **Squads:** a squad whose bots only its own party's devices moved (`SquadsRecord.unvouched`) still gets `coin: { squads }`.
- **The bound that changed:** Eric's Nov 10 rule ("paid as any") relied on the cap of 5 paying lobbies a UTC day. That cap now
  covers crates only.
- **Scenario:** one party alone with bots, whose devices move the bots, places 1st every lobby: 40 bonus plus play coins each
  time, up to the day's 600. Before, the most was 5 × 100 = 500 a UTC day.
- **Severity:** bounded, and the rule is Eric's, so this is a call for the director, not a bug.
- **Fix, either:**
  - pass no `coin` facts (or treat the lobby as solo) when `rec.unvouched?.[squadId]`; or
  - record in the decision note that the lone-party Squads bound is now the day's 600.

### m3. A game half-written by the old code at the moment of a deploy can pay twice

`packages/server/src/squads-do.ts:953-971`, `duel-do.ts` `recordFinished`.

- **Ranked:** the old code wrote the game's `ranked:<id>:<color>` op, but the room stopped (or `recordFinished` threw after
  `recordDuel`, e.g. in `withSecrets`) before storing that it had. The new code's retry replays `recordDuel` (no change), then
  `withXp` writes `coins:duel:<id>:…` and `coinsbonus:…`. These are new keys, so the game pays play coins and bonus on top of its
  old ranked coins.
- **Squads:** a reward whose old `grantReward` paid 100 coins, but whose store failed, is rewritten by the new code and pays 65
  more.
- **Severity:** before launch only Eric plays, so there is almost no exposure. At launch, deploys will happen while players are
  mid-game.
- **Fix (cheap):** add `NOT EXISTS` on the old key to the coin ops' guard: `ranked:<duel id>:<color>` for `duel:` keys, and the
  Squads reward op's coins leg (`squads:<code>:<created>:<acct>`) for `squads:` keys. Or accept the risk and record it.

### m4. Tests that claim more than they check

- **`packages/core/test/play-coins.test.ts:122` "a game's share never drifts":** its sequences stop at 11 wins. Rounding half up
  pays 8 for each 7.5 at half and 4 for each 3.75 at a quarter, so the paid bonus runs ahead of the curve at the true earned total:
  - after 14 wins, 182 against 180;
  - after 35 wins, 300 against 293.75 (the ceiling comes at 35 wins, not about 37).
  - The test's own bound (`<= round(curve) + 1`) fails from the 14th win of a run of 15s.
  - The behavior is fine: it never passes 300, and it matches the coin report's "within 4". The claim is what's wrong (call 8,
    core `play-coins.ts:110`). Fix the claim, or round differently at the steps, and extend the test to 40 wins.
- **`packages/server/test/play-coins.test.ts:85-89`:** see m1.
- **Missing tests:**
  - a Squads member who resigned with 10 or more moves: play coins, no placement bonus (only the "resigned" case under 10 moves
    is tested);
  - M1's failure path.

## Nits

- **n1.** The FAQ's sentence about paused rewards (`packages/app/src/faq/content.ts:1255`) lists what a paused game doesn't earn;
  add coins.
- **n2.** `packages/server/src/ranked-schema.ts:17-18` and `:87` still describe `coin_day` and `coin_games` as the live daily cap.
- **n3.** Squads' crate cap now counts only lobbies that pay crates (1st and 2nd). Before, a 3rd-8th place (which paid coins) also
  used up one of the day's 5. This loosens the cap; worth a line in the decision note.
- **n4.** Apps from before this PR show "+0 coins · 1 crate" for 1st and 2nd ("placed" now carries `coins: 0`). Temporary.
- **n5.** `settleCoins`' `step` (`play-coins.ts:162`) is today's total minus this game's bonus, so it counts games that landed after
  this one. A replay later in the day answers a later `today` and `step`; the stored row keeps the first answer. Display only, but
  PR 3's strip should read the row.
- **n6.** The bonus op recognizes a win by the part's label `"Win"` (`play-coins.ts:91`). If that label ever changed, the friends'
  lobby guard would silently drop. Pass `coinOps` the won flag `coinsFor` already has instead.
- **n7.** Ops: each grant reads the account's coin legs from every day, about 4 times. `daySum` and `coinDayOf` filter by reason and
  `created_at` after the `(account, asset_kind)` prefix of `ledger_account`, so the reads grow with a player's history. XP's solo
  cap has the same shape. Add an index on `(account, reason, created_at)` before launch.
- **n8.** Core `play-coins.ts:147` can't be reached: line 146 already returns for any `g.xp.none`.

## Checked and fine

- **Once per game:** the ops `coins:` and `coinsbonus:<game key>:<ledger id>` reuse XP's game keys (`lobby:<code>:<start>`,
  `duel:<id>`, `squads:<code>:<created>`, `solo:<start id>`), with PK `(op_id, leg)` and `ON CONFLICT DO NOTHING`. Retries, a second
  tab, a room's restart, a second device and three at once each pay once (tested, and confirmed by reading). No other query reads
  legs by `source_id` without a reason filter (`rewards.ts:141`, `quests.ts:337`, `xp.ts:411`).
- **The day's caps:** the play guard `sum + c <= 300` and the strict bonus guard (`=` the paid bonus as read) are in the same
  statement as the insert; the loose try is `sum + c <= 300`. The day ended at 300 play and at most 300 bonus in every burst I ran.
  Values are whole numbers (`opStatements` would throw otherwise).
- **The XP day's boundary:** ops are dated `game.now`, and the read and the guards both sum over `[xpDayStart, +24 h)`. A lobby's
  late retry counts in its own game's day. Ranked and Squads write with the time of the write (ranked as the PR says; Squads'
  `writeReward` gets `Date.now()` too).
- **Eligibility:** exactly XP's `gameXp` (guest, banned, test, left, short or resigned under 10 moves, `maxMinutes`, the server's
  own `ms`), plus `held` (review or banned: the same statuses as `eligibleForRanked`).
  - Solo, and an online game resting on one device's word: `paidMinutes` from the XP time op, no minimum, no bonus. Solo's coin op
    needs the time op, and a race worked out again pays 0.
  - The friends' lobby: the bonus op needs XP's win op. A refused win is worked out again without it, and top 3 still pays (tested).
  - Squads' 1st never pays the win too; a member who resigned or left gets no placement bonus.
  - Top 3 is only in a 50 v 50 that's over and not a raid or boss (the reworked 50 v 50 has no boss final); its ties fall back to
    `standings`' order.
- **Removed paths:** `duelCoins` and `coinCount` are gone, and no `ranked:` op is written. `ranked_1v1`'s insert no longer names
  `coin_day` or `coin_games`; `coin_games` is `NOT NULL DEFAULT 0` in both the CREATE and the ADD COLUMN, so that's safe.
  `writeReward` always passes 0 coins, so a queued reward's old coins are never paid (tested); "placed" keeps `coins: 0`. A ranked
  game against a bot records nothing (`BotDuel`), so the FAQ's "a bot game pays nothing" holds.
- **`results.coins`:** adding it to `COLUMNS` changes the schema fingerprint, which runs `ALTER TABLE results ADD COLUMN coins TEXT`.
  The column is nullable with no default: safe on the live D1, no migration needed. No query joins `results` with `wallets`, so no
  `coins` becomes ambiguous. `recordResult`'s 33 placeholders match its columns. The download (`RESULT_COLUMNS`) and the anonymous
  kept row (`KEPT_RESULT`) include it, and the account-data test pins it. Rows from before read as no coins.
- **Docs and FAQ:** the FAQ's numbers come from `PLAY_COINS` (54, 300, 15/5/10, 40/25/15/5, 150/200/200, 300, 600) and it gives no
  per-minute words. The privacy page and the area pages match the code, except n1, n2 and m1's wording.
- **Checks changed:** each check the PR body lists as removed has a replacement at the `grantXp` level (under 10 moves →
  play-coins' "short"; at least 1 → duel-do's 20-second game and `xp.test`'s 40 s game; the daily caps → play-coins' day tests).
  None of `docs/rules/eric.md`'s guards are touched.
