# Many judges: the harness

`packages/sim/scripts/many-judges.ts` plays whole online Crowd matches (50 v 50, 100 players) through the real lobby
logic (`LobbyCore`), with simulated devices scored by real Stockfish (the Node transport, the browsers' lite build) and
the engine server stood in for by the full-network build. Time is simulated: a device answers after its searches
would take at its speed (computer 1.1M nodes/s, phone 350k, old phone 90k), the engine server after 3 s a search.
Cheaters claim 3M nodes/s, so they're drawn as judges as often as the lobby allows. Each scenario also runs the old
way (one host scores every round, the engine server re-checking its close calls) with the same devices.

Scenarios: **honest**: 6 honest devices (2 computers, 4 phones); **pair**: 2 devices only: an inflating cheater and an honest phone (no third device for a second opinion); **rubber**: 1 cheater answers without looking: every move as good as the best; 5 honest; **inflate**: 1 cheater (a computer) scores its own pick as the best; 5 honest; **flaky**: 1 inflating cheater, 2 phones that drop out (30% of jobs), 1 old phone (90k nodes/s), 2 honest.

## Do the scores match the truth?

Per job (a round's board). *Honest*: every person's pick scored exactly as honest devices score it. *Server*: the
engine server's verdict used. *Cheater's*: a job a cheater judged whose numbers were used (alone, or as the fallback
with no server). *Worst shift*: the most any pick's loss moved from the honest devices' (points), over the matches.

| Scenario | Way | Jobs | Agreed | Server verdict | Two of three | One judge | Fallback | Honest numbers | Cheater's numbers used | Worst shift |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| honest | judges | 254 | 209 | 0 | 0 | 45 | 0 | 254 | 0 | 0.0 |
| honest | old (host) | 220 | 0 | 0 | 0 | 0 | 0 | 220 | 0 | 0.0 |
| pair | judges | 61 | 0 | 0 | 0 | 10 | 0 | 49 | 12 | 45.1 |
| pair | old (host) | 145 | 0 | 0 | 0 | 0 | 0 | 137 | 8 | 29.3 |
| rubber | judges | 127 | 2 | 2 | 0 | 123 | 0 | 125 | 0 | 0.0 |
| rubber | old (host) | 95 | 0 | 0 | 0 | 0 | 0 | 83 | 12 | 100.0 |
| inflate | judges | 127 | 4 | 2 | 0 | 121 | 0 | 125 | 0 | 0.0 |
| inflate | old (host) | 55 | 0 | 0 | 0 | 0 | 0 | 42 | 13 | 40.1 |
| flaky | judges | 200 | 4 | 2 | 0 | 194 | 0 | 198 | 0 | 0.0 |
| flaky | old (host) | 55 | 0 | 0 | 0 | 0 | 0 | 42 | 13 | 40.1 |

(A job settled by the server's verdict differs from the honest devices' by the server's deeper view, not by any
cheater: its numbers are the server's own, for every pick.)

## What cheating gained

The cheaters' own picks: their true loss (honest devices' numbers) against the loss applied, summed over every round
they picked in. A positive gain is points the cheat was worth.

| Scenario | Way | Rounds | True loss | Applied loss | Gain |
|---|---|---:|---:|---:|---:|
| pair | judges | 61 | 134.5 | 0.0 | 134.5 |
| pair | old (host) | 145 | 153.4 | 36.6 | 116.8 |
| rubber | judges | 125 (+2 verdicts) | 174.1 | 174.1 | 0.0 |
| rubber | old (host) | 95 | 83.3 | 0.0 | 83.3 |
| inflate | judges | 125 (+2 verdicts) | 132.8 | 132.8 | 0.0 |
| inflate | old (host) | 55 | 178.1 | 5.2 | 172.9 |
| flaky | judges | 198 (+2 verdicts) | 67.2 | 67.2 | 0.0 |
| flaky | old (host) | 55 | 178.1 | 5.2 | 172.9 |

(Rounds settled by a verdict are left out of the sums: there the applied numbers are the server's, which differ
from the lite engine's for everyone alike.)

## Are cheaters caught?

Strikes per match (two strikes: no more jobs that match), and the round the cheater was benched.

| Scenario | Matches | Cheater's strikes (each match) | Benched at round | Honest devices struck |
|---|---:|---|---|---:|
| honest | 2 | –, – | –, – | 0 |
| pair | 1 | 2 | p1@11 | 0 |
| rubber | 1 | 2 | p1@2 | 0 |
| inflate | 1 | 2 | p1@4 | 0 |
| flaky | 1 | 2 | p1@6 | 0 |

## Timing: never slower

Lock to reveal (ms, simulated), per round.

| Scenario | Way | Rounds | Median | 95th | Max |
|---|---|---:|---:|---:|---:|
| honest | judges | 254 | 287 | 3347 | 3497 |
| honest | old (host) | 220 | 287 | 3347 | 3347 |
| pair | judges | 61 | 287 | 3497 | 3497 |
| pair | old (host) | 145 | 287 | 3347 | 3347 |
| rubber | judges | 127 | 437 | 3497 | 3497 |
| rubber | old (host) | 95 | 287 | 287 | 287 |
| inflate | judges | 127 | 437 | 3497 | 3497 |
| inflate | old (host) | 55 | 287 | 3347 | 3347 |
| flaky | judges | 200 | 437 | 3497 | 3497 |
| flaky | old (host) | 55 | 287 | 3347 | 3347 |

## Engine server calls per match

| Scenario | Way | Matches | Rounds/match | Verdicts | Spot checks | Close-call re-checks | All calls/match |
|---|---|---:|---:|---:|---:|---:|---:|
| honest | judges | 2 | 127.0 | 0.0 | 0.0 | 15.5 | 15.5 |
| honest | old (host) | 2 | 110.0 | – | – | 15.0 | 15.0 |
| pair | judges | 1 | 61.0 | 0.0 | 3.0 | 7.0 | 23.0 |
| pair | old (host) | 1 | 145.0 | – | – | 20.0 | 20.0 |
| rubber | judges | 1 | 127.0 | 2.0 | 0.0 | 18.0 | 20.0 |
| rubber | old (host) | 1 | 95.0 | – | – | 0.0 | 0.0 |
| inflate | judges | 1 | 127.0 | 2.0 | 0.0 | 18.0 | 20.0 |
| inflate | old (host) | 1 | 55.0 | – | – | 22.0 | 22.0 |
| flaky | judges | 1 | 200.0 | 2.0 | 0.0 | 20.0 | 22.0 |
| flaky | old (host) | 1 | 55.0 | – | – | 22.0 | 22.0 |
