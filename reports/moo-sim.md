# Moo & Moon's calibration: Moonbeam and the Full Moon (Oct 20, 2026)

Moo & Moon (id `moo`; docs/decisions/2026-10-20-moo-rules.md). From the game so far. **Moonbeam:** after every 3rd
move of his, at the end of his turn, a beam stuns one of the crowd's pieces (the one in its engine-best move after his
move) for the crowd's next turn. **Full Moon** (the rage meter): at the start of his turn he transforms; his next 5
moves are the engine's best at full strength, the first ending with a flurry of 5 beams; then he's dazed and himself
again.

The rule for the choice (the brief): place him in the pack, a crowd score of about 0.08 to 0.55 and battles of about
33 to 57 crowd moves. Then the director's balance call (Oct 20, Eric asleep): tune him into the pack by changing the
director's own choices before Eric's numbers, in order, stopping at the first variant in range: (1) the beam's target at
random (`moonbeamTarget`), (2) and `moonbeamEvery` 4, (3) and `fullMoonMoves` 3.

**The result: shipped with the beam's target at random** (`moonbeamTarget` "random", the first variant): the crowd
scores **0.21** (± 0.06, 26 battles) in **44** crowd moves, inside the pack. With the beam on the crowd's engine-best
piece ("best", the first reading) he was far too strong: **0.02** (± 0.02) in 33, and **0.00** with half the Full Moons
(the Moonbeam alone won every battle). Offset −250 (by the engine's floor, no lower lever) and `rageSpeed` 1 as before;
Eric's numbers (`moonbeamEvery` 3, `fullMoonMoves` 5, `flurryBeams` 5) unchanged.

## How it was run

The raid sim, as for Alfil, Chub & Chirp and Smudgy: a Solo raid of 50 bots against him through the match runner, one
battle per seed, seeds 1 to 26, no strikes, his meter on.
`npx tsx packages/sim/scripts/boss-sim.ts raid moo 26 1 0 <tag> [patch]`; rows in `reports/boss-sim/raid-<tag>.jsonl`
(`mooA`: the "best" target; `mooR5`: "best" and `{"powers": {"rageSpeed": {"moo": 0.5}}}`; `mooRand`:
`{"powers": {"moonbeamTarget": "random"}}`, now the default). Score: the crowd's result per battle (a win 1,
a draw ½; at the 60-move cap the engine's verdict); ± is one standard error. The bots' tier is 1600: at −250 he plays at
Stockfish's UCI_Elo 1350, slipping to a random legal move 25% of the time, as every boss this far under its tier;
during the Full Moon, the engine's best at the sims' boss budget (120,000 nodes; 250,000 in the game), no slips. With "best"
his beams weigh the crowd's top 8 lines after his move at 50,000 nodes, as a host does. **Not repeatable seed for seed**
(Stockfish draws its limited-strength moves from the clock), so runs compare by their totals.

## The table

| Run | Offset (his Elo), target, rageSpeed | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 14-26 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|---|---|
| mooA | −250 (1350), "best", 1 | 26 | 0 | 1 | 25 | 0.02 (± 0.02) | 0.00 / 0.04 | 33 (14-60), 32 | 2 |
| mooR5 | −250 (1350), "best", 0.5 | 26 | 0 | 0 | 26 | 0.00 (± 0.00) | 0.00 / 0.00 | 34 (15-60), 35 | 1 |
| **mooRand (shipped)** | **−250 (1350), "random", 1** | 26 | 2 | 7 | 17 | **0.21** (± 0.06) | 0.19 / 0.23 | **44** (21-60), 41 | 10 |

The pack, the same sim: 0.04 (Jefferson) to 0.79 (Hollow) on Oct 15; on newer code Big Boy 0.35, Sawyer 0.15, Alfil
0.15, Chub & Chirp 0.48, Smudgy 0.44. Ginger, whose freeze is the nearest power to his (a piece iced for two turns every
few turns), scored 0.08 at −100.

## Moonbeam

| Run | Beams a battle, mean (range) | Beams per crowd move |
|---|---|---|
| mooA ("best") | 8.8 (3-17) | 0.27 |
| mooR5 ("best", half speed) | 9.2 (3-18) | 0.27 |
| **mooRand ("random", shipped)** | **12.5** (4-19) | 0.28 |

- About one move in four of his ends with a beam (one in three, less the Full Moon's first turn, where the flurry takes
  its place, and any turn no piece fitted; the sim doesn't log those separately).
- **With "best" it wins on its own against this crowd:** in mooR5, 12 battles had no Full Moon at all (they ended at crowd moves 15 to
  35) and all 12 were his. Stunning the piece of the crowd's best move every third turn takes the bots' best plan away
  again and again.

## Full Moon

| Run | Full Moons a battle | Battles with 0 / 1 / 2 / 3+ | First, median crowd move | His moves at full strength a battle | Crowd's material lead as it came, mean | After his 5th move, mean | Change, mean (median) | Flurry: pieces stunned |
|---|---|---|---|---|---|---|---|---|
| mooA ("best") | 1.42 | 1 / 15 / 8 / 2 | 15 | 6.5 | −4.0 | −8.8 | −6.5 (−6.5), 32 Full Moons that ran their course | 5 in 29 of 34; 4, 3, 2 once each; 1 twice |
| **mooRand ("random", shipped)** | **1.96** | 0 / 10 / 7 / 9 | 14 | 9.8 | +0.1 | −1.7 | **−1.7** (−1.0), 51 | 5 in 44 of 50; 4 twice; 3 four times |
| mooR5 ("best", half speed) | 0.54 | 12 / 14 / 0 / 0 | 25.5 | 2.6 | −5.1 | −10.7 | −7.1 (−6.0), 13 | 5 in 10 of 11; 4 once |

(Material lead: the crowd's material less his, pawns 1, knights and bishops 3, rooks 5, queens 9.)

- **With the target at random, the Full Moon is felt, not decisive:** about 2 a battle, the first at crowd move 14 (the
  crowd even or ahead in 19 battles of 26 as it came), each costing the crowd 1.7 pawns on average (median 1). With
  "best" it came on a crowd already falling apart, and cost it 6.5.
- **With "best" the Full Moon decided a battle:** at the first one in mooA the crowd was even or ahead in 15 battles of 25, and his
  5 moves at full strength took 6.5 pawns' worth on average (a rook or more), after which the bots never came back.
- **The flurry** stunned all 5 pieces in 29 of its 34 casts. By the rule it stuns fewer only when fewer of the crowd's
  pieces (not the king) have a move, or more would leave no move: in check, say, when only the pieces that answer it can
  move.
- **A slower meter changes nothing:** half as many Full Moons, the first at crowd move 25 instead of 15, and the crowd
  still lost every battle, already behind as the first came (4 of 14 even or ahead).

## What it says

- **Shipped: the beam's target at random** (`moonbeamTarget` "random"): 0.21 in 44 moves, in the pack, between Sawyer and
  Big Boy; Eric's numbers unchanged. Revert to `"best"` (or try `"valuable"`) in one setting.
- **With "best" he was far too strong:** 0.02 at the usual offset and meter, 0.00 with half the Full Moons; the Moonbeam
  on the crowd's engine-best piece won every battle by itself.
- **5 moves at full strength are fine with the random beam** (1.7 pawns a Full Moon); 7 would push him toward the
  pack's hard end. The director's next steps (`moonbeamEvery` 4, then `fullMoonMoves` 3) weren't needed.
- Draws: 7 of 26, and 10 battles reached the 60-move cap (the engine's verdict decides those).
