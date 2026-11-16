# 64-player format: bot check

25 full matches of 64 bots for each setting (Stockfish at 100,000 nodes, real boards and the 2v2 final), from
`packages/sim/scripts/format-sim.ts`. Bots' skills span T = 0.25 (strongest) to 32 on a log scale.

| | 5 rounds per stage | 6 rounds per stage | Old format (32 players, 8 rounds) |
| --- | --- | --- | --- |
| Rank correlation, skill vs placement | 0.63 | 0.64 | 0.67 |
| A top-8 bot out in stage 1 | 28% | 28% | 26% (a top-4 bot) |
| Strongest bot reaches the final | 20% | 28% | 35% (the duel) |
| Strongest bot wins | 4% | 4% | 21% |
| Top-4 bots among the finalists (average) | 1.0 | 1.2 | – |
| Dead rounds (every pick within 1 point) | 38% | 40% | 43% |
| Games that ended mid-match | 0.16 | 0.28 | – |
| Knockout rounds | 40 | 48 | 40 |
| Final turns | 19.6 | 19.5 | – |

Notes:
- The final is won on average loss over 5 moves each, among four similar, strong bots, so it's close to a coin flip
  between them. The strongest bot reaches the final about 1 match in 4 and then wins about 1 final in 4, so winning
  about 1 match in 16 is what you'd expect; 1 in 25 here is within noise.
- 6 rounds per stage is a little fairer, but with 25 matches the difference is within noise, and it adds about 4
  minutes. The game uses 5.
