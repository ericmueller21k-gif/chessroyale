# Load test: after-1000

2026-10-07T23:17:30.093Z · http://localhost:8787 · 1000 players over 30 s · crowd · session 180 s · 3.8 min
Generator: 2 Node processes, CPU peak 21% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 252 | 43 ms | 362 ms | 3640 ms | 4674 ms |
| http heartbeat | 3294 | 212 ms | 7886 ms | 11.1 s | 12.7 s |
| http live | 1331 | 2057 ms | 7162 ms | 11.2 s | 13.0 s |
| http me | 1000 | 5109 ms | 10.9 s | 12.7 s | 12.9 s |
| http play | 1000 | 1314 ms | 4224 ms | 9648 ms | 11.7 s |
| pickRtt | 2583 | 47 ms | 628 ms | 3658 ms | 4832 ms |
| playToCode | 658 | 2014 ms | 4481 ms | 10.2 s | 11.7 s |
| playToLobby | 658 | 8325 ms | 16.8 s | 21.3 s | 22.5 s |
| queueWait | 658 | 5116 ms | 11.1 s | 56.1 s | 56.1 s |
| server heartbeat | 3294 | 1 ms | 26 ms | 94 ms | 243 ms |
| server live | 1331 | 231 ms | 705 ms | 709 ms | 767 ms |
| server me | 1000 | 1345 ms | 3033 ms | 3041 ms | 3042 ms |
| server play | 658 | 66 ms | 167 ms | 263 ms | 333 ms |
| wsOpen | 658 | 2446 ms | 7097 ms | 13.6 s | 13.6 s |

Counts: msgsOut 4994 · msgsIn 641772 · playersFailed 342 · hostScores 53 · chatNo repeat 4 · end timeUp 658

Errors: play 500  (342)

## Server counters

D1 statements: 13746 reads, 2015 writes (0.53 writes per player per minute; 8.8 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT users | 2316 | 0.60 |
| SELECT inventory | 1658 | 0.43 |
| SELECT equipped | 1658 | 0.43 |
| SELECT wallets | 1658 | 0.43 |
| SELECT chat_picks | 1658 | 0.43 |
| SELECT sessions | 1658 | 0.43 |
| INSERT users | 1000 | 0.26 |
| INSERT sessions | 1000 | 0.26 |
| SELECT results | 1000 | 0.26 |
| SELECT items | 1000 | 0.26 |
| SELECT equipped_items | 1000 | 0.26 |
| SELECT queue_waits | 140 | 0.04 |
| INSERT queue_waits | 7 | 0.00 |
| UPDATE users | 6 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 4625 | 84.3 |
| GET /api/me | 1000 | 1283.0 |
| POST /api/play | 658 | 70.7 |
| GET /api/lobby/:code/ws | 658 | 487.1 |

Calls: hub.seen 2362 · hub.counts 2794 · mm.next 658 · mm.batch 110 · mm.create 7 · lobby.persist 4613 · live.report 145 · hub.report 145 · mm.reserve 109 · lobby.persistWithLast 1275
