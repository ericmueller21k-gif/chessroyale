# Review of #574 (XP phase 2: daily reward, level-up rewards, crates need keys)

Reviewed `origin/main...origin/claude/xp-phase2` against `.pr-body.md`, `notes/briefs/brief-xp-phase2.md` and the design.
Quick checks on the branch: `npm run typecheck` passed; `vitest run` rewards, ledger, xp, account-data, boss-tokens: 5 files, 94 tests passed.

**One major finding (the brief's "a test switch's jump on production can't pay real rewards"); no blockers otherwise.**

## Major

### M1. An admin's `?xp=` jump on production pays real level rewards
- `packages/server/src/api.ts:588` (`/api/xp/test` gated by `testSwitchesOn`, which is "TEST_SWITCHES is 1 **or an admin**",
  `admin.ts:54`) + `packages/server/src/rewards.ts` `owedLevels`/`payLevels` + `xp.ts` grantXp calling `payLevels`.
- Scenario: on production an admin POSTs `/api/xp/test {xp: 100000}` (`XP.testMax`). `levelOf(100000)` = 101. The admin's next counted
  game pays levels 2–21 (`levelsPerGame` 20): 40 Winter Crates, 20 keys, 2 boss picks; the next four games pay the rest
  (200 crates, 100 keys, 10 boss picks in all). Setting XP back down afterwards takes nothing back (the level ops stay, by design).
  The PR body lists "a test switch's jump" as a source of owed levels, so this is intended, but the brief asked that it not pay
  real rewards off a test server. It also makes "100 keys at once" moot and leaves the Crates tab's counts meaningless for Eric's
  tests on production.
- Fix (smallest): allow `/api/xp/test` only where `env.TEST_SWITCHES === "1"`, as was already done for `?xpgame` (api.ts:582-583,
  "Review m1"), and let admins on production test levels with real games. Alternative if Eric needs `?xp=` on production: in
  `setTestXp`, when not on a test server, write each newly reached level's op as already settled (an op `level:<n>:<ledger id>`
  with reason `level` and a zero/marker leg, so `owedLevels` sees it paid) — more code; the first is simpler. Add a test:
  admin + TEST_SWITCHES unset → `/api/xp/test` 403 (or levels from the jump never paid).

## Minor

### m1. `PAUSE_REWARDS` doesn't pause Squads' placement crates
- `packages/server/src/squads-do.ts` `writeReward`: `paused` reaches `grantXp` only; `grantReward(… r.coins, r.crates …)` still pays
  coins and (now openable) Winter Crates while the switch is on. The brief scopes the pause to XP, the daily reward and level
  rewards, so this is within the letter, but the PR body and the result line say "no XP and no rewards while on".
- Fix: either skip/queue the crates leg while paused (keeping the op key so it pays once later), or reword the PR body/FAQ to
  "no XP, daily reward or level rewards".

### m2. A whole XP day under the pause loses that day's daily reward
- `xp.ts` grantXp returns `paused` before the daily op. Levels are owed and paid later (correct), but the daily reward is keyed to
  the XP day, so if the switch is on until the day rolls over, that day's reward is never paid. The PR says "the day's reward …
  come at the next game after it", which is only true if the pause ends the same XP day. Record the choice in the decision note
  (likely fine: say "lost if the pause spans the day's end").

### m3. Guest merge can double level rewards (only for XP earned where sign-in isn't required)
- `ledger.ts` `mergeMoves`: the guest's XP is added to the account's; the guest's level ops die with its ledger id, while its paid
  crates/keys/picks merge in. The account is then owed the levels its new, higher XP reaches. Where sign-in is set up a guest
  earns no XP (`gameXp` guest → none), so on production this needs XP from before sign-in existed; noting it, no change needed now
  unless guests ever earn XP.

### m4. A failed `payLevels` leaves the result box without the grant
- `xp.ts` grantXp: the time/win/daily batch is applied, then `payLevels` and `gameRewards`; if either throws, callers' `.catch`
  record `xp: null` on the result row though XP and the daily reward went in. The levels stay owed (paid next game, so nothing is
  lost or doubled), only the screen is wrong. Optional: wrap `payLevels` in its own try/catch and still return the grant.

## Checked and fine
- Crate open (`locker.ts` openCrate): one op, guard checks a held crate of that id and a key in the same statement; legs spend both
  only if leg 0 is this attempt's; request-id replay answers the first item; two opens with one key open one (`CHECK n >= 0` too).
  Odds: `rollCrate(mulberry32(server seed))` on the server; the device only sends `crate`/`request`; `fischer`/`shiny` forced only
  where `TEST_SWITCHES === "1"` (api.ts), never an admin's elsewhere.
- Daily reward: op `daily:<day>:<ledger id>`, one per XP day; replays and rooms at once pay once; the part is shown only if its leg
  names this game.
- Levels: one op per level per ledger id, lowest first, ≤ 20 a game; concurrent games compute the same set, the second applies
  nothing; down-and-up pays nothing more.
- Boss pick: `isPickableBossCrate` = crates of `isPlayable` bosses (not hidden, not admins-first); guard `boss_picks >= 1`; one pick per
  request id; refused without one.
- Old `wallets.crates` → Winter: guarded by `crates >= n`, so concurrent reads move once; only a merge adds to `wallets.crates` now;
  deleted accounts have no wallet; held accounts unaffected.
- Ledger: `series_crate`/`boss_pick` in `HOLDINGS`, so merge and erase write their legs automatically; merge/erase move/delete
  `series_crates` and `boss_picks`; the reconciliation test covers them.
- Migrations: additive (`series_crates` CREATE IF NOT EXISTS; `wallets.boss_picks` and `results.xp_rewards` via COLUMNS, defaults
  0/NULL); `xpFromRow` tolerates a missing `xp_rewards`.
- Admin key grant: `/api/locker/grant` 404s for non-admins; keys capped at `keysGrantMax` server-side.
- App: `.reward-toast` is `position: fixed` with `pointer-events: none`, so it neither shifts nor blocks; the Crates tab reads
  `locker.crates`/`seriesCrates`/`keys`/`bossPicks` straight from the server's locker.
