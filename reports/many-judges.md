# Many judges: the harness

`packages/sim/scripts/many-judges.ts` plays whole online Crowd matches (50 v 50, 100 players) through the real lobby
logic (`LobbyCore`), with simulated devices scored by real Stockfish (the Node transport, the browsers' lite build) and
the engine server stood in for by the full-network build. Time is simulated: a device answers after its searches
would take at its speed (computer 1.1M nodes/s, phone 350k, old phone 90k), the engine server after 3 s a search.
Cheaters claim 3M nodes/s, so they're drawn as judges as often as the lobby allows. Each scenario also runs the old
way (one host scores every round, the engine server re-checking its close calls) with the same devices.

Scenarios: **inflate**: 1 cheater (a computer) scores its own pick as the best; 5 honest.

## Do the scores match the truth?

Per job (a round's board). *Honest*: every person's pick scored exactly as honest devices score it. *Server*: the
engine server's verdict used. *Cheater's*: a job a cheater judged whose numbers were used (alone, or as the fallback
with no server). *Worst shift*: the most any pick's loss moved from the honest devices' (points), over the matches.

| Scenario | Way | Jobs | Agreed | Server verdict | One judge | Fallback | Honest numbers | Cheater's numbers used | Worst shift |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| inflate | judges | 200 | 7 | 2 | 191 | 0 | 198 | 0 | 0.0 |
| inflate | old (host) | 47 | 0 | 0 | 0 | 0 | 32 | 15 | 47.8 |

(A job settled by the server's verdict differs from the honest devices' by the server's deeper view, not by any
cheater: its numbers are the server's own, for every pick.)

## What cheating gained

The cheaters' own picks: their true loss (honest devices' numbers) against the loss applied, summed over every round
they picked in. A positive gain is points the cheat was worth.

| Scenario | Way | Rounds | True loss | Applied loss | Gain |
|---|---|---:|---:|---:|---:|
| inflate | judges | 198 (+2 verdicts) | 123.6 | 123.6 | 0.0 |
| inflate | old (host) | 47 | 235.9 | 0.3 | 235.7 |

(Rounds settled by a verdict are left out of the sums: there the applied numbers are the server's, which differ
from the lite engine's for everyone alike.)

## Are cheaters caught?

Strikes per match (two strikes: no more jobs that match), and the round the cheater was benched.

| Scenario | Matches | Cheater's strikes (each match) | Benched at round | Honest devices struck |
|---|---:|---|---|---:|
| inflate | 1 | 3 | p1@6 | 1 |

## Timing: never slower

Lock to reveal (ms, simulated), per round.

| Scenario | Way | Rounds | Median | 95th | Max |
|---|---|---:|---:|---:|---:|
| inflate | judges | 200 | 587 | 3647 | 3834 |
| inflate | old (host) | 47 | 287 | 3347 | 3347 |

## Engine server calls per match

| Scenario | Way | Matches | Rounds/match | Verdicts | Spot checks | Close-call re-checks | All calls/match |
|---|---|---:|---:|---:|---:|---:|---:|
| inflate | judges | 1 | 200.0 | 2.0 | 51.0 | 17.0 | 70.0 |
| inflate | old (host) | 1 | 47.0 | – | – | 22.0 | 22.0 |
