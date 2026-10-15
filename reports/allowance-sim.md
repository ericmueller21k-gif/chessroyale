# The opening allowance and ties at the cut: Crowd 50 v 50 bot matches

Made by `packages/sim/scripts/allowance-sim.ts`: 12 matches before the change and 12 after, the same seeds (the matches are identical up to the first cut), 100 bots (skills spread from strongest to loosest), team final.

Eric's goal: "the goal is simply to still cut players playing poor, and not punish players not playing precise engine lines or slight variations in the opening 10-14 moves."

- **Poor play:** a pick that gave up a pawn or more against the best move by the exchange check (the allowance's fallback), or lost 20 points or more (raw).
- **Slight variations:** every pick among the engine's top 8.

## Cut 1 (after move 10)

| | before | after |
| --- | ---: | ---: |
| Players cut (per match) | 16.0 | 15.1 |
| **Of those who played only top-8 moves (nothing poor), went through** | 96% | 99% |
| **Of those who had played poorly, cut** | 38% | 39% |
| Cut players who played poorly (a material error, a loss of 20+ or a miss) | 83% | 91% |
| Cut players with a negative score | 100% | 97% |
| Cut players' bot temperature (median; higher is looser) | 15.3 | 11.4 |
| Survivors who played only top-8 moves | 91% | 93% |
| Survivors who had played poorly | 26% | 25% |
| Still owed after this cut: kept in by ties (per match) | 0.0 | 0.9 |

## Cut 2 (after move 11)

| | before | after |
| --- | ---: | ---: |
| Players cut (per match) | 14.0 | 11.9 |
| **Of those who played only top-8 moves (nothing poor), went through** | 92% | 97% |
| **Of those who had played poorly, cut** | 38% | 43% |
| Cut players who played poorly (a material error, a loss of 20+ or a miss) | 66% | 85% |
| Cut players with a negative score | 99% | 77% |
| Cut players' bot temperature (median; higher is looser) | 9.9 | 10.4 |
| Survivors who played only top-8 moves | 93% | 95% |
| Survivors who had played poorly | 22% | 18% |
| Still owed after this cut: kept in by ties (per match) | 0.0 | 3.0 |

## The whole match

| | before | after |
| --- | ---: | ---: |
| Plies per match (mean) | 160.3 | 150.5 |
| Cuts with fewer out than the plan (share) | 0% | 32% |
| Cuts with an exact tie at a team's line (share) | 8% | 56% |
| Still owed after each cut (mean: kept in by ties, not yet taken) | 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 | 0.9 · 3.0 · 4.9 · 6.8 · 6.6 · 6.2 · 6.2 · 4.7 · 3.9 · 2.8 · 0.0 |
| Most owed at once (mean of each match's largest) | 0.0 | 9.3 |
| Out at each cut (mean) | 16.0 · 14.0 · 12.0 · 10.0 · 8.0 · 8.0 · 6.0 · 6.0 · 4.0 · 4.0 · 4.0 | 15.1 · 11.9 · 10.1 · 8.2 · 8.2 · 8.4 · 6.0 · 7.5 · 4.8 · 5.1 · 6.8 |
| Finalists (every match) | 8 | 8 |
| Placement against bot skill (Spearman) | 0.763 | 0.640 |

## Which part does what

Arms, the same seeds: `ties-only` (the allowance's points set to 0), `allowance-only` (every cut takes exactly what it owes, ties broken as at the last cut), `after-next-cut` (both, with what a cut leaves over owed by the next cut, as first built). Spearman of each bot's temperature against its placement (± its standard error over the matches), among the last 20 placed and among the 8 finalists; the winner among the strongest quarter of the bots.

| | before | ties-only | allowance-only | after-next-cut | after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Spearman, all 100 | 0.763 ±0.020 | 0.761 ±0.019 | 0.676 ±0.028 | 0.634 ±0.021 | 0.640 ±0.023 |
| Spearman, the last 20 | 0.500 | 0.526 | 0.464 | 0.465 | 0.476 |
| Spearman, the 8 finalists | 0.226 | 0.198 | 0.264 | 0.268 | 0.236 |
| Winner in the strongest quarter | 11/12 | 11/12 | 12/12 | 12/12 | 11/12 |
| Out at each cut (mean) | 16.0 · 14.0 · 12.0 · 10.0 · 8.0 · 8.0 · 6.0 · 6.0 · 4.0 · 4.0 · 4.0 | 15.9 · 14.0 · 12.1 · 10.0 · 8.0 · 7.9 · 6.0 · 6.1 · 3.9 · 4.0 · 4.1 | 16.0 · 14.0 · 12.0 · 10.0 · 8.0 · 8.0 · 6.0 · 6.0 · 4.0 · 4.0 · 4.0 | 15.1 · 12.2 · 10.2 · 8.3 · 12.2 · 7.8 · 6.3 · 4.6 · 5.3 · 3.8 · 6.5 | 15.1 · 11.9 · 10.1 · 8.2 · 8.2 · 8.4 · 6.0 · 7.5 · 4.8 · 5.1 · 6.8 |
| The move-14 cut (the 5th): out (mean) | 8.0 | 8.0 | 8.0 | 12.2 | 8.2 |
| Plies per match (mean) | 160 | 155 | 160 | 159 | 151 |
