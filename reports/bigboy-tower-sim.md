# Big Boy's tower: strength (Nov 18, 2026)

The raid sim (`packages/sim/scripts/boss-sim.ts raid bigboy 1 <seed> 0 <tag> [patch]`): a Solo raid of 50 bots against
him at his raid strength (tier 1600, Stockfish at 1350: his offset -250 sits on the 1320 floor), no God King strikes,
one battle per seed, seeds 1-13 and 31-43. Rows: `reports/boss-sim/raid-<run>.jsonl`.

- `tower`: the tower as built (all of a toppled tower's blocks scatter), the first pass.
- `half`: the tower, half its blocks (rounded up) scatter: `{"powers": {"towerScatterShare": 0.5}}`, with his rare topple.
- `base18`: control, today's main (`fe16431`): his old single block every 4 turns, no tower.
- `old15`: control, main as of Nov 15 (`e47619c`).

| Boss | Run | Games | Strikes a game | Ultimates a game | Games with 0 / 1 / 2 / 3+ | First at (median turn) | Crowd wins | Draws | Boss wins | Avg crowd moves |
|---|---|---|---|---|---|---|---|---|---|---|
| Big Boy | tower | 26 | 0.0 | 1.4 | 1 / 16 / 7 / 2 | 20 | 0% | 4% | 96% | 36 |
| Big Boy | half | 26 | 0.0 | 1.5 | 0 / 16 / 8 / 2 | 21 | 0% | 0% | 100% | 36 |
| Big Boy | base18 | 26 | 0.0 | 1.3 | 3 / 14 / 8 / 1 | 21 | 0% | 0% | 100% | 32 |
| Big Boy | old15 | 26 | 0.0 | 1.4 | 1 / 15 / 8 / 2 | 21 | 0% | 0% | 100% | 37 |

Today's Big Boy without the tower loses all 26 too (and did on Nov 15), so the tower doesn't make him stronger than he is
today. The references the brief named (`ref1` 0.35, `rf1`/`rf2` 0.27) came from an older sim whose rows carry no tier or
Elo (before Nov 8). Halving the scatter changed nothing measurable, so Eric's design stays (all blocks scatter). The call:
`docs/decisions/2026-11-18-bigboy-tower-balance.md`.

His own topples (the `half` rows' `bigboy.topples`): 2 in 26 battles (0.08 a battle), against the crowd's 1.65 and his
fall at 10's 1.96.
