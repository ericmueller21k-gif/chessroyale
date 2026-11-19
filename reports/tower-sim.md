# Battle Tower: the climb sim (PR 14, Nov 20)

`npx tsx packages/sim/scripts/tower-sim.ts run <rating> <runs> <seed>`, then `summary`. Raw runs: `reports/tower-sim/*.jsonl`.

**How it ran.** 10 runs at each of four climber strengths (1000, 1500, 2000, 2500), 161 floors, about 40 s a floor, 4 processes
for about 35 minutes. Each run uses the real deal (core `newRun`, `startFloor`, `finishFloor`). Each floor is a real battle through
the match runner, driven the way the boss kit drives one, with every boss on Maia at the floor's rating (`floorStrength`, no Last
Stand). A run ends at a loss or a draw, or at floor 50 (Maia's floors). **Stockfish's floors 51 to 99 aren't simulated:** no run got
near them. **The climber** is Maia-3 at its rating, choosing among the moves the powers allow. It doesn't know the powers, never
calls the God King and has no clock. It always picks Chandy's safe Dodge square. A real player learns the powers, so read these
numbers as a floor (the worst case), not a forecast.

## How far runs get

| Climber | Floors won: median (min to max) | Fell on floor (bosses there) |
| --- | --- | --- |
| 1000 | 1 (0 to 6) | 1, 1, 2, 2, 2, 2, 2, 3, 3, 7: nine on 1 or 2 bosses |
| 1500 | 3 (0 to 5) | 1, 2, 2, 3, 4 (draw), 4, 4 (draw), 5 (draw), 5, 6 |
| 2000 | 5 (0 to 7) | 1, 3, 3, 4, 4, 6, 6, 6, 7 (draw), 8 |
| 2500 | 5 (0 to 6) | 1 (draw), 2, 4, 5, 6, 6, 6, 7, 7, 7 |

**No run passed floor 8.** The bosses there play at 1300 (Maia), well below every climber but the weakest. Five runs ended in a
draw, which counts as out. Eight losses came at the 60-move cap, where the boss wins with no mate.

## Win rate by boss count (floors won/played)

| Climber | 1 boss | 2 bosses | 3 bosses |
| --- | --- | --- | --- |
| 1000 | 9/11 (82%) | 6/14 (43%) | 1/1 |
| 1500 | 10/13 (77%) | 13/17 (76%) | 3/6 (50%) |
| 2000 | 14/15 (93%) | 19/25 (76%) | 5/8 (63%) |
| 2500 | 15/17 (88%) | 19/26 (73%) | 7/8 (88%) |

A 2500 climber still loses about 1 floor in 5 against 700 to 1200 bosses. Strength barely moves the result past 2000. The powers,
and the one-loss rule compounding them, decide how far a run gets: at 80% a floor, the median run ends by floor 4. Lost floors by
boss (lost/met): Tiger 8/18, Big Boy 6/14, Jefferson (grex) 8/20, Hollow 8/23, Folio 8/23, … Smudgy 1/19.

## `maiaStep` and `rageScale`: proposals, not changes

- **`maiaStep` (100) isn't the lever yet.** Runs end on floors 1 to 8 at boss ratings of 700 to 1300, where the climbers far
  outrate the bosses. A smaller step changes nothing a run reaches. A bigger one only matters once players get past about floor 10.
  Keep 100 until real climbs reach floor 10.
- **`rageScale` looks too generous on 2-boss floors.** Two bosses at 0.75 each is 1.5 meters' worth of powers a turn, more than
  three at 0.6 (1.8 shared three ways). Their win rates for the climbers say the same: 2 bosses 43 to 76%, against 3 bosses 50 to
  88% (small samples). Proposal: try `[1, 0.6, 0.5]` and rerun this sim with the same seeds (about 35 minutes) to compare.
- **The bigger question is the run's length.** At 75 to 80% a floor, even strong players stall around floors 3 to 7 with
  one-loss-out. If the tower should reach 20 or more, it needs higher per-floor odds on early floors (above 95%). That could come
  from softer powers on floors 1 to 10 (for example a `rageScale` that ramps with the floor) or from not counting a draw or the
  60-move cap as a loss. That's Eric's call (the one-loss rule is his). The sim can test any of these in one run.
- **Caveat:** the climber doesn't know the powers. A player who answers Tiger's hoops, Folio's creases or Jefferson's slams will
  do better. One playtest climb by Eric would show how far apart the bot and a person are.
