# Matchmaker burst: burst-after-1000

2026-10-07T23:08:54.677Z · http://localhost:8787 · 1000 PLAY presses at once

All answered in 2.4 s: 415 PLAY presses a second. Seated 1000 in 10 lobbies (largest 100); told busy 0.

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| play | 1000 | 1700 ms | 2237 ms | 2246 ms | 2254 ms |

Errors: none

Server calls: mm.next 1000 · mm.batch 14 · mm.create 10 · lobby.persist 10 · live.report 10 · hub.report 10 · mm.reserve 13
