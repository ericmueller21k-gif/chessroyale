# The 50 v 50 rework in core: pick modes, cuts to a 1 v 1, carry, move limit, places (Nov 16, 2026)

Eric, Nov 16: "Yeah, the 50v50 rework. We're doing away with the hidden boss on that for now." Step C1 of
`notes/designs/crowd-rework.md` (branch `design/crowd-rework`; sim: `reports/crowd-rework.md` there): the rules in
`packages/core`, **off until C2** spreads `CROWD_REWORK` into `CROWD_SETTINGS` and wires the runner, server and protocol. Today's
50 v 50 plays exactly as before: every new path sits behind a setting `CROWD_SETTINGS` doesn't have yet.

**What's in core.** `CROWD_REWORK` (settings.ts): `crowdPick` "strong" (the vote "How are moves picked?", `CROWD_VOTES` in votes.ts,
held where `crowdCuts` is set; nobody votes: Strong), `crowdCuts` = `CROWD_CUTS` (after moves 14, 18, 22, 26, 30, 33, 39, 42: 34, 23,
15, 10, 6, 4, 2, 1 a side; `knockoutsPerStage` from `crowdCutKnockouts`), `crowdCarry` 0.5, `crowdMoveLimit` 60, `crowdLimitWin`
0.75. `CROWD_PICK` (`strongTop` 3, `strongClose` 0.03), `CROWD_BEST` (half the cuts). Functions: `crowdPickOdds` (scoring.ts, under
`drawMove` and `scoreGroup`'s odds), `crowdStageRounds` (under `roundsInStage`), `cutPlan`/`endStage` (cuts by keep, the carry, no
final), `isFinal` (never with `crowdCuts`), `finishGame`, `bestPlayer`, `crowdPodium`, `crowdLimitReached`, `crowdLimitVerdict`
(match.ts). Raids drop every rework key (`RAID_SETTINGS`), so they keep what they use once `CROWD_SETTINGS` has them.

**The director's defaults for Eric's questions:** move 60 is the judge's verdict (75%+ wins, else a draw); Chaos gives every distinct
picked move the same chance; a game over before the 1 v 1 places the winning side's survivors first.

**Calls made here:**
- **The schedule goes by the game's move number** (the board's "Move 14"), like the move limit and the opening allowance: a Random
  opening (the game starts at move 5) still cuts after move 14, so its first stage is 10 moves. `roundsInStage` counts it from
  `openingMoves`. A test's `?rounds=` (`stageRounds` emptied) still makes every stage N rounds.
- **Cuts count from `keep`**, not a fixed number out: a cut's share is the last keep less this one; whoever is still in above the last
  keep (ties that went through) is owed, spread evenly over the cuts to come as today; the last cut is exact. With nobody gone it's
  the same as today's rule; a side short of players (someone left with no bot in the seat, a small private lobby) is never cut below
  its keep (before, a short side could reach 1 early). After the last cut nobody is cut.
- **The carried score is kept to 2 decimals** (`round2`), as every 50 v 50 score is, so the screens' 2 decimals are the whole score.
- **The played move lives in `scoring.ts`** beside today's `crowdTopOdds`/`drawMove` (the brief said match.ts; the draw is there).
  Strong compares the judge's raw losses (3% expected score = 3 points); a tie for 3rd by picks goes to the better-scored, then by name.
- **The places' last tie-breaks:** score (to 2 decimals), then counted points a move (`matchLoss`), raw loss, thinking time, a coin.
  The best player's tie goes to the better place. Those who left the match (resigned, removed for being away: the runner passes them)
  are never the best player.
- **The verdict's 75% is not today's finals' number:** `runner.gameWinner` adjudicates at 60%. The rework uses 75% (the brief); C2
  calls `crowdLimitVerdict`, not `gameWinner`.

**For the director (not changed in C1):** at 4 or fewer a side, 50 v 50's shared-blunder relief (`CROWD_SCORING.sharedShare` 25%)
treats every lone pick as shared: at 2 a side a 6-point loss counts as 3, halving every gap in the 2 v 2 (and 0.75× in the 4 v 4).
The sim scored without the relief. Worth a look before C2 ships (`crowd-rework.test.ts`, "rounds of 2 and 1 a side").
