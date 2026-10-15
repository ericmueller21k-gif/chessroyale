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
| Kept in by a tie at the line, owed by the next cut (per match) | 0.0 | 0.9 |

## Cut 2 (after move 11)

| | before | after |
| --- | ---: | ---: |
| Players cut (per match) | 14.0 | 12.2 |
| **Of those who played only top-8 moves (nothing poor), went through** | 92% | 97% |
| **Of those who had played poorly, cut** | 38% | 44% |
| Cut players who played poorly (a material error, a loss of 20+ or a miss) | 66% | 86% |
| Cut players with a negative score | 99% | 75% |
| Cut players' bot temperature (median; higher is looser) | 9.9 | 10.4 |
| Survivors who played only top-8 moves | 93% | 95% |
| Survivors who had played poorly | 22% | 18% |
| Kept in by a tie at the line, owed by the next cut (per match) | 0.0 | 2.8 |

## The whole match

| | before | after |
| --- | ---: | ---: |
| Plies per match (mean) | 160.3 | 158.8 |
| Cuts with fewer out than the plan (share) | 0% | 39% |
| Cuts with an exact tie at a team's line (share) | 8% | 67% |
| Owed to the next cut after each cut (mean: kept in by ties, not yet taken) | 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 · 0.0 | 0.9 · 2.8 · 4.6 · 6.3 · 2.2 · 2.4 · 2.2 · 3.6 · 2.3 · 2.5 · 0.0 |
| Most owed at once (mean of each match's largest) | 0.0 | 9.3 |
| Out at each cut (mean) | 16.0 · 14.0 · 12.0 · 10.0 · 8.0 · 8.0 · 6.0 · 6.0 · 4.0 · 4.0 · 4.0 | 15.1 · 12.2 · 10.2 · 8.3 · 12.2 · 7.8 · 6.3 · 4.6 · 5.3 · 3.8 · 6.5 |
| Finalists (every match) | 8 | 8 |
| Placement against bot skill (Spearman) | 0.763 | 0.634 |
