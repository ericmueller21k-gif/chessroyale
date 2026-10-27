# Folio's calibration: Draft, Crease and Revision (Oct 27, 2026)

Folio (id `folio`; docs/decisions/2026-10-27-folio-rules.md). From the game so far. **Draft:** every `draftEvery` crowd
turns from turn 3, an ink mark under one of the crowd's pieces its pieces attack; unanswered in two of the crowd's moves,
the piece is folded for 3 turns. **Crease** (the rage meter): a line nothing crosses for 4 turns, the engine's pick in
[0.3, 1.5] pawns, shown the turn before. **Revision**, once a battle: its punished blunder and the crowd's reply crossed out,
the engine's best in their place.

The aim (the brief): the harder end of the pack, a crowd score of about 0.10 to 0.25, battles of about 33 to 57 crowd
moves; its offset and `rageSpeed` from the sim.

**The result: outside the aim, on the crowd's side, and no lever tried moved it beyond the noise.** The first run, at the
usual offset (−250) and `rageSpeed` 1 with a Draft every 4 turns (folioA), gave **0.52** (± 0.09) in **49** moves. Then, as
the testing budget allows when a number lands outside its range, four variants: the offset at 0 and +200 (folioB, folioC:
0.58 and 0.48), and the Draft every 2 turns with `rageSpeed` 2, at −250 and +200 (folioD, folioE: 0.52 and 0.40). All five
are within about one standard error of one another (130 battles in all, about 0.50). **Shipped: the first run's numbers**
(offset −250, `rageSpeed` 1, `draftEvery` 4): nothing measured beat them, and they're the simplest (no boss plays over the
usual strength; a mark every other turn would have Folio speak every other turn). The sweep stopped there, as the budget
says; the director decides what's next (below).

## How it was run

The raid sim, as for Moo & Moon, Puddles and Babur: a Solo raid of 50 bots against it through the match runner, one battle
per seed, seeds 1 to 26, no strikes, its meter on.
`npx tsx packages/sim/scripts/boss-sim.ts raid folio 26 1 0 <tag> [patch]`; rows in `reports/boss-sim/raid-<tag>.jsonl`
(`folioB`: `{"offset":{"folio":0}}`; `folioC`: `{"offset":{"folio":200}}`; `folioD`:
`{"powers":{"draftEvery":2,"rageSpeed":{"folio":2}}}`; `folioE`: the same and `{"offset":{"folio":200}}`). Score: the
crowd's result per battle (a win 1, a draw ½; at the 60-move cap the engine's verdict); ± is one standard error. The bots'
tier is 1600: at −250 it plays at Stockfish's UCI_Elo 1350, at 0 at 1600, at +200 at 1800, slipping now and then below
2100 as every boss; Revision's move is the engine's best at the sims' boss budget (120,000 nodes). The Crease's line is
picked on the same engine at `creaseNodes`. **Not repeatable seed for seed** (Stockfish draws its limited-strength moves
from the clock), so runs compare by their totals. The bots play the judge's best moves (they don't know about the mark:
the marks they answer, they answer by chance).

## The table

| Run | Offset (its Elo), `draftEvery`, `rageSpeed` | Battles | Crowd wins / draws / boss wins | Crowd score (± 1 s.e.) | Games 1-13 / 14-26 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|
| **folioA (shipped)** | **−250 (1350), 4, 1** | 26 | 11 / 5 / 10 | **0.52** (± 0.09) | 0.62 / 0.42 | **49** (26-60), 60 | 13 |
| folioB | 0 (1600), 4, 1 | 26 | 12 / 6 / 8 | 0.58 (± 0.09) | 0.62 / 0.54 | 53 (25-60), 60 | 16 |
| folioC | +200 (1800), 4, 1 | 26 | 12 / 1 / 13 | 0.48 (± 0.10) | 0.46 / 0.50 | 49 (23-60), 60 | 13 |
| folioD | −250 (1350), 2, 2 | 26 | 10 / 7 / 9 | 0.52 (± 0.09) | 0.54 / 0.50 | 52 (27-60), 59 | 11 |
| folioE | +200 (1800), 2, 2 | 26 | 9 / 3 / 14 | 0.40 (± 0.09) | 0.15 / 0.65 | 51 (20-60), 60 | 15 |

## Its powers at work

| Run | Marks a battle | Folds a battle | Marks answered in time | Marks folded | Creases a battle | Crease cost (mean, median; in the band) | Battles with a Revision | Revision's worth (the crowd's reply it crossed out, mean / median) |
|---|---|---|---|---|---|---|---|---|
| **folioA** | 9.2 | 4.8 | 27% (65 of 240) | 52% | 2.5 | 0.42, 0.36 pawns; 33 of 65 | 18 of 26 (69%) | 2.72 / 2.63 pawns |
| folioB | 9.8 | 5.2 | 22% | 53% | 2.8 | 0.44, 0.34; 37 of 72 | 21 (81%) | 3.35 / 2.80 |
| folioC | 9.5 | 5.0 | 24% | 52% | 2.4 | 0.36, 0.25; 26 of 63 | 20 (77%) | 2.74 / 2.13 |
| folioD | 14.9 | 8.0 | 27% | 54% | 4.1 | 0.31, 0.10; 41 of 106 | 21 (81%) | 3.10 / 2.58 |
| folioE | 14.8 | 8.0 | 25% | 54% | 4.0 | 0.37, 0.23; 48 of 105 | 19 (73%) | 2.67 / 2.05 |

(A mark not answered and not folded went because Folio moved its own piece away, or the battle ended. A crease out of the
band is the nearest one below it: about half the warnings found none inside, as many positions have no line that costs the
crowd 0.3 pawns. Revision's worth is its `drop`: how much the crowd's punishing reply had won, by the judge, which the
rewind takes back; its cost on Folio's own move was the same or more.)

## What the numbers say

- **Folio blunders, and Revision only rewrites one.** It came in about three battles in four: a weak Stockfish (1350 to
  1800, with its slips) leaves a 1.5-pawn blunder for the crowd to find in most battles. The battles with a Revision went
  the crowd's way far more often (folioA: 0.64 against 0.25 without one): not Revision's doing, but the sign of a boss that
  blunders; the one it rewrites is rarely its last.
- **The Draft folds a piece about five times a battle** (half the marks), but the bots' crowd plays on around a folded
  piece at little cost by the engine's measure: doubling the marks (folioD) changed nothing measurable.
- **The Crease costs little**: 0.4 pawns on average, half the time below the band; doubling the creases changed nothing
  measurable either.
- **Strength didn't show either** (−250 to +200, 1350 to 1800), as the engine reader's own raid runs found for every boss
  (reports/engine-reader.md: "the boss's own moves barely change"). Half the battles reach the 60-move cap, where the
  engine's verdict decides.

## For the director

Folio, as built to the sheet, sits with the crowd-friendlier bosses in this sim (Boingo 0.54 to 0.63, Wrangler 0.38 to
0.50, Sawyer 0.35 to 0.50 in reports/engine-reader.md), not at the harder end. The numbers that could change that are the
sheet's, not this lane's: the fold's length (`foldTurns` 3), the window (`draftWindow` 2), the crease's band (0.3 to 1.5)
and length (`creaseTurns` 4), Revision's once a battle. Real players who answer the marks would score higher still. A
longer run (more than 26 battles a setting) would be needed to see a change of 0.1.
