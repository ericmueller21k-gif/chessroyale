# Load test: after-500

2026-10-07T22:49:53.089Z · http://localhost:8787 · 500 players over 20 s · crowd · session 200 s · 3.9 min
Generator CPU peak (one Node process): 51%

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 170 | 20 ms | 109 ms | 2811 ms | 5313 ms |
| http heartbeat | 2700 | 40 ms | 2969 ms | 8736 ms | 8766 ms |
| http live | 807 | 527 ms | 3800 ms | 7462 ms | 8193 ms |
| http me | 500 | 817 ms | 3845 ms | 4603 ms | 4698 ms |
| http play | 500 | 691 ms | 3340 ms | 6660 ms | 7424 ms |
| pickRtt | 1763 | 30 ms | 208 ms | 3577 ms | 5350 ms |
| playToCode | 450 | 672 ms | 2791 ms | 6368 ms | 6726 ms |
| playToLobby | 450 | 2944 ms | 8344 ms | 15.5 s | 17.1 s |
| queueWait | 450 | 4621 ms | 51.1 s | 55.6 s | 55.6 s |
| server heartbeat | 2700 | 0 ms | 57 ms | 141 ms | 308 ms |
| server live | 807 | 17 ms | 193 ms | 223 ms | 225 ms |
| server me | 500 | 203 ms | 817 ms | 834 ms | 835 ms |
| server play | 450 | 39 ms | 55 ms | 118 ms | 119 ms |
| wsOpen | 1297 | 1263 ms | 1794 ms | 4136 ms | 7788 ms |

Counts: msgsOut 4471 · msgsIn 467297 · wsDropped 847 · playersFailed 50 · hostScores 247 · end timeUp 450

Errors: play 503  (50)

## Server counters

D1 statements: 3607 reads, 26 writes (0.01 writes per player per minute; 0.1 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT users | 901 | 0.47 |
| SELECT sessions | 900 | 0.47 |
| SELECT inventory | 450 | 0.23 |
| SELECT equipped | 450 | 0.23 |
| SELECT wallets | 450 | 0.23 |
| SELECT chat_picks | 450 | 0.23 |
| CREATE schema | 21 | 0.01 |
| SELECT queue_waits | 4 | 0.00 |
| PRAGMA schema | 2 | 0.00 |
| UPDATE users | 2 | 0.00 |
| ALTER schema | 1 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 1552 | 7.7 |
| GET /api/lobby/:code/ws | 450 | 626.9 |

Calls: hub.seen 23 · hub.counts 122 · lobby.persist 2574 · lobby.persistBytes 518247538 · live.report 76 · hub.report 76
