# Load test: before-500

2026-10-07T22:55:44.752Z · http://localhost:8787 · 500 players over 20 s · crowd · session 200 s · 4.0 min
Generator: 1 Node process, CPU peak 23% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 173 | 34 ms | 135 ms | 2436 ms | 3377 ms |
| http heartbeat | 1848 | 70 ms | 1278 ms | 7839 ms | 9743 ms |
| http live | 682 | 1918 ms | 5355 ms | 10.0 s | 10.8 s |
| http me | 500 | 3558 ms | 10.1 s | 11.0 s | 11.2 s |
| http play | 500 | 1385 ms | 4346 ms | 7778 ms | 9821 ms |
| pickRtt | 1737 | 47 ms | 138 ms | 2369 ms | 2762 ms |
| playToCode | 432 | 1495 ms | 4807 ms | 7778 ms | 9821 ms |
| playToLobby | 308 | 3310 ms | 11.1 s | 14.9 s | 16.7 s |
| queueWait | 308 | 2760 ms | 10.8 s | 53.4 s | 53.4 s |
| server heartbeat | 1848 | 10 ms | 50 ms | 199 ms | 737 ms |
| server live | 682 | 313 ms | 2092 ms | 2558 ms | 2560 ms |
| server me | 500 | 1330 ms | 2898 ms | 2921 ms | 2922 ms |
| server play | 432 | 655 ms | 1713 ms | 2725 ms | 2737 ms |
| wsOpen | 432 | 1485 ms | 4629 ms | 7522 ms | 9628 ms |

Counts: msgsOut 3095 · msgsIn 407871 · end error 124 · playersFailed 68 · hostScores 53 · chatNo repeat 3 · end timeUp 308

Errors: lobby error: This match has already started. (124) · play 500  (68)

## Server counters

D1 statements: 11661 reads, 4636 writes (2.29 writes per player per minute; 19.1 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| UPDATE users | 2963 | 1.46 |
| SELECT sessions | 2962 | 1.46 |
| SELECT users | 1785 | 0.88 |
| SELECT inventory | 932 | 0.46 |
| SELECT equipped | 932 | 0.46 |
| SELECT wallets | 932 | 0.46 |
| SELECT chat_picks | 932 | 0.46 |
| SELECT live_lobbies | 842 | 0.42 |
| SELECT queue_waits | 842 | 0.42 |
| INSERT live_lobbies | 634 | 0.31 |
| INSERT users | 500 | 0.25 |
| INSERT sessions | 500 | 0.25 |
| SELECT results | 500 | 0.25 |
| SELECT items | 500 | 0.25 |
| SELECT equipped_items | 500 | 0.25 |
| CREATE schema | 21 | 0.01 |
| ALTER schema | 12 | 0.01 |
| INSERT queue_waits | 4 | 0.00 |
| PRAGMA schema | 2 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 2530 | 215.3 |
| GET /api/me | 500 | 1413.6 |
| POST /api/play | 432 | 707.1 |
| GET /api/lobby/:code/ws | 432 | 554.9 |

Calls: mm.next 432 · mm.serialised 432 · lobby.persist 3377 · lobby.persistBytes 7957605807 · live.report 634
