# Folio's calibration: Draft, Crease and Revision (Oct 27, 2026)

Folio (id `folio`; docs/decisions/2026-10-27-folio-rules.md). From the game so far. **Draft:** every `draftEvery` (4) crowd
turns from turn 3, an ink mark under the most valuable of the crowd's pieces its pieces attack (defended, no cheaper
attacker); unanswered in two of the crowd's moves, the piece is folded for 4 turns. **Crease** (the rage meter): a line the
crowd's pieces don't cross for 4 turns (Folio's do), the engine's pick in [1, 2.5] pawns, shown the turn before.
**Revision**, once a battle: its punished blunder and the crowd's reply crossed out, the engine's best in their place.

The aim (the brief): the harder end of the pack, a crowd score of about 0.10 to 0.25, battles of about 33 to 57 crowd
moves.

**Shipped: offset +150, `rageSpeed` 1.3** (the director's calls, Oct 27, below): the crowd scores **0.28** (± 0.05) in
**50** crowd moves over 60 battles. At the director's offset 0 it scored 0.33 (± 0.05), above 0.30, so the one further
run his calls allowed, at +150, was made; it lands nearer the aim (just above its top), and the sweep stopped there.

**After the review's fixes** (the crease checked again as it falls, the guard's mate rules, a folded rook's castling;
`folioH`, folioG's settings and seeds, run once): **0.33** (± 0.05, 20 of 60) in **48** moves. That is the top edge of the
director's 0.20 to 0.33 window, within the noise of folioG (0.28; the difference is 0.05 against a standard error of about
0.07 on it); nothing was re-tuned.

## The re-run after the review's fixes (Oct 27): folioH

The same settings (offset +150, `rageSpeed` 1.3) and seeds as folioG (seed 1, games 0 to 59, three processes of 20 games,
rows joined), on the code with the review's fixes. Each crease's cost is now judged **as it falls** (the crowd to move, its
four turns starting: `creaseCost` on that position), the cost when its warning showed kept beside it (`warned`); a warned
crease that didn't fall is listed (`creasesOff`).

| Run | Offset (its Elo) | Battles | Crowd wins / draws / boss wins | Crowd score (± 1 s.e.) | Games 1-30 / 31-60 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|
| folioG | +150 (1750) | 60 | 9 / 16 / 35 | 0.28 (± 0.05) | 0.28 / 0.28 | 50 (18-60), 56 | 26 |
| **folioH** | **+150 (1750)** | 60 | 12 / 16 / 32 | **0.33** (± 0.05) | 0.27 / 0.40 | **48** (18-60), 55 | 26 |

| Run | Marks a battle | Folds a battle | Marks answered in time | Marks folded | Creases a battle | Warned, didn't fall | Cost as it falls (mean, median; in 1 to 2.5; over 2.5) | Cost when warned (mean, median; in 1 to 2.5; over 2.5) | Battles with a Revision | Revision's worth (mean) |
|---|---|---|---|---|---|---|---|---|---|---|
| folioG | 9.1 | 4.5 | 25% (137 of 544) | 50% | 2.8 | (not judged) | (not judged) | 0.52, 0.21; 37 of 170; 0 | 38 of 60 (63%) | 2.18 pawns |
| **folioH** | 8.9 | 4.2 | 30% (158 of 532) | 47% | 2.8 | 1 (of 170) | **0.39, 0.00; 10 of 169; 9** | 0.55, 0.22; 43 of 169; 0 | 37 of 60 (62%) | 3.02 pawns |

What it says:

- **The score moved within the noise** (0.28 to 0.33, one standard error each); the fixes don't change what Folio does in
  most battles: the re-check stopped one crease in 170 (a warned line that would now have failed the guard).
- **The Crease costs less as it falls than when it's warned**: two moves come between (the crowd's, then Folio's), and
  more than half the creases cost the crowd nothing by the time they fall (median 0.00, 10 of 169 in the band). Nine (about
  1 in 19) cost more than 2.5 as they fall (3.2 to 7.7 pawns; their warnings 0 to 2.05): Folio's move made the line dear
  (most often a recapture or an escape that now has to cross it). The guard checked again as it falls looks only at the
  three rules (no move, the crowd's mate in one, Folio's), not the cost, as the review asked; the FAQ says so.
- Revision came in 37 of 60 battles, worth 3.0 pawns on average.

## The director's runs (Oct 27): the Crease the crowd's only, the Draft on the top piece, folds of 4 turns

After the first runs (below: 0.40 to 0.58, the easiest boss in the pack), the director changed four things: the Crease
stops the crowd's pieces only (Folio folds the board toward itself), in a band of 1 to 2.5 pawns; the Draft marks the most
valuable qualifying piece (seeded only among ties); a fold lasts 4 turns; `rageSpeed` 1.3; offset 0. One run of 60 battles
(seed 1, games 0 to 59, as three processes of 20 games each, the rows joined: `folioF`); above 0.30, one more at +150
(`folioG`: `{"offset":{"folio":150}}`).

| Run | Offset (its Elo) | Battles | Crowd wins / draws / boss wins | Crowd score (± 1 s.e.) | Games 1-20 / 21-40 / 41-60 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|
| folioF | 0 (1600) | 60 | 10 / 19 / 31 | 0.33 (± 0.05) | 0.23 / 0.50 / 0.25 | 50 (23-60), 59 | 29 |
| **folioG (shipped)** | **+150 (1750)** | 60 | 9 / 16 / 35 | **0.28** (± 0.05) | 0.17 / 0.35 / 0.33 | **50** (18-60), 56 | 26 |

| Run | Marks a battle | Folds a battle | Marks answered in time | Marks folded | Creases a battle | Crease cost (mean, median; in the band 1 to 2.5) | Battles with a Revision | Revision's worth (mean / median) | Score with / without a Revision |
|---|---|---|---|---|---|---|---|---|---|
| folioF | 9.0 | 4.7 | 27% (147 of 537) | 53% | 2.9 | 0.52, 0.23 pawns; 38 of 173 | 45 of 60 (75%) | 2.90 / 2.29 pawns | 0.38 / 0.17 |
| **folioG** | 9.1 | 4.5 | 25% (137 of 544) | 50% | 2.8 | 0.52, 0.21; 37 of 170 | 38 of 60 (63%) | 2.18 / 1.97 | 0.39 / 0.09 |

What these say:

- **The rules made the difference, more than the offset**: the same offset 0 that gave 0.58 under the sheet's rules
  (folioB, below, 26 battles) gave 0.33 under the director's (60 battles), and +150 brought it to 0.28.
- **The Crease mostly falls below its band**: about 1 crease in 5 finds a line costing the crowd 1 to 2.5 pawns; the rest
  take the nearest below (median 0.2), and none goes over the top. Most positions have no line that takes away 1 pawn of the
  crowd's best move.
- **Folds**: about 4.5 a battle, half the marks, now of the crowd's most valuable defended piece for 4 turns.
- **Revision** came in about two battles in three, worth about 2 pawns; the battles without one (a boss that didn't blunder
  into a punishment) went its way (0.09 at +150).
- Half the battles still reach the 60-move cap (the engine's verdict decides them).

## Before the director's calls: the sheet's rules (the first runs)

The first run, at the usual offset (−250) and `rageSpeed` 1 with a Draft every 4 turns (folioA), gave **0.52** (± 0.09) in
**49** moves. Then, as the testing budget allows when a number lands outside its range, four variants: the offset at 0 and
+200 (folioB, folioC: 0.58 and 0.48), and the Draft every 2 turns with `rageSpeed` 2, at −250 and +200 (folioD, folioE:
0.52 and 0.40). All five were within about one standard error of one another (130 battles in all, about 0.50): the easiest
boss in the pack, which brought the director's calls above. (In these runs the Crease stopped both sides, in a band of
0.3 to 1.5 pawns, and the Draft was a seeded pick of the top three by value, folding for 3 turns.)

## How it was run

The raid sim, as for Moo & Moon, Puddles and Babur: a Solo raid of 50 bots against it through the match runner, one battle
per game of seed 1 (each game its own random draw), no strikes, its meter on. The director's runs, 60 games as three
processes: `npx tsx packages/sim/scripts/boss-sim.ts raid folio 20 1 0 folioF1`, `... raid folio 40 1 0 folioF2 '{"skip":20}'`,
`... raid folio 60 1 0 folioF3 '{"skip":40}'`, the rows joined into `reports/boss-sim/raid-folioF.jsonl` (`folioG` the same
with `"offset":{"folio":150}`; `folioH` the same as `folioG`, on the code after the review's fixes). The first runs, 26 games each, on the code before the director's calls (commit `923b169`):
`raid folio 26 1 0 <tag> [patch]` (`folioB`: `{"offset":{"folio":0}}`; `folioC`: `{"offset":{"folio":200}}`; `folioD`:
`{"powers":{"draftEvery":2,"rageSpeed":{"folio":2}}}`; `folioE`: the same and `{"offset":{"folio":200}}`). Score: the
crowd's result per battle (a win 1, a draw ½; at the 60-move cap the engine's verdict); ± is one standard error. The bots'
tier is 1600: at −250 it plays at Stockfish's UCI_Elo 1350, at 0 at 1600, at +150 at 1750, at +200 at 1800, slipping now and then below
2100 as every boss; Revision's move is the engine's best at the sims' boss budget (120,000 nodes). The Crease's line is
picked on the same engine at `creaseNodes`. **Not repeatable seed for seed** (Stockfish draws its limited-strength moves
from the clock), so runs compare by their totals. The bots play the judge's best moves (they don't know about the mark:
the marks they answer, they answer by chance).

## The first runs' table

| Run | Offset (its Elo), `draftEvery`, `rageSpeed` | Battles | Crowd wins / draws / boss wins | Crowd score (± 1 s.e.) | Games 1-13 / 14-26 | Crowd moves: mean (range), median | At the cap |
|---|---|---|---|---|---|---|---|
| folioA | −250 (1350), 4, 1 | 26 | 11 / 5 / 10 | 0.52 (± 0.09) | 0.62 / 0.42 | 49 (26-60), 60 | 13 |
| folioB | 0 (1600), 4, 1 | 26 | 12 / 6 / 8 | 0.58 (± 0.09) | 0.62 / 0.54 | 53 (25-60), 60 | 16 |
| folioC | +200 (1800), 4, 1 | 26 | 12 / 1 / 13 | 0.48 (± 0.10) | 0.46 / 0.50 | 49 (23-60), 60 | 13 |
| folioD | −250 (1350), 2, 2 | 26 | 10 / 7 / 9 | 0.52 (± 0.09) | 0.54 / 0.50 | 52 (27-60), 59 | 11 |
| folioE | +200 (1800), 2, 2 | 26 | 9 / 3 / 14 | 0.40 (± 0.09) | 0.15 / 0.65 | 51 (20-60), 60 | 15 |

## The first runs: its powers at work

| Run | Marks a battle | Folds a battle | Marks answered in time | Marks folded | Creases a battle | Crease cost (mean, median; in the band) | Battles with a Revision | Revision's worth (the crowd's reply it crossed out, mean / median) |
|---|---|---|---|---|---|---|---|---|
| folioA | 9.2 | 4.8 | 27% (65 of 240) | 52% | 2.5 | 0.42, 0.36 pawns; 33 of 65 | 18 of 26 (69%) | 2.72 / 2.63 pawns |
| folioB | 9.8 | 5.2 | 22% | 53% | 2.8 | 0.44, 0.34; 37 of 72 | 21 (81%) | 3.35 / 2.80 |
| folioC | 9.5 | 5.0 | 24% | 52% | 2.4 | 0.36, 0.25; 26 of 63 | 20 (77%) | 2.74 / 2.13 |
| folioD | 14.9 | 8.0 | 27% | 54% | 4.1 | 0.31, 0.10; 41 of 106 | 21 (81%) | 3.10 / 2.58 |
| folioE | 14.8 | 8.0 | 25% | 54% | 4.0 | 0.37, 0.23; 48 of 105 | 19 (73%) | 2.67 / 2.05 |

(A mark not answered and not folded went because Folio moved its own piece away, or the battle ended. A crease out of the
band is the nearest one below it: about half the warnings found none inside, as many positions have no line that costs the
crowd 0.3 pawns. Revision's worth is its `drop`: how much the crowd's punishing reply had won, by the judge, which the
rewind takes back; its cost on Folio's own move was the same or more.)

## What the first runs said

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

Shipped at +150, the crowd at 0.28 (± 0.05), just above the aim's top (0.25) and under 0.30; offset 0 gave 0.33. By your
rule the sweep stopped there. The re-run after the review's fixes (folioH) gave 0.33 (± 0.05) at the same settings: the top
edge of your 0.20 to 0.33 window, within the noise of 0.28; not re-tuned, your call. As it falls a crease costs the crowd
0.39 pawns on average (median 0), and about 1 in 19 costs more than 2.5 (its cost is judged only when warned). Folio is now the only boss that plays over the usual strength (1750 against the 1600 tier in
these runs). Real players who answer the marks would score higher than these bots, who answer them only by chance.
