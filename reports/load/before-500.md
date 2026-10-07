# Load test: before-500

2026-10-07T22:36:34.832Z · http://localhost:8787 · 500 players over 20 s · crowd · session 200 s · 4.0 min
Generator CPU peak (one Node process): 46%

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 170 | 278 ms | 4247 ms | 7142 ms | 8604 ms |
| http heartbeat | 2238 | 373 ms | 6782 ms | 11.6 s | 12.3 s |
| http live | 785 | 765 ms | 6632 ms | 9011 ms | 9463 ms |
| http me | 500 | 860 ms | 6837 ms | 7793 ms | 7989 ms |
| http play | 500 | 1257 ms | 3802 ms | 8076 ms | 9086 ms |
| pickRtt | 1644 | 195 ms | 2496 ms | 4510 ms | 6083 ms |
| playToCode | 496 | 1265 ms | 3802 ms | 8076 ms | 9087 ms |
| playToLobby | 373 | 2707 ms | 9999 ms | 11.3 s | 11.5 s |
| queueWait | 373 | 7644 ms | 58.6 s | 58.7 s | 58.7 s |
| server heartbeat | 2238 | 25 ms | 320 ms | 459 ms | 7569 ms |
| server live | 785 | 123 ms | 1317 ms | 1329 ms | 1351 ms |
| server me | 500 | 302 ms | 1645 ms | 1651 ms | 1653 ms |
| server play | 496 | 122 ms | 734 ms | 1314 ms | 1550 ms |
| wsOpen | 1431 | 1980 ms | 3698 ms | 6875 ms | 8900 ms |

Counts: msgsOut 4379 · msgsIn 432138 · end error 123 · playersFailed 4 · hostScores 208 · wsDropped 1018 · end timeUp 373

Errors: lobby error: This match has already started. (123) · play 500  (4) · ws error WebSocket was closed before the connection was established (4)

## Server counters

D1 statements: 1771 reads, 487 writes (0.25 writes per player per minute; 2.0 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT users | 455 | 0.23 |
| SELECT sessions | 266 | 0.13 |
| UPDATE users | 266 | 0.13 |
| INSERT live_lobbies | 197 | 0.10 |
| SELECT inventory | 189 | 0.10 |
| SELECT equipped | 189 | 0.10 |
| SELECT wallets | 189 | 0.10 |
| SELECT chat_picks | 189 | 0.10 |
| SELECT live_lobbies | 146 | 0.07 |
| SELECT queue_waits | 146 | 0.07 |
| CREATE schema | 21 | 0.01 |
| PRAGMA schema | 2 | 0.00 |
| ALTER schema | 1 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/lobby/:code/ws | 193 | 486.6 |
| GET /api/live | 73 | 387.8 |

Calls: lobby.persist 533 · lobby.persistBytes 1309379385 · live.report 197
