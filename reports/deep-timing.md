# Deep re-checks in a browser

`packages/sim/scripts/deep-timing.ts`: the lite build (`stockfish-19-lite-single`) in a Web Worker in headless
Chromium on this machine (one thread, as the app runs it), timed on 18 realistic positions: the re-check's
search (the best move and four others, restricted to them) at each node count, and the top-8 search the judges run
(250,000 nodes). CPU slowdown is Chrome's own throttling (devtools' "4x slowdown" is roughly a mid-range phone).

| Build | CPU | Speed check (nodes/s, 1st / 2nd) | Top-8 search | Re-check 0.7M (median / max) | Re-check 1M (median / max) | Re-check 2M (median / max) | Nodes/s at 2M |
|---|---|---|---:|---:|---:|---:|---:|
| lite (the app's) | this machine | 479,886 / 544,620 | 485 ms | 1.42 / 1.58 s | 2.01 / 2.28 s | 4.13 / 4.51 s | 483,910 |
| lite (the app's) | devtools 4x throttling | 446,114 / 522,386 | 448 ms | 1.44 / 1.57 s | 2.05 / 2.29 s | 4.10 / 4.55 s | 487,924 |
| full network (99 MB) | this machine | 243,495 / 276,210 | 881 ms | 2.69 / 2.73 s | 3.97 / 4.13 s | 7.70 / 8.08 s | 259,841 |

Chrome's CPU throttling turns out not to slow a Web Worker (the throttled rows match the others), so a phone's speed
isn't measured here; phones don't do deep checks anyway. The speed check's reading (150k nodes) matches the re-check's
own speed, so a device's reported speed predicts how long its re-check takes.

The engine server takes about 3 s for its 2M-node re-check (700k nodes/s on one core), after the judges' answers are
in; that's the time a round already waits for close calls today. See DECISIONS.md, "Deep checks on players'
computers", for the node count and speed threshold chosen from these.
