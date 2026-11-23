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

## What each rule charges

Per position with a pick above the first line (F), its highest such pick P. The truth: the full-network search at 2M nodes (the engine server's stand-in), F and P like for like. F's pickers should pay the deep gap if P is better, P's pickers minus it if F is. A re-check searches F and P together: on a device (the lite build at 700k nodes), or online on the engine server (the stand-in itself, so no error once re-checked). "Other re-checked picks": in positions where the re-check runs anyway (some other pick is a close call), every pick it re-checks (X) is put on the quick scale through the re-check's anchor. Its error against the same deep search's best: main anchors on F but measures losses from P's quick number (X overcharged by the quick gap, less any real gap); this PR's first version anchored on P (X undercharged when the deep search finds F better); anchored on F with P re-checked alongside, X is measured from the deep search's best (no error). Positions searched: where a re-check runs (some pick is a close call, or F's pickers lose 5+ points to P). Near the cut line F's 1+ points count too (not modeled here).

Re-checked by a device (lite, 700k nodes), 90 positions:

| Rule | F's pickers: mean error | P's pickers: mean error | Other re-checked picks: mean error (mean of its size) | Positions searched |
| --- | ---: | ---: | ---: | ---: |
| Main: anchored on F, P never re-checked (labels named after) | 1.63 | 2.47 | 0.73 (1.14) | 43 |
| This PR's first version: anchored on P, F re-checked from 5 points | 1.19 | 2.40 | -1.24 (1.24) | 45 |
| Anchored on F, P re-checked with any re-check (chosen) | 0.92 | 2.51 | 0 (by construction) | 45 |
| Every such P re-checked, a search of its own if need be | 0.65 | 2.06 | 0 (by construction) | 90 |

Re-checked by the engine server (its stand-in, full network, 2M nodes), 90 positions:

| Rule | F's pickers: mean error | P's pickers: mean error | Other re-checked picks: mean error (mean of its size) | Positions searched |
| --- | ---: | ---: | ---: | ---: |
| Main: anchored on F, P never re-checked (labels named after) | 1.63 | 2.47 | 0.09 (1.49) | 43 |
| This PR's first version: anchored on P, F re-checked from 5 points | 1.19 | 2.19 | -1.60 (1.60) | 45 |
| Anchored on F, P re-checked with any re-check (chosen) | 0.59 | 1.43 | 0 (by construction) | 45 |
| Every such P re-checked, a search of its own if need be | 0.00 | 0.00 | 0 (by construction) | 90 |

"0 (by construction)": under the last two rules every re-checked pick is measured from the deep search's best, so this column checks they're consistent, not that they're accurate. On a device the chosen rule leaves P's pickers a little further off than before (2.51 against 2.47 points): where a re-check runs, the device's noisy re-check charges them instead of the quick numbers' 0. Online the engine server re-checks, so there a re-check is about right whatever it searches: what argues against searching every such pick is the server's daily budget, not accuracy. With several picks above F (11 of 90 positions), F's pickers are charged the largest gap.

## The exchange check

The opening allowance's material check measures each pick against the best move. Of the 40 overs while there's an allowance (moves 1-13), the first line gives up material against the over by the check in 0 (promoted, its pickers lose the allowance), and the over against the first line in 2.

## The inconsistency players saw

In 2.8% of positions (90 of 3204) a pick was scored at least 0.05 points above the best move, which someone always picked here (the first-line player): the reveal said "you found the best move" while charging the gap. Crowd alone: 3.1%.
