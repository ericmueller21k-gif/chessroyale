# eloDraw against UCI_LimitStrength

`npx tsx packages/sim/scripts/elo-draw.ts 200 3` (Nov 10, the delta review's D5): 200 positions, Stockfish lite at 250000 nodes, the
raid's guard, mean loss a move (points), at the old T (scale 1: the mean loss a move at that Elo, RATING_CURVE).

| Elo | T | UCI (± se) | seeded, scale 1: a move / exact | scale | seeded at scale (exact) |
|---|---|---|---|---|---|
| 1600 | 9.30 | 1.06 ± 0.08 (600) | 1.11 / 1.33 | 0.53 | 1.06 |
| 2200 | 5.37 | 1.06 ± 0.08 (600) | 0.88 / 1.10 | 0.92 | 1.06 |
| 2500 | 4.08 | 0.93 ± 0.08 (600) | 0.88 / 0.95 | 0.96 | 0.93 |
| 2800 | 3.10 | 0.82 ± 0.07 (600) | 0.74 / 0.79 | 1.04 | 0.82 |

- "A move": one real seeded move a position (bossMoveFrom, guard and head-to-head check), so its own error is about ±0.14.
  "Exact": the draw's mean over every seed, through the guard but before the head-to-head check, which only ever lowers the loss.
- The 40-position run's trend (seeded 23% and 40% over UCI at 2200 and 2800) doesn't hold at 200: a real seeded move gives away
  5% more than UCI's at 1600 and 17%, 5% and 10% less at 2200, 2500 and 2800 (all within about one standard error).
- The table (`BOSS_CHECK.eloDrawScale`): the exact mean times the check's measured share (real ÷ exact, all four Elos: 0.866)
  brought to UCI's, through a power law in the scale fitted on each row's two points: 0.79, 1.27, 1.27, 1.21 (2800's slope is
  the least sure: 1.44 at the others' slope), set to 0.8, 1.25, 1.25, 1.25. Predicted: within a few % of UCI's at each Elo (its
  own error is about 8%).
