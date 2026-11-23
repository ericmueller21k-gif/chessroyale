# Judge determinism

Many judges needs to know: do two honest devices give identical numbers for the same scoring job?
`packages/sim/scripts/judge-determinism.ts` builds realistic jobs (a library opening, then 0–30 plies of
good-but-varied play; 3–10 people's picks including blunders; 6 bots; the device's own re-check of close calls) and
runs each in full (`runJudgeJob`: the top-8 search at 250,000 nodes, the search over picks
outside it, the 700k-node re-check) on separate engines, comparing the raw output byte for byte.

## Result: deterministic

| Comparison | Jobs | Identical |
|---|---:|---:|
| Two separate engine processes (A, B) | 201 | 201 |
| A against a "used" engine (C: another search and a limited-strength boss move before every job) | 201 | 201 |
| Node against a Web Worker in headless Chromium (W: the app's own transport) | 201 | 201 |

201 jobs, 498 searches, every score, best reply and mate identical. Stockfish with one thread, a fixed node
count and a cleared hash (`ucinewgame`) is deterministic, and the WebAssembly build is the same file everywhere.
The build has no relaxed-SIMD instructions (a scan of the .wasm's bytes), the only WebAssembly
feature whose results may differ between CPUs (x86 against a phone's ARM). Integer SIMD and the rest are exactly
specified, so the same file gives the same numbers on any device.

So the lobby demands an **exact match** (`JUDGES.tolerance = 0` in settings.ts). Untested here: real ARM phones
(this machine is x86). The lobby logs every disagreement with its size, so a platform difference would show up in
the logs at once as disagreements between honest devices.

A job took 2059 ms (median) and 2511 ms (95th percentile) on one core of this machine, with
nothing prefetched.

## Noise between a device and the engine server

For blame after a disagreement: how far an honest device's losses are from a deep verdict (the full-network build
over every move scored, standing in for the server's Stockfish 17.1), as the worst difference over a job's moves:

| Percentile | Points |
|---|---:|
| median | 6.1 |
| 90th | 24.1 |
| 99th | 38.6 |
| max | 47.5 |

A lone judge's spot check blames it only beyond the worst of these (`soloBlame`); a pair blames the further judge
only when it's `JUDGES.blameMargin` points further than the other (measured with cheaters in
`reports/many-judges.md`).
