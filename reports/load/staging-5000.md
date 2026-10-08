# Load test: staging-5000

2026-10-08T06:42:57.531Z · https://chessroyale-staging.eric-mueller21k.workers.dev · 5000 players over 120 s · crowd · session 300 s · 7.4 min
Generator: 4 Node processes, CPU peak 54% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 777 | 48 ms | 86 ms | 192 ms | 1020 ms |
| http heartbeat | 10595 | 34 ms | 598 ms | 3154 ms | 9080 ms |
| http live | 2139 | 1060 ms | 2799 ms | 4662 ms | 9141 ms |
| http me | 5000 | 8933 ms | 16.9 s | 20.9 s | 22.6 s |
| http play | 1177 | 58 ms | 181 ms | 447 ms | 586 ms |
| pickRtt | 7584 | 63 ms | 114 ms | 237 ms | 1352 ms |
| playToCode | 1177 | 58 ms | 181 ms | 447 ms | 586 ms |
| playToLobby | 1177 | 7588 ms | 13.4 s | 18.3 s | 22.8 s |
| queueWait | 1177 | 3634 ms | 23.8 s | 56.2 s | 57.4 s |
| server heartbeat | 10225 | 8 ms | 624 ms | 3116 ms | 9023 ms |
| server live | 1801 | 1269 ms | 2980 ms | 5336 ms | 9095 ms |
| server me | 1177 | 14.1 s | 18.9 s | 21.9 s | 22.6 s |
| server play | 1177 | 26 ms | 151 ms | 420 ms | 560 ms |
| wsOpen | 1177 | 2805 ms | 6824 ms | 9824 ms | 22.6 s |

Counts: msgsOut 12415 · msgsIn 1795624 · playersFailed 3823 · hostScores 178 · chatNo repeat 3 · end timeUp 1177

Errors: me 500  (3823) · live 500  (338) · heartbeat 500  (370)

## Server counters

D1 statements: 1854 reads, 949 writes (0.03 writes per player per minute; 2.1 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT sessions | 442 | 0.01 |
| CREATE schema | 383 | 0.01 |
| INSERT users | 293 | 0.01 |
| INSERT sessions | 249 | 0.01 |
| SELECT users | 229 | 0.01 |
| SELECT results | 203 | 0.01 |
| SELECT inventory | 188 | 0.01 |
| SELECT equipped | 176 | 0.00 |
| SELECT wallets | 166 | 0.00 |
| SELECT chat_picks | 155 | 0.00 |
| SELECT items | 138 | 0.00 |
| SELECT equipped_items | 125 | 0.00 |
| ALTER schema | 20 | 0.00 |
| SELECT meta | 17 | 0.00 |
| PRAGMA schema | 15 | 0.00 |
| INSERT meta | 4 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 458 | 932.5 |
| GET /api/me | 112 | 13035.4 |
| POST /api/play | 100 | 89.2 |
| GET /api/lobby/:code/ws | 5 | 4155.2 |

Calls: 
