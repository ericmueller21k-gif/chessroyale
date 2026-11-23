# Many judges: the harness

`packages/sim/scripts/many-judges.ts` plays whole online Crowd matches (50 v 50, 100 players) through the real lobby
logic (`LobbyCore`), with simulated devices scored by real Stockfish (the Node transport, the browsers' lite build) and
the engine server stood in for by the full-network build. Time is simulated: a device answers after its searches
would take at its speed (computer 1.1M nodes/s, phone 350k, old phone 90k), the engine server after 3 s a search.
Cheaters claim 3M nodes/s, so they're drawn as judges as often as the lobby allows. Each scenario also runs the old
way (one host scores every round, the engine server re-checking its close calls) with the same devices.

Scenarios: **honest**: 6 honest devices (2 computers, 4 phones); **inflate**: 1 cheater (a computer) scores its own pick as the best; 5 honest; **noise**: 1 cheater adds random noise (about 3 points) to every score; 5 honest; **rubber**: 1 cheater answers without looking: every move as good as the best; 5 honest; **lazy**: 1 cheater (a phone) answers from a 5k-node search; 5 honest; **flaky**: 1 inflating cheater, 2 phones that drop out (30% of jobs), 1 old phone (90k nodes/s), 2 honest; **pair**: 2 devices only: an inflating cheater and an honest phone (no third device for a second opinion); **no-server**: as inflate, with the engine server down.

## Do the scores match the truth?

Per job (a round's board). *Honest*: every person's pick scored exactly as honest devices score it. *Server*: the
engine server's verdict used. *Two of three*: no server, a third device settled it. *Host*: one device scored it, the
old way (always, the old way; with judges, once only one device that can judge is left, e.g. after the other was
benched). *Cheater's*: a job a cheater judged whose numbers were used (alone, or as the fallback with no server).
*Worst shift*: the most any pick's loss moved from the honest devices' (points), over the matches.

| Scenario | Way | Jobs | Agreed | Server verdict | Two of three | One judge | Fallback | Host | Honest numbers | Cheater's numbers used | Worst shift |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| honest | judges | 254 | 209 | 0 | 0 | 45 | 0 | 0 | 254 | 0 | 0.0 |
| honest | old (host) | 220 | 0 | 0 | 0 | 0 | 0 | 220 | 220 | 0 | 0.0 |
| inflate | judges | 218 | 6 | 4 | 0 | 208 | 0 | 0 | 214 | 0 | 0.0 |
| inflate | old (host) | 124 | 0 | 0 | 0 | 0 | 0 | 124 | 98 | 26 | 57.0 |
| noise | judges | 400 | 6 | 4 | 0 | 390 | 0 | 0 | 397 | 0 | 0.0 |
| noise | old (host) | 267 | 0 | 0 | 0 | 0 | 0 | 267 | 227 | 40 | 9.0 |
| rubber | judges | 254 | 3 | 4 | 0 | 247 | 0 | 0 | 251 | 0 | 0.0 |
| rubber | old (host) | 224 | 0 | 0 | 0 | 0 | 0 | 224 | 204 | 20 | 100.0 |
| lazy | judges | 254 | 3 | 0 | 0 | 251 | 0 | 0 | 254 | 0 | 0.0 |
| lazy | old (host) | 289 | 0 | 0 | 0 | 0 | 0 | 289 | 260 | 29 | 9.7 |
| flaky | judges | 296 | 5 | 4 | 0 | 287 | 0 | 0 | 292 | 0 | 0.0 |
| flaky | old (host) | 124 | 0 | 0 | 0 | 0 | 0 | 124 | 98 | 26 | 57.0 |
| pair | judges | 170 | 6 | 2 | 0 | 13 | 0 | 149 | 162 | 7 | 12.5 |
| pair | old (host) | 345 | 0 | 0 | 0 | 0 | 0 | 345 | 329 | 16 | 50.6 |
| no-server | judges | 254 | 6 | 0 | 4 | 244 | 0 | 0 | 254 | 0 | 0.0 |
| no-server | old (host) | 279 | 0 | 0 | 0 | 0 | 0 | 279 | 244 | 35 | 50.1 |

(A job settled by the server's verdict differs from the honest devices' by the server's deeper view, not by any
cheater: its numbers are the server's own, for every pick.)

## What cheating gained

The cheaters' own picks: their true loss (honest devices' numbers) against the loss applied, summed over every round
they picked in. A positive gain is points the cheat was worth.

| Scenario | Way | Rounds | True loss | Applied loss | Gain |
|---|---|---:|---:|---:|---:|
| inflate | judges | 214 (+4 verdicts) | 311.9 | 311.9 | 0.0 |
| inflate | old (host) | 124 | 369.3 | 5.4 | 363.8 |
| noise | judges | 396 (+4 verdicts) | 231.3 | 231.3 | 0.0 |
| noise | old (host) | 267 | 94.9 | 136.4 | -41.5 |
| rubber | judges | 250 (+4 verdicts) | 353.8 | 353.8 | 0.0 |
| rubber | old (host) | 224 | 87.5 | 0.0 | 87.5 |
| lazy | judges | 254 | 355.7 | 355.7 | 0.0 |
| lazy | old (host) | 289 | 345.5 | 330.7 | 14.8 |
| flaky | judges | 292 (+4 verdicts) | 177.8 | 177.8 | 0.0 |
| flaky | old (host) | 124 | 369.3 | 5.4 | 363.8 |
| pair | judges | 168 (+2 verdicts) | 177.3 | 154.3 | 23.0 |
| pair | old (host) | 345 | 249.3 | 36.7 | 212.6 |
| no-server | judges | 254 | 326.9 | 326.9 | 0.0 |
| no-server | old (host) | 279 | 587.5 | 6.9 | 580.6 |

(Rounds settled by a verdict are left out of the sums: there the applied numbers are the server's, which differ
from the lite engine's for everyone alike.)

## Are cheaters caught?

Strikes per match (two strikes: no more jobs that match), and the round the cheater was benched.

| Scenario | Matches | Cheater's strikes (each match) | Benched at round | Honest devices struck |
|---|---:|---|---|---:|
| honest | 2 | –, – | –, – | 0 |
| inflate | 2 | 2, 2 | p1@4, p1@3 | 0 |
| noise | 2 | 2, 2 | p1@2, p1@2 | 0 |
| rubber | 2 | 2, 2 | p1@2, p1@2 | 0 |
| lazy | 2 | 2, 2 | p1@2, p1@3 | 0 |
| flaky | 2 | 2, 2 | p1@6, p1@3 | 0 |
| pair | 2 | 2, 2 | p1@10, p1@11 | 0 |
| no-server | 2 | 2, 2 | p1@4, p1@3 | 0 |

## Timing: never slower

Lock to reveal (ms, simulated), per round.

| Scenario | Way | Rounds | Median | 95th | Max |
|---|---|---:|---:|---:|---:|
| honest | judges | 254 | 287 | 3347 | 3497 |
| honest | old (host) | 220 | 287 | 3347 | 3347 |
| inflate | judges | 218 | 437 | 3497 | 3497 |
| inflate | old (host) | 124 | 287 | 3347 | 3347 |
| noise | judges | 400 | 437 | 3497 | 3497 |
| noise | old (host) | 267 | 287 | 3347 | 3347 |
| rubber | judges | 254 | 437 | 3497 | 3497 |
| rubber | old (host) | 224 | 287 | 287 | 287 |
| lazy | judges | 254 | 437 | 3497 | 3497 |
| lazy | old (host) | 289 | 774 | 3834 | 3834 |
| flaky | judges | 296 | 437 | 3497 | 3497 |
| flaky | old (host) | 124 | 287 | 3347 | 3347 |
| pair | judges | 170 | 774 | 3834 | 4549 |
| pair | old (host) | 345 | 287 | 3347 | 3347 |
| no-server | judges | 254 | 437 | 1170 | 4472 |
| no-server | old (host) | 279 | 287 | 924 | 924 |

## Engine server calls per match

| Scenario | Way | Matches | Rounds/match | Verdicts | Spot checks | Close-call re-checks | All calls/match |
|---|---|---:|---:|---:|---:|---:|---:|
| honest | judges | 2 | 127.0 | 0.0 | 0.0 | 15.5 | 15.5 |
| honest | old (host) | 2 | 110.0 | – | – | 15.0 | 15.0 |
| inflate | judges | 2 | 109.0 | 2.0 | 0.0 | 13.5 | 15.5 |
| inflate | old (host) | 2 | 62.0 | – | – | 18.5 | 18.5 |
| noise | judges | 2 | 200.0 | 2.0 | 0.0 | 14.0 | 16.0 |
| noise | old (host) | 2 | 133.5 | – | – | 20.0 | 20.0 |
| rubber | judges | 2 | 127.0 | 2.0 | 0.0 | 14.0 | 16.0 |
| rubber | old (host) | 2 | 112.0 | – | – | 0.0 | 0.0 |
| lazy | judges | 2 | 127.0 | 0.0 | 2.0 | 15.5 | 17.5 |
| lazy | old (host) | 2 | 144.5 | – | – | 13.0 | 13.0 |
| flaky | judges | 2 | 148.0 | 2.0 | 0.0 | 14.0 | 16.0 |
| flaky | old (host) | 2 | 62.0 | – | – | 18.5 | 18.5 |
| pair | judges | 2 | 85.0 | 1.0 | 3.5 | 7.0 | 18.5 |
| pair | old (host) | 2 | 172.5 | – | – | 18.5 | 18.5 |
| no-server | judges | 2 | 127.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| no-server | old (host) | 2 | 139.5 | – | – | 0.0 | 0.0 |
