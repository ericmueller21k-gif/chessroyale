# eloDraw against UCI_LimitStrength

`npx tsx packages/sim/scripts/elo-draw.ts 200 3`: 200 positions, Stockfish lite at 250000 nodes, the raid's guard, mean loss a move (points).

| Elo | T (table) | UCI (± se) | seeded at T: a move / exact | scale (table) | scale fitted | seeded at it (exact) |
|---|---|---|---|---|---|---|
| 1600 | 7.44 | 1.27 ± 0.09 (600) | 0.96 / 1.19 | 0.80 | 1.02 | 1.27 |
| 2200 | 6.71 | 0.99 ± 0.08 (600) | 0.93 / 1.15 | 1.25 | 0.88 | 0.99 |
| 2500 | 5.10 | 0.84 ± 0.07 (600) | 0.81 / 1.02 | 1.25 | 0.88 | 0.84 |
| 2800 | 3.87 | 0.71 ± 0.06 (600) | 0.86 / 0.88 | 1.25 | 0.94 | 0.71 |

- "A move": one real seeded move a position at the table's T (bossMoveFrom: the guard and the head-to-head check), so its own error
  is about ±0.14. "Exact": the draw's mean over every seed at that T, through the guard but before the head-to-head check, which
  only ever lowers the loss. "Scale fitted": the factor on RATING_CURVE's loss that brings the exact mean to UCI's.
- This run (Nov 10, delta review 2's N4) was at the table then in use: 0.8, 1.25, 1.25, 1.25. A real seeded move gave away 24% less
  than UCI's at 1600 and 21% more at 2800; 6% and 4% less at 2200 and 2500.
- The run before it (Nov 10, D5; scale 1 at every Elo, other positions: UCI 1.06, 1.06, 0.93, 0.82; a real seeded move 1.11, 0.88,
  0.88, 0.74) put 1600 at +5% and 2800 at -10%. Run to run, UCI's own mean moves up to 0.2 here (other positions each run).
- The table now: both runs' real moves against their own UCI, pooled, each brought to a common scale through its exact means' slope
  (loss ∝ scale^0.31 at 1600, ^0.85 at 2800): 1600 1.25 (pooled within 1%; the runs are +12% and -13% at it) and 2800 1.05 (-6%
  and +4%). 2200 and 2500 stay at 1.25 (pooled -7% and +2%). The head-to-head check cuts less at 2800 (real ÷ exact 0.94 and 0.98,
  against about 0.83 elsewhere): why 2800's factor is lower. Above 2800 (the Stockfish brain) it is held at 1.05, unmeasured.
