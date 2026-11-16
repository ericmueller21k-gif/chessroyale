# The close-call re-check: players' computers against the engine server

`packages/sim/scripts/deep-accuracy.ts`: on the 60 positions and 720 picks of `reports/judge-accuracy.md` (with the referee's
losses: the full network, 2M nodes a move), the 267 picks today's quick judge (lite, 250k) says lose 5-60 points
are re-checked as the game re-checks them (one search over them and the best move, 2M nodes) by the lite build (what a
computer's browser runs) and by the full-network build (standing in for the engine server's Stockfish 17.1).

**Error against the referee (points)**

| Re-check | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
| None (the quick judge's number) | 4.5 | 17.7 | 7.68 | 125 | 58 |
| Lite, 2M nodes (two computers) | 2.4 | 15.6 | 5.99 | 78 | 43 |
| Full network, 2M nodes (the engine server) | 1.6 | 10.0 | 4.82 | 49 | 26 |

**Who gets cut** (`judge-cuts.ts 600`: 600 replayed 100-player crowd matches, the same picks scored by each judge)

| Judge | Cut while really in the top half | Cut while really in the top quarter | Any swap at the cut line | Top-10 players in the final 8 |
| --- | --- | --- | --- | --- |
| Referee (truth) | 0.00% | 0.00% | 0.0% | 4.82 |
| Today: lite 250k | 5.86% | 1.70% | 25.6% | 3.82 |
| As the game runs it: re-check 5-60, full network 2M (the engine server) | 2.09% | 0.37% | 21.9% | 4.36 |
| As the game runs it: re-check 5-60, lite 2M (two computers) | 3.52% | 0.63% | 24.2% | 4.09 |

The computers' re-check helps (against none), but cuts strong players unfairly about 1.7 times as often as the
server's. So, by Eric's rule (fair scoring first), close calls stay with the engine server, and `JUDGES.deepOnDevices`
ships off. (Measured on this machine: the full network in Chrome runs about 260k nodes/s, so 2M nodes take about
8 s, too slow for a round, and its 99 MB file is over Cloudflare's 25 MiB limit for a static file.)
