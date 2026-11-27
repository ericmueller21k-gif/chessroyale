# The Stranger: unlock only by beating him (PR #1000 fix round; Eric, Nov 27 ~03:30 UTC)

Read `notes/briefs/rules-common.md` first. Branch: `claude/stranger-rules` (PR #1000, open; the director opens nothing new). Effort
xhigh (stored data and the unlock check). Opus.

Eric, Nov 27: **"you have to beat him to unlock him."** Today #1000 unlocks him at `tower_best >= 10` (core `unlockedBosses`, the
server's `towerUnlocks`, the app's `unlocks.ts`). The PR body admits the hole: a run that spent a life losing floor 10 (his) and then
won floor 11 unlocks him too, because the best can't tell the difference. Close it: the unlock is a **won floor 10** (his first floor,
`unlockFloor`), solo or party (each member of a party that won it).

1. First find out exactly how a lost floor with a life spent moves on (packages/server/src/tower*.ts, core tower.ts `floorsWonBest`,
   `met.won`): can a run reach 11+ without winning 10? Can his floors 30/50 be reached that way too (they don't unlock anything new)?
2. Prefer deriving "won his floor" from data already stored (runs' met/won history per account and kind). If that's impossible
   or fragile, add the smallest stored record (a nullable column or a tiny table via a migration: e.g. `boss_unlocks(user_id, boss_id,
   at)`, written on the win, server-side only), and say so in `.pr-body.md` under "Stored data": then it's the full lane (the director
   runs an independent review; add the `full-e2e` label note in the body). Never trust the device.
3. Keep every surface the same answer: core `unlockedBosses`/`canPick`, the server's raid and party pick checks, `GET /api/tower`'s
   data the app reads, the picker's locked card and line ("Beat him on Battle Tower floor 10"), the FAQ (drop the sentence about the
   floor-11 loophole; say he unlocks when you beat him).
4. Tests: a unit test for the loophole (lose floor 10 with a life, win 11: still locked; win 10: unlocked; a party win unlocks each
   member), update `e2e/stranger.spec.ts` if the climb changes. Server tests if the store changes.
5. Also recorded (Eric, Nov 27): **the banners.test.ts guard edit is OK** (his two VIEWS rows). Put that in the PR body's Checks line
   ("Eric OK'd, Nov 27") and in a short decision note `docs/decisions/2026-11-27-stranger-unlock-win.md` with the unlock call.
6. Fold in the open review nits if cheap: the test server's towerPool parity, `stranger.test.ts` early returns and test names.

Push WIP at each real step. When done: `.pr-body.md` = the full updated PR body (at most 40 lines, the existing body updated, not a
new one), then push `.done`. Don't open PRs or wait on CI.
