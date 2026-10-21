# Auto chess: how fights end, before and after (Oct 21, 2026)

The rules: [docs/decisions/2026-10-21-autochess-endings.md](../docs/decisions/2026-10-21-autochess-endings.md). The engine:
[reports/hunchess-engine.md](hunchess-engine.md).

**The sample:** the same 80 fights as the engine's report (`sparseStarts(80, 4242)`: two bot armies, rounds 1 to 8, 4 to 10 pieces a
side; stand-in seeds `mulberry32(i)`), played by the real fight (`playFight`) with the HunChess engine at 30,000 nodes a move for both
sides. **Before** is main at e709a59 (the merged rules) running this branch's `hunchess-fights.ts` (its pick returning the bare move,
as main's fight expects); it reproduces the engine report's numbers exactly (bare king 28, 5 checks 25, quiet 10, mate 6, cap 6,
repetition 5; White 37, Black 35, draws 8; 0.14 cash-ins a fight). **After** is this branch with Eric's numbers
(`stallWinMargin` 100, `decisiveMargin` 500, `decisiveMoves` 3, `mateShowMoves` 5). Seconds are the fight's real pace: the sum of
the waits the fight asks for (0.35 s a move; 0.175 s after 30 moves a side, and after this change also once a side is down to its
king and pawns). Raw data, fight by fight: [reports/autochess-endings/](autochess-endings/).

```sh
npx tsx packages/sim/scripts/hunchess-fights.ts fights=80 out=after.json
npx tsx packages/sim/scripts/hunchess-fights.ts fights=80 set.decisiveMoves=6 out=try.json   # any number setting
```

## Before and after

| | Before (e709a59) | After (500 / 3 moves) | Proposed (500 / 6 moves) |
| --- | --- | --- | --- |
| **Ends** | bare king 28 (35%), 5 checks 25 (31%), quiet cap 10 (12.5%), mate 6 (7.5%), move cap 6 (7.5%), repetition 5 (6%) | too far ahead 54 (67.5%), quiet cap 15 (19%), bare king 7 (9%), mate 4 (5%) | too far ahead 39 (49%), quiet cap 17 (21%), bare king 15 (19%), mate 7 (9%), repetition 2 (2.5%) |
| **Draws** | 8 (10%) | 7 (8.8%) | 7 (8.8%) |
| **Moves a side:** average / median / longest | 27 / 22 / 60 | 10.9 / 8.8 / 40 | 13.4 / 11.8 / 40 |
| **Seconds:** average / median / longest | 16.7 / 15.4 / 31.5 | 6.8 / 5.2 / 24.5 | 8.3 / 7.0 / 24.5 |
| Fights over in 3 moves a side or fewer | 1 | **31** | 1 |
| **Bigger army** (P1 N3 B3 R5 Q9; 66 of 80 fights start uneven): wins / losses / draws | 61 / 2 / 3 | 61 / 3 / 2 | 61 / 3 / 2 |
| **Won by the side that started behind** | 2 (3% of uneven starts) | 3 (4.5%) | 3 (4.5%) |
| **Longest king-only stretch** (plies in a row where only kings moved): longest; fights with 6+ | 14; 10 | 10; 5 | 10; 5 |
| **One side's king walking** (its own moves in a row, all the king's): longest; fights with 5+; with 10+ | 16; 34; 3 | 11; 11; 1 | 11; 16; 2 |
| **Cash-ins a fight** (fights with one) | 0.14 (9) | 0.01 (1) | 0.03 (2) |
| Engine time a move (Node, this machine) | 41 ms | 44 ms | |

**Who wins hardly changes:** 76 of 80 fights have the same winner (the same 76 with 6 moves). The 4 that changed: #7 (a move-cap
win for Black on counted material is now a bare-king win for White: the engine plays the new rules, so the fight took another path), #49 (a quiet-cap draw on equal material is now White's: the score has it 2.9 pawns up), #76 (a repetition draw is now Black's
on the quiet cap), #77 (a bare-king win for Black is now a quiet-cap draw).

**King walks are down**, as Eric asked: no fight has a side walking only its king for 12 moves or more (3 had 10 to 16 before),
and fights with a 5-move king walk fell from 34 to 11 (16 with the proposal). The longest left (11 moves) ended at the quiet cap, which
(10 moves a side with no capture) is the limit by design.

**Stalls:** with checks no longer restarting the quiet count, the quiet cap ends more fights (15, from 10), and the move cap and
repetitions all but disappear (the early end comes first). Of the 15 quiet stalls, 8 went to the side the score favored (by 1.1 to
4.2 pawns) and 7 were draws (within a pawn). Draws overall: 7, from 8.

## What looks wrong for fun, and the proposal

**With 3 moves, 31 of 80 fights (39%) are over after 3 moves a side, about 2 seconds.** The bot armies are often lopsided from the
start (the bigger army wins 61 of 66 uneven fights either way), so the engine scores one side 5 pawns up from its first move and
the fight ends before it has begun. That is "many fights over in a few moves". It also all but ends cash-ins (0.14 a fight to
0.01), since few fights last long enough for a pawn to reach the end.

**Proposal: `decisiveMoves` 6** (keep `decisiveMargin` 500). Same winners, same draw rate, and:
- no fight ends before 6 moves a side except by mate or a bare king (1 fight in 3 moves, 3 in 5);
- a fight lasts 11.8 moves a side at the median (7 s), half of before (22, 15 s), and none longer than 40 (24.5 s; before 60, 31.5 s);
- king walks stay short (one-side 5+ king-walk fights 16, from 34; the longest 11, from 16);
- more fights end by their own rule (bare king 15, mate 7) instead of "too far ahead" (39).

Other numbers tried (all 80 fights, raw data in the folder above):

| `decisiveMargin` / `decisiveMoves` | Too far ahead | Over in ≤3 moves a side | Moves a side: average / median | Seconds: median | One side's king walks of 5+ |
| --- | --- | --- | --- | --- | --- |
| 500 / 3 (as built) | 54 | 31 | 10.9 / 8.8 | 5.2 | 11 |
| **500 / 6 (proposed)** | 39 | 1 | 13.4 / 11.8 | 7.0 | 16 |
| 800 / 3 | 37 | 18 | 14.4 / 15.3 | 9.1 | 19 |
| 800 / 5 | 25 | 1 | 15.8 / 16.5 | 9.1 | 21 |
| 1000 / 5 | 14 | 1 | 17.0 / 17.5 | 10.2 | 28 |

A bigger margin keeps lopsided fights going longer and brings the king walks back (28 fights with one at 1000); a longer count with
the same margin is the cheapest fix for the 2-second fights. It is a one-number change in `AUTOCHESS` (`decisiveMoves: 6`); left at
Eric's 3 until he says.
