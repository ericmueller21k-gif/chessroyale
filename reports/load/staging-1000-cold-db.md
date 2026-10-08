# Load test: staging-1000

2026-10-08T06:29:21.540Z · https://chessroyale-staging.eric-mueller21k.workers.dev · 1000 players over 60 s · crowd · session 300 s · 6.3 min
Generator: 1 Node process, CPU peak 67% of a core (each)

## Players

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| chatRtt | 271 | 54 ms | 118 ms | 241 ms | 399 ms |
| http heartbeat | 3642 | 30 ms | 89 ms | 243 ms | 547 ms |
| http live | 644 | 2331 ms | 6440 ms | 8743 ms | 11.2 s |
| http me | 707 | 19.6 s | 24.7 s | 25.7 s | 29.4 s |
| http play | 404 | 58 ms | 311 ms | 592 ms | 672 ms |
| pickRtt | 2679 | 72 ms | 149 ms | 302 ms | 1348 ms |
| playToCode | 404 | 58 ms | 311 ms | 592 ms | 672 ms |
| playToLobby | 404 | 8147 ms | 21.1 s | 23.4 s | 23.4 s |
| queueWait | 404 | 2426 ms | 6091 ms | 8991 ms | 59.0 s |
| server heartbeat | 3642 | 8 ms | 49 ms | 123 ms | 511 ms |
| server live | 554 | 2437 ms | 6420 ms | 8709 ms | 11.2 s |
| server me | 404 | 23.1 s | 25.0 s | 25.8 s | 29.2 s |
| server play | 404 | 30 ms | 258 ms | 532 ms | 647 ms |
| wsOpen | 404 | 4654 ms | 8508 ms | 8937 ms | 8975 ms |

Counts: playersFailed 596 · msgsOut 4393 · msgsIn 627689 · hostScores 82 · end timeUp 404

Errors: me TimeoutError: The operation was aborted due to timeout (293) · live 500  (90) · me 500  (303)

## Server counters

D1 statements: 755 reads, 845 writes (0.14 writes per player per minute; 2.3 writes/s)

| D1 statement | count | per player per min |
| --- | ---: | ---: |
| CREATE schema | 644 | 0.10 |
| INSERT users | 90 | 0.01 |
| INSERT sessions | 90 | 0.01 |
| SELECT users | 90 | 0.01 |
| SELECT results | 89 | 0.01 |
| SELECT inventory | 86 | 0.01 |
| SELECT equipped | 83 | 0.01 |
| SELECT wallets | 80 | 0.01 |
| SELECT sessions | 79 | 0.01 |
| SELECT chat_picks | 72 | 0.01 |
| SELECT items | 65 | 0.01 |
| SELECT equipped_items | 56 | 0.01 |
| SELECT meta | 31 | 0.00 |
| PRAGMA schema | 24 | 0.00 |
| ALTER schema | 16 | 0.00 |
| INSERT meta | 5 | 0.00 |

| Route | requests | mean ms |
| --- | ---: | ---: |
| GET /api/live | 85 | 2006.7 |
| GET /api/me | 53 | 21081.2 |
| POST /api/play | 28 | 61.6 |

Calls: 
