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

## Nov 20: Eric's gentler climb (curve A) and a steeper one (B), with 2 lives

Eric: "wouldn't these 700-800 ELO bots just be making terrible mistakes?" and "go up like 20 points for the first 5 levels, and then
go up like 30 points, and then like maybe 40 points ... around the 30 mark ... keep it clamped in like the 15 to 1700 range".
Curve A (now the settings: +20 to floor 5, +30 to 10, +40 to 30, +4 to 50; a lone boss +100) and B (+25, +35, +45, then +10 to 30,
+4 after), 5 runs each to floor 40, with Eric's 2 lives (a lost floor still climbs; out at the third). New climber options:
`CLIMBER=maia` (sampled, as before), `maia-best` (Maia's likeliest move, no sampling), `stockfish` (full strength among the allowed
moves: a smoke run at 3000 won 12 of 12 floors). Each floor now records how it ended.

| Climber | Floors won: median (min to max) | Fell on (the third loss) | Won 1 / 2 / 3 bosses |
| --- | --- | --- | --- |
| maia 1000, curve A | 4 (2 to 6) | 5 to 9 | 4/11, 12/17, 4/7 |
| maia 1500, curve A | 8 (6 to 12) | 9 to 15 | 15/17, 19/29, 9/12 |
| maia 1500, curve B | 8 (3 to 16) | 6 to 19 | 12/17, 25/32, 10/13 |
| maia-best 1500, curve A | 4 (3 to 10) | 6 to 13 | 6/12, 17/21, 3/8 |

**What it says**
- **The bosses' rating hardly matters down here.** A 1500 climber loses about 1 floor in 4 to bosses at 620 to 780. Almost every
  lost floor ended in the climber being **mated** (36 of 60); the rest were draws (stalemates, repetitions). It's the powers, plus a
  bot that doesn't know them, that end climbs, not the bosses' chess.
- **Lives matter more than the curve.** With 2 lives the 1500 climber's runs end on floors 9 to 15; at the first loss they'd have
  ended by about floor 4.
- **`maia-best` isn't a better player:** without sampling Maia repeats itself and draws (5 repetitions or 50-move draws, 2 stalemates in 15 lost
  floors). Neither bot is a stand-in for a person who learns the powers; Eric's own climbs are the real measure.
- **Hardest bosses** (floors lost/met, all four tries): Jefferson (grex) 44%, Tiger 38%, the Hollow 33%, Big Boy 32%, Folio 32%.
  **Easiest:** Smudgy 14%, Hopper 20%.
