# Matchmaker burst: burst-after-2500

2026-10-07T23:22:01.549Z · http://localhost:8787 · 2500 PLAY presses at once

All answered in 9.8 s: 255 PLAY presses a second. Seated 2461 in 25 lobbies (largest 100); told busy 39.

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| play | 2500 | 4653 ms | 7765 ms | 9201 ms | 9283 ms |

Errors: none

Server calls: mm.next 2500 · mm.batch 51 · mm.create 25 · lobby.persist 28 · live.report 32 · hub.report 32 · mm.reserve 50 · lobby.persistWithLast 7 · mm.busy 39
