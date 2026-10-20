# Moo & Moon's calibration: Moonbeam and the Full Moon (Oct 20, 2026)

Moo & Moon (id `moo`; docs/decisions/2026-10-20-moo-rules.md). From the game so far. **Moonbeam:** after every 3rd
move of his, at the end of his turn, a beam stuns one of the crowd's pieces (the one in its engine-best move after his
move) for the crowd's next turn. **Full Moon** (the rage meter): at the start of his turn he transforms; his next 5
moves are the engine's best at full strength, the first ending with a flurry of 5 beams; then he's dazed and himself
again.

The rule for the choice (the brief): place him in the pack, a crowd score of about 0.08 to 0.55 and battles of about
33 to 57 crowd moves; one run at one setting, a second only if the first lands outside, then stop and report.

**The result: outside the pack, far too strong, and not because of the Full Moon alone.** At the usual −250 and
`rageSpeed` 1 the crowd scores **0.02** (± 0.02, 26 battles) in **33** crowd moves. With the meter at half speed (half
as many Full Moons, 12 battles with none) it scores **0.00**: the battles without a Full Moon were his too. His offset
can't go lower to help (−250 already puts him at 1350, by Stockfish's floor of 1320). Kept: offset −250, `rageSpeed` 1
(an ultimate or two a battle, like the pack); what would bring him into the pack changes Eric's numbers, so it's
Eric's call (below).

## How it was run

The raid sim, as for Alfil, Chub & Chirp and Smudgy: a Solo raid of 50 bots against him through the match runner, one
battle per seed, seeds 1 to 26, no strikes, his meter on.
`npx tsx packages/sim/scripts/boss-sim.ts raid moo 26 1 0 <tag> [patch]`; rows in `reports/boss-sim/raid-<tag>.jsonl`
(`mooA`: as shipped; `mooR5`: `{"powers": {"rageSpeed": {"moo": 0.5}}}`). Score: the crowd's result per battle (a win 1,
a draw ½; at the 60-move cap the engine's verdict); ± is one standard error. The bots' tier is 1600: at −250 he plays at
Stockfish's UCI_Elo 1350, slipping to a random legal move 25% of the time, as every boss this far under its tier;
during the Full Moon, the engine's best at the sims' boss budget (120,000 nodes; 250,000 in the game), no slips. His
beams weigh the crowd's top 8 lines after his move at 50,000 nodes, as a host does. **Not repeatable seed for seed**
(Stockfish draws its limited-strength moves from the clock), so runs compare by their totals.

## The table

| Run | Offset (his Elo), rageSpeed | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 14-26 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|---|---|
| **mooA (as shipped)** | **−250 (1350), 1** | 26 | 0 | 1 | 25 | **0.02** (± 0.02) | 0.00 / 0.04 | **33** (14-60), 32 | 2 |
| mooR5 | −250 (1350), 0.5 | 26 | 0 | 0 | 26 | 0.00 (± 0.00) | 0.00 / 0.00 | 34 (15-60), 35 | 1 |

The pack, the same sim: 0.04 (Jefferson) to 0.79 (Hollow) on Oct 15; on newer code Big Boy 0.35, Sawyer 0.15, Alfil
0.15, Chub & Chirp 0.48, Smudgy 0.44. Ginger, whose freeze is the nearest power to his (a piece iced for two turns every
few turns), scored 0.08 at −100.

## Moonbeam

| Run | Beams a battle, mean (range) | Beams per crowd move |
|---|---|---|
| mooA | **8.8** (3-17) | 0.27 |
| mooR5 | 9.2 (3-18) | 0.27 |

- About one move in four of his ends with a beam (one in three, less the Full Moon's first turn, where the flurry takes
  its place, and any turn no piece fitted; the sim doesn't log those separately).
- **It wins on its own against this crowd:** in mooR5, 12 battles had no Full Moon at all (they ended at crowd moves 15 to
  35) and all 12 were his. Stunning the piece of the crowd's best move every third turn takes the bots' best plan away
  again and again.

## Full Moon

| Run | Full Moons a battle | Battles with 0 / 1 / 2 / 3+ | First, median crowd move | His moves at full strength a battle | Crowd's material lead as it came, mean | After his 5th move, mean | Change, mean (median) | Flurry: pieces stunned |
|---|---|---|---|---|---|---|---|---|
| **mooA** | **1.42** | 1 / 15 / 8 / 2 | 15 | 6.5 | −4.0 | −8.8 | **−6.5** (−6.5), 32 Full Moons that ran their course | 5 in 29 of 34; 4, 3, 2 once each; 1 twice |
| mooR5 | 0.54 | 12 / 14 / 0 / 0 | 25.5 | 2.6 | −5.1 | −10.7 | −7.1 (−6.0), 13 | 5 in 10 of 11; 4 once |

(Material lead: the crowd's material less his, pawns 1, knights and bishops 3, rooks 5, queens 9.)

- **The Full Moon decides a battle:** at the first one in mooA the crowd was even or ahead in 15 battles of 25, and his
  5 moves at full strength took 6.5 pawns' worth on average (a rook or more), after which the bots never came back.
- **The flurry** stunned all 5 pieces in 29 of its 34 casts. By the rule it stuns fewer only when fewer of the crowd's
  pieces (not the king) have a move, or more would leave no move: in check, say, when only the pieces that answer it can
  move.
- **A slower meter changes nothing:** half as many Full Moons, the first at crowd move 25 instead of 15, and the crowd
  still lost every battle, already behind as the first came (4 of 14 even or ahead).

## What it says

- **He's far too strong for the pack, by both powers:** 0.02 at the usual offset and meter, 0.00 with half the Full
  Moons. The Moonbeam as specified (the crowd's engine-best piece, every 3rd move) is the bigger half: the battles
  without a Full Moon were his too. Each Full Moon then costs the crowd about 6.5 pawns.
- **5 moves (or 7) at full strength are more than enough:** each Full Moon wins him a rook's worth or more against this
  crowd. 7 would be stronger still.
- **The levers are Eric's numbers** (each changes a rule he set, so none is changed here): the Moonbeam less often
  (every 4 or 5 of his moves), or on a less useful piece (Ginger's way: a pick among the crowd's three most valuable
  mobile pieces, not the best move's); the Full Moon shorter (3 moves) or without the flurry. A rerun takes one setting
  each (`moonbeamEvery`, `fullMoonMoves`, `flurryBeams` in BOSS_POWERS, the patch above), about 13 minutes a run.
- Battles are short (33 crowd moves, the pack's bottom edge) because he wins them early.
