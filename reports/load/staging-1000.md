# Load test: staging-1000

2026-10-08T06:36:02.506Z · https://chessroyale-staging.eric-mueller21k.workers.dev · 1000 players over 60 s · crowd · session 300 s · 6.5 min
Generator: 1 Node process, CPU peak 125% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 668 | 187 ms | 1509 ms | 3481 ms | 4803 ms |
| http heartbeat | 9012 | 37 ms | 166 ms | 2727 ms | 8836 ms |
| http live | 1816 | 1321 ms | 2601 ms | 7893 ms | 9104 ms |
| http me | 1000 | 15.7 s | 19.9 s | 21.3 s | 23.1 s |
| http play | 1000 | 71 ms | 262 ms | 630 ms | 693 ms |
| pickRtt | 6759 | 228 ms | 734 ms | 1425 ms | 2226 ms |
| playToCode | 1000 | 72 ms | 262 ms | 630 ms | 693 ms |
| playToLobby | 1000 | 12.0 s | 17.0 s | 19.0 s | 20.9 s |
| queueWait | 1000 | 4201 ms | 9284 ms | 13.2 s | 15.5 s |
| server heartbeat | 9012 | 9 ms | 113 ms | 2687 ms | 8787 ms |
| server live | 1816 | 1224 ms | 2551 ms | 7833 ms | 9067 ms |
| server me | 1000 | 15.6 s | 19.9 s | 21.2 s | 23.1 s |
| server play | 1000 | 34 ms | 225 ms | 601 ms | 641 ms |
| wsOpen | 1000 | 3512 ms | 5532 ms | 6600 ms | 6615 ms |

Counts: msgsOut 10931 · msgsIn 1597175 · hostScores 136 · chatNo repeat 8 · end timeUp 1000

Errors: none

## Server counters

D1 statements: 680 reads, 116 writes (0.02 writes per player per minute; 0.3 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT sessions | 216 | 0.03 |
| INSERT users | 58 | 0.01 |
| INSERT sessions | 58 | 0.01 |
| SELECT users | 58 | 0.01 |
| SELECT results | 58 | 0.01 |
| SELECT inventory | 58 | 0.01 |
| SELECT equipped | 58 | 0.01 |
| SELECT wallets | 58 | 0.01 |
| SELECT chat_picks | 58 | 0.01 |
| SELECT items | 58 | 0.01 |
| SELECT equipped_items | 58 | 0.01 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 261 | 693.8 |
| GET /api/me | 58 | 12780.9 |
| POST /api/play | 46 | 69.3 |
| GET /api/lobby/:code/ws | 1 | 6146.0 |

Calls: 
