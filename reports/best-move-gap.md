# A pick scored above the judge's best move

Made by `packages/sim/scripts/best-move-gap.ts` (how the positions and picks are made is in its header): 3204 judged positions from 60 games, the judge's own code at its own budget (the lite build, 250k nodes: the top-8 search, then one search over the picks outside it). Gaps in points (1 point = 1% of expected score). An "over" is a pick scored above the best move's number (the top-8 search's first line).

## How often

| | Positions | Picks outside the top 8 (per position) | Positions with an over | ... from the second search | ... from another top-8 line | Over by 1+ point | Over by 2+ | Over by 5+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Crowd (50 v 50) | 2404 | 0.45 | 3.1% | 0.1% | 3.0% | 1.0% | 0.5% | 0.1% |
| Classic-like groups of 8 | 800 | 0.18 | 1.9% | 0.0% | 1.9% | 0.8% | 0.5% | 0.0% |
| All | 3204 | 0.38 | 2.8% | 0.1% | 2.7% | 1.0% | 0.5% | 0.1% |

Of the 1224 picks the second search scored, 0.2% came out above the best move's number (0.1% by a point or more). The bots' random moves alone: 0.1%.

## By how much (gap of the top over, points)

| | Overs | p25 | median | p75 | p90 | max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| From the second search | 2 | 0.25 | 2.65 | 2.65 | 2.65 | 2.65 |
| From another top-8 line | 108 | 0.25 | 0.55 | 1.40 | 2.40 | 17.15 |

By the best move's expected score (where the over came from the second search):

| Best move's expected score | Positions | With such an over | median gap |
| --- | ---: | ---: | ---: |
| 0.0-0.1 | 354 | 0.0% | – |
| 0.1-0.3 | 60 | 0.0% | – |
| 0.3-0.7 | 2329 | 0.1% | 2.65 |
| 0.7-0.9 | 76 | 0.0% | – |
| 0.9-1.0 | 385 | 0.0% | – |

## Does a like-for-like search agree?

Each over and the first line searched again together, as the re-check does: the device's (lite, 700k nodes) and the engine server's stand-in (the full network, 2M nodes). The deep gap is the over's number less the first line's in that one search: at or above 0, the over really is at least as good; below 0, the first line is better after all.

| Overs (quick gap) | n | full: over at least as good | full: within 1 point | full: first line better by 2+ | by 5+ | full deep gap, median | lite: over at least as good | lite: first line better by 2+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| second search, under 1 point | 1 | 0.0% | 0.0% | 100.0% | 100.0% | -5.55 | 0.0% | 100.0% |
| second search, 1-5 points | 1 | 100.0% | 100.0% | 0.0% | 0.0% | 13.85 | 100.0% | 0.0% |
| second search, 5+ points | 0 | – | – | – | – | – | – | – |
| another top-8 line | 108 | 41.7% | 70.4% | 15.7% | 9.3% | -0.25 | 39.8% | 23.1% |
| all | 110 | 41.8% | 70.0% | 16.4% | 10.0% | -0.25 | 40.0% | 23.6% |

## What each rule charges, against the server's stand-in

Every over, against what the full-network search (2M nodes, like for like) says each move gave away: the first line its deep gap if the over is better, the over minus the deep gap if the first line is. The quick numbers charge the first line's pickers the quick gap and the over's nothing (today, and the promoted rule without a re-check: the same numbers). A re-check searches the two together on the device (lite, 700k nodes) and charges what it says. Promoted, the first line is an ordinary pick, so it's re-checked when its loss is in the re-check's range: from 5 points (`recheckLoss`), or from 1 for a player near the cut line (`recheckCutLoss`); the engine's first line never was (it was the anchor). Mean error in points; "2+ off": the share of overs where a side was charged 2 points or more away from the deep search.

| Rule | Overs re-checked | First line's pickers: mean error | Over's pickers: mean error | 2+ off |
| --- | ---: | ---: | ---: | ---: |
| The quick numbers (today; promoted without a re-check) | 0% | 1.48 | 2.10 | 25% |
| Promoted, the first line re-checked from 5 points | 3% | 1.12 | 2.04 | 25% |
| Promoted, near the cut line (from 1 point) | 35% | 0.66 | 1.95 | 29% |
| Every over re-checked against the first line | 100% | 0.66 | 1.78 | 37% |

(110 overs; the quick gap is 5+ points in 3% of them, 1+ in 35%.)

## The exchange check

The opening allowance's material check measures each pick against the best move. Of the 40 overs while there's an allowance (moves 1-13), the first line gives up material against the over by the check in 0 (promoted, its pickers lose the allowance), and the over against the first line in 2.

## The inconsistency players saw

In 2.8% of positions (90 of 3204) a pick was scored at least 0.05 points above the best move, which someone always picked here (the first-line player): the reveal said "you found the best move" while charging the gap. Crowd alone: 3.1%.
