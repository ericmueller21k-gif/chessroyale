# How often the scoring engine misjudges a pick

60 positions, 720 picks (each position: the scorer's top 8 plus 4 random legal moves). Referee: the full-network Stockfish 19, each move searched on its own at a much bigger budget. Loss is in points (1 point = 1% of expected score).

| Scorer | Good move marked a mistake (ref ≤ 3, scorer ≥ 10) | ... marked a blunder (scorer ≥ 20) | Bad move let off (ref ≥ 15, scorer ≤ 5) | Typical error (median) | 90th pct error | Same best pick as referee |
| --- | --- | --- | --- | --- | --- | --- |
| Today: lite, 250k nodes | 1.7% (6/353) | 0.3% | 2.9% (7/242) | 0.8 | 10.7 | 80.0% |
| Lite, 1M nodes (4x time) | 1.4% (5/353) | 0.0% | 1.2% (3/242) | 0.7 | 9.7 | 80.0% |
| Full network, 250k nodes | 0.6% (2/353) | 0.3% | 1.2% (3/242) | 0.7 | 7.1 | 85.0% |

## Does it change who gets cut?

`npx tsx packages/sim/scripts/judge-cuts.ts 600`: 600 replayed 100-player crowd matches on these positions. Players of a wide spread of skill pick by true quality (the referee's losses), with a 5% random blunder; the same picks are scored by each judge; the 50 v 50 cut schedule down to the final 8. "Really in the top half/quarter" means by the referee's running score among the players still alive at that cut.

| Judge | Cut while really in the top half | Cut while really in the top quarter | Any swap at the cut line | Top-10 players in the final 8 |
| --- | --- | --- | --- | --- |
| Referee (truth) | 0.00% | 0.00% | 0.0% | 4.82 |
| Today: lite 250k | 5.86% | 1.70% | 25.6% | 3.82 |
| Lite 1M (4x time) | 3.44% | 0.72% | 23.1% | 4.11 |
| Full net 250k | 4.82% | 1.36% | 22.0% | 3.99 |
| Today + 3-point good-move band | 8.28% | 3.35% | 27.1% | 2.82 |
| Today + deep re-check of picks it calls 8+ | 3.62% | 0.77% | 21.1% | 4.07 |
| Today + band + re-check | 7.52% | 3.32% | 24.2% | 2.55 |
| Today + re-check 8+ with lite 1M (phone can do) | 4.35% | 1.04% | 24.9% | 3.90 |
| Today + re-check 5+ with lite 1M (phone can do) | 3.75% | 0.78% | 24.3% | 4.01 |
| Lite 1M + re-check 8+ with the referee (a server) | 1.50% | 0.24% | 16.8% | 4.50 |

Reading:

- Per move, today's judge is rarely badly wrong: a genuinely good move is marked 10+ points worse 1.7% of the time, 20+ points 0.3%.
- But a cut separates players whose games differ by a few points, so small errors matter there. Today, 1.7% of cut players were really in the top quarter: one or two per match.
- A "good-move band" (calling anything within 3 points of the best perfect) makes it worse: the small differences between good moves are what separate strong players.
- Re-checking the costly picks with a deeper search halves it on a phone (lite at 1M nodes); a server-grade engine for the re-check cuts it about 7 times.
- The referee is itself an engine (full network, 2M nodes per move), so "truth" here is a much stronger engine, not perfect play.
