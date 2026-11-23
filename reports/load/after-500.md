# Load test: after-500

2026-10-07T22:59:52.506Z · http://localhost:8787 · 500 players over 20 s · crowd · session 200 s · 3.9 min
Generator: 1 Node process, CPU peak 37% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 191 | 23 ms | 111 ms | 1309 ms | 2413 ms |
| http heartbeat | 2718 | 37 ms | 344 ms | 4309 ms | 5467 ms |
| http live | 799 | 294 ms | 4492 ms | 9044 ms | 9535 ms |
| http me | 500 | 548 ms | 3268 ms | 5935 ms | 6094 ms |
| http play | 500 | 524 ms | 5017 ms | 8724 ms | 9226 ms |
| pickRtt | 2305 | 30 ms | 152 ms | 1531 ms | 2971 ms |
| playToCode | 453 | 571 ms | 5017 ms | 8724 ms | 9226 ms |
| playToLobby | 453 | 2006 ms | 9894 ms | 13.3 s | 14.0 s |
| queueWait | 453 | 3665 ms | 53.8 s | 55.1 s | 56.3 s |
| server heartbeat | 2718 | 0 ms | 1 ms | 11 ms | 15 ms |
| server live | 799 | 12 ms | 104 ms | 130 ms | 131 ms |
| server me | 500 | 185 ms | 488 ms | 634 ms | 637 ms |
| server play | 453 | 21 ms | 55 ms | 95 ms | 101 ms |
| wsOpen | 453 | 618 ms | 3003 ms | 5119 ms | 5121 ms |

Counts: msgsOut 4023 · msgsIn 543773 · playersFailed 47 · hostScores 49 · chatNo repeat 4 · end timeUp 453

Errors: play 500  (47)

## Server counters

D1 statements: 7682 reads, 1044 writes (0.54 writes per player per minute; 4.5 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT users | 1407 | 0.73 |
| SELECT inventory | 953 | 0.49 |
| SELECT equipped | 953 | 0.49 |
| SELECT wallets | 953 | 0.49 |
| SELECT chat_picks | 953 | 0.49 |
| SELECT sessions | 953 | 0.49 |
| INSERT users | 500 | 0.26 |
| INSERT sessions | 500 | 0.26 |
| SELECT results | 500 | 0.26 |
| SELECT items | 500 | 0.26 |
| SELECT equipped_items | 500 | 0.26 |
| CREATE schema | 21 | 0.01 |
| ALTER schema | 12 | 0.01 |
| SELECT queue_waits | 8 | 0.00 |
| INSERT queue_waits | 5 | 0.00 |
| UPDATE users | 4 | 0.00 |
| PRAGMA schema | 2 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 3517 | 8.4 |
| GET /api/me | 500 | 240.4 |
| POST /api/play | 453 | 26.0 |
| GET /api/lobby/:code/ws | 453 | 105.9 |

Calls: hub.seen 56 · hub.counts 293 · mm.next 453 · mm.batch 157 · mm.create 5 · lobby.persist 4596 · lobby.persistBytes 2945086427 · live.report 62 · hub.report 62 · mm.reserve 156
