# Load test: before-1000

2026-10-07T23:13:28.966Z · http://localhost:8787 · 1000 players over 30 s · crowd · session 180 s · 3.9 min
Generator: 2 Node processes, CPU peak 18% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 159 | 46 ms | 1856 ms | 5251 ms | 6452 ms |
| http heartbeat | 2035 | 177 ms | 6008 ms | 15.6 s | 16.2 s |
| http live | 1331 | 2002 ms | 8844 ms | 13.4 s | 14.1 s |
| http me | 1000 | 5492 ms | 13.3 s | 14.3 s | 14.6 s |
| http play | 1000 | 2328 ms | 9201 ms | 11.8 s | 12.7 s |
| pickRtt | 1559 | 83 ms | 2166 ms | 4938 ms | 8060 ms |
| playToCode | 771 | 4193 ms | 9236 ms | 11.9 s | 12.7 s |
| playToLobby | 406 | 6673 ms | 22.1 s | 24.8 s | 25.2 s |
| queueWait | 406 | 5307 ms | 10.1 s | 57.9 s | 57.9 s |
| server heartbeat | 2035 | 14 ms | 767 ms | 3514 ms | 3516 ms |
| server live | 1331 | 661 ms | 2927 ms | 3501 ms | 3502 ms |
| server me | 1000 | 1404 ms | 2103 ms | 3542 ms | 3543 ms |
| server play | 771 | 1072 ms | 3752 ms | 3857 ms | 3866 ms |
| wsOpen | 771 | 3718 ms | 6809 ms | 9655 ms | 14.9 s |

Counts: msgsOut 3446 · msgsIn 390153 · end error 365 · playersFailed 229 · hostScores 58 · chatNo repeat 2 · end timeUp 406

Errors: lobby error: This match has already started. (365) · play 500  (229)

## Server counters

D1 statements: 22048 reads, 7030 writes (1.79 writes per player per minute; 29.8 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| SELECT sessions | 4137 | 1.05 |
| UPDATE users | 4137 | 1.05 |
| SELECT users | 3599 | 0.92 |
| SELECT live_lobbies | 2114 | 0.54 |
| SELECT queue_waits | 2114 | 0.54 |
| SELECT inventory | 1771 | 0.45 |
| SELECT equipped | 1771 | 0.45 |
| SELECT wallets | 1771 | 0.45 |
| SELECT chat_picks | 1771 | 0.45 |
| INSERT users | 1000 | 0.25 |
| INSERT sessions | 1000 | 0.25 |
| SELECT results | 1000 | 0.25 |
| SELECT items | 1000 | 0.25 |
| SELECT equipped_items | 1000 | 0.25 |
| INSERT live_lobbies | 886 | 0.23 |
| INSERT queue_waits | 5 | 0.00 |
| DELETE live_lobbies | 1 | 0.00 |
| DELETE queue_waits | 1 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 3366 | 649.2 |
| GET /api/me | 1000 | 1302.6 |
| POST /api/play | 771 | 1456.9 |
| GET /api/lobby/:code/ws | 771 | 671.5 |

Calls: mm.next 771 · mm.serialised 771 · lobby.persist 3677 · lobby.persistBytes 8549868192 · live.report 886
