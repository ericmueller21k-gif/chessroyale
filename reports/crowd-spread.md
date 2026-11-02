# Crowd 50 v 50: how the bots spread, and the team's move (Nov 2, 2026)

Written by hand from `npx tsx packages/sim/scripts/crowd-spread-probe.ts` (its raw turns go to
`reports/crowd-spread/*.jsonl`, not kept in git). Bot-only 50 v 50 games through the real runner: 100 bots at the
lobby's ratings (botRoster), the judge at 100k nodes. **Before**: the bots and the played move as they were until Nov 2
(botPick over the judge's top 8; every bot holding a power-up plays the best line on a sharp turn; the most popular pick
plays). **After**: CROWD_BOTS (the turn's shared lean, the good lines, power-ups by chance) and the move drawn from the
three most picked (crowdPlayedFromTop). docs/decisions/2026-11-02-crowd-bot-spread.md.

## Why the team went unanimous

On a sharp turn (the second line gives away `botPowerUpLoss`, 15 points, or more) every bot holding a power-up used it
and played the engine's best line. Crowd bots start with 3 each, so the first sharp turns of a game were unanimous: Eric's
castle (a Random opening's move 7, castling best, every other line 19.5 points or more worse) is one; 7.8% of all turns
were 95% one move or more, nearly all of them these. Elsewhere the bots scattered almost evenly over the top 8 lines.

## The numbers

Normal start, 48 games, the first 40 team turns each (1920 turns); Random opening, 48 games, the 8 turns after the
opening (moves 5 to 8, 384 turns). "Blunder": a pick giving away 15 points or more.

| | Normal: before | Normal: after | Random opening: before | Random opening: after |
| --- | --- | --- | --- | --- |
| The plurality is the engine's best | 33.2% | 38.9% | 29.9% | 35.7% |
| The plurality's share of the picks (average) | 29% | 45% | 28% | 42% |
| Turns at 95% one move or more | 7.8% | 1.4% | 7.8% | 0.5% |
| Turns at 80%+ on one move while other good lines were there | 0% | 2.1% | 0% | 1.0% |
| Distinct moves picked a turn (average) | 7.7 | 6.4 | 8.1 | 7.0 |
| The played move is the engine's best | 33.7% | 34.5% | 30.2% | 31.8% |
| The played move is a top-3 line | 61% | 74% | 62.5% | 73.4% |
| The played move is a blunder | 1.9% | 1.0% | 1.0% | 1.0% |
| The played move's loss (average points) | 2.28 | 2.02 | 2.36 | 2.21 |
| Bot picks that are blunders | 9.7% | 3.8% | 10.1% | 4.0% |

The played move's engine rank, normal start, before: 1st 647, 2nd 296, 3rd 229, 4th 179, 5th 144, 6th to 8th 415;
after: 1st 662, 2nd 438, 3rd 320, 4th 269, 5th 222, 6th or lower 9.

**Unique lines** (all 48 normal-start games from the same start): two games part ways at ply 0.14 on average before,
0.23 after (median 0 both: the first move already differs); 48 distinct lines of 48 by move 10 and by move 20, before
and after. The old bots already scattered over the top 8 almost evenly, so lines were unique already; the change keeps
that while the team plays good lines more often (74% top 3, from 61%) and herds the way people do.

**The bots' points given away a pick, by rating** (normal start; the 600 row is 600 and 700, 900 is 800 to 1000, 1200
is 1100 to 1300, 1500 is 1400 to 1600, 1900 is 1900 and 2000):

| Rating | Before | After | Maia at that rating (reports/maia-calibration.md) |
| --- | --- | --- | --- |
| 600 | 6.73 | 4.06 | 9.78 |
| 900 | 6.20 | 3.76 | 6.81 |
| 1200 | 5.30 | 3.27 | 5.21 |
| 1500 | 4.27 | 2.68 | 4.38 |
| 1900 | 3.28 | 2.16 | 3.78 (1800) |

## Re-calibrating the temperatures (tried, not taken)

The probe with temperatures spread from 4 to 1024 (`... probe`) measures what this pick gives away: with blunder weight
0.1, from 1.6 a pick (temperature 4 to 6) to 4.8 (256 and up); 0.2: 1.5 to 5.9. A table matching Maia (2400 at 11.6,
1800 at 21.5, 1500 at 35, 1200 at 71, 900 and 600 held at 256 and 1024, blunder weight 0.2) gave, with the lobby's
bots: 1200 at 4.3 a pick, bot blunders 6.4%, played blunders 2.3% (from 2.0% before), the played move a top-3 line
only 67%. The points come from blunders: a 1200 bot then missed a plain recapture about half the time, and with the
move drawn from the top 3, the team played some of them. Eric's goal comes first (variety, blunders rare), so the bots
keep BOT_LOBBY's temperatures: the same order by rating, about 60% of the points they gave away before.

Eric's check (Nov 1: "a player making the engine's best moves should finish 1st or 2nd"), after this change:
`npx tsx packages/sim/scripts/crowd-bots-sim.ts tuned 4 101` and `... tuned 4 201`, 8 full matches: the engine-best
player finished 1, 1, 1, 1, 2, 1, 1, 1.
