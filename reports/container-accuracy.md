# The engine server as deployed: its own Stockfish on the close-call re-checks

`packages/sim/scripts/container-accuracy.ts`: the 267 re-checked picks of `reports/deep-accuracy.md` (60
positions; each position's picks the quick judge, lite at 250k, says lose 5-60 points, with its best move: one search,
2M nodes), searched again by the engine server's own binary (native Stockfish 17.1 with its full network, run from the
container image built from `engine/Dockerfile`, in CI). There, the full-network Stockfish 19 build stood in for it.
The referee is that same Stockfish 19 full network (each move on its own, 2M nodes), so it leans toward its own build.

**Error against the referee (points)**

| Re-check | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
| None (the quick judge's number) | 4.5 | 17.7 | 7.68 | 125 | 58 |
| Stockfish 19 full network, 2M (the stand-in) | 1.6 | 10.0 | 4.82 | 49 | 26 |
| Native Stockfish 17.1, 2M (the server as deployed) | 2.9 | 13.7 | 6.23 | 88 | 43 |

**The server as deployed against its stand-in** (the same re-check, point for point)

| | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
| Native 17.1 against Stockfish 19 full | 1.9 | 8.7 | 3.23 | 58 | 20 |

On average 17.1 calls a re-checked pick 0.83 points better than Stockfish 19 does.

**Who gets cut** (`judge-cuts.ts 600`: 600 replayed 100-player crowd matches, the same picks scored by each judge)

| Judge | Cut while really in the top half | Cut while really in the top quarter | Any swap at the cut line | Top-10 players in the final 8 |
| --- | --- | --- | --- | --- |
| Referee (truth) | 0.00% | 0.00% | 0.0% | 4.82 |
| Today: lite 250k | 5.86% | 1.70% | 25.6% | 3.82 |
| As the game runs it: re-check 5-60, full network 2M (the engine server) | 2.09% | 0.37% | 21.9% | 4.36 |
| As the game runs it: re-check 5-60, lite 2M (two computers) | 3.52% | 0.63% | 24.2% | 4.09 |
| As deployed: re-check 5-60, native Stockfish 17.1 2M (the engine server's own binary) | 3.61% | 0.64% | 24.9% | 4.08 |

With the server's own numbers, the re-check's gain over today's quick judge is about what two players' computers
(lite, 2M) give, not what its Stockfish 19 stand-in gave. Part of that is the referee's lean toward its own build, so
17.1 isn't shown to be wrong; but every number the judge was tuned on (`reports/judge-accuracy.md`,
`reports/deep-accuracy.md`) is Stockfish 19's, and the server's isn't (DECISIONS.md, "The engine server's own
Stockfish, checked in CI", Oct 15).
