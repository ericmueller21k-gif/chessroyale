# Matchmaker burst: burst-before-1000

2026-10-07T23:08:38.185Z · http://localhost:8787 · 1000 PLAY presses at once

All answered in 3.5 s: 282 PLAY presses a second. Seated 1000 in 1 lobbies (largest 1000, MORE THAN ITS 100 SEATS); told busy 0.

| Measure | n | p50 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| play | 1000 | 2087 ms | 2756 ms | 3403 ms | 3419 ms |

Errors: none

Server calls: mm.next 1000 · mm.serialised 1000 · lobby.persist 1 · lobby.persistBytes 780 · live.report 1
