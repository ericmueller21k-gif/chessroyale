# The Crowd's cuts: six bigger cuts, longer rounds (Nov 1, 2026)

Eric, Nov 1: "every two moves people were getting cut after the first round… we need fewer eliminations, but we can
eliminate more players… it takes away from the chess game because there's too many cuts happening… feel like there's a
set amount of rounds." He approved this schedule as the default (a lobby vote on cut styles may come later).

What changed (settings.ts): `CROWD_KNOCKOUTS` team [30, 22, 16, 12, 8, 4], boss + [4], duel + [4, 2]; the new
`CROWD_STAGE_ROUNDS` [20, 10, 8, 8, 6, 6, 6, 4] plies, as `stageRounds` in `CROWD_SETTINGS`. Cuts after moves 10, 15, 19,
23, 26 and 29 (team final from move 30), 32 (boss final) and 34 (duel). `roundsInStage` reads `stageRounds` when it's set
and not empty; Classic and raids keep `firstStageRounds` / `roundsPerStage` as before.

Calls made:
- **A test's `?rounds=N` empties `stageRounds`** (`[]`, not `undefined`, which a lobby's JSON-stored overrides would drop),
  so every stage is N rounds as before. Unit tests that shortened a Crowd's stages set `stageRounds: []` too.
- **The soft cap keeps its moves:** `CROWD_SCORING.capFrom` [0, 1, 5, 9] → [0, 1, 2, 3], so ±3.5 / ±5 / ±8 start at moves
  11, 16 and 20 (were 11, 15, 19). Left as it was, ±5 would have waited for move 27, ±8 would never
  have come, and the FAQ would have said "from the 9th cut", which no longer exists.
- **The top bar counts moves, not plies:** "Move 12 · cut in 4" (moves 12 to 15; counting plies, as before, it would say
  "cut in 8" beside a move number); "cut now" on the stage's last move.
- **A game that ends before the final** still restarts from another start of the same kind (`replaceBoard`) and the cuts
  carry on; unchanged. Measured in `reports/crowd-sim.md` (Nov 1).
