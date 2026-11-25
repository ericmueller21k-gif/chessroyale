# Deep checks on players' computers: engine-server calls

`packages/sim/scripts/many-judges.ts` (JUDGE_OUT=deep-checks): whole online Crowd matches (50 v 50) through the real
lobby logic, devices scored by real Stockfish, simulated time; computers 1.1M nodes/s, phones 350k. Each scenario is
played twice per seed: as shipped (the engine server re-checks close calls) and with `JUDGES.deepOnDevices` on
(two capable computers re-check them). The switch ships off: the browsers' engine re-checks less accurately than the
server (`reports/deep-accuracy.md`), and Eric's rule puts fair scoring first.

## Engine-server calls per match, by capable devices in the lobby

6 people; "capable": a computer fast enough to re-check 1M+ nodes in 3 s.

| Capable devices | Way | Matches | Rounds | Close-call re-checks | Verdicts | Spot checks | All calls / match | Re-checks done on computers | Lock to reveal: median / 95th (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 0 | shipped: engine server re-checks | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 774 / 3834 |
| 0 | deep checks on computers (switch on) | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 774 / 3834 |
| 1 | shipped: engine server re-checks | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 437 / 3497 |
| 1 | deep checks on computers (switch on) | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 437 / 3497 |
| 2 | shipped: engine server re-checks | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 287 / 3347 |
| 2 | deep checks on computers (switch on) | 2 | 127 | 0.0 | 0.0 | 0.0 | 0.0 | 15.0 of 15.5 | 287 / 2165 |
| 5 | shipped: engine server re-checks | 2 | 127 | 15.5 | 0.0 | 0.0 | 15.5 | 0.0 of 0.0 | 287 / 3347 |
| 5 | deep checks on computers (switch on) | 2 | 127 | 0.0 | 0.0 | 0.0 | 0.0 | 15.0 of 15.5 | 287 / 2165 |

## A match's endgame: people leaving as they're knocked out

20 people (6 on computers, 14 on phones) in a 100-seat Crowd match; a share of those knocked out close the tab, the
rest keep watching (and their devices keep judging). Cost at about $0.0001 per engine-server search.

| Knocked out who leave | Way | Matches | All calls / match (worst) | Worst-case cost / match | Last 10 rounds: people connected | Last 10 rounds: calls (avg / worst) |
|---|---|---:|---:|---:|---|---:|
| 30% | shipped: engine server re-checks | 2 | 22.0 (22) | $0.0022 | 13–14 | 0.0 / 0 |
| 30% | deep checks on computers (switch on) | 2 | 0.0 (0) | $0.0000 | 13–14 | 0.0 / 0 |
| 60% | shipped: engine server re-checks | 2 | 22.0 (22) | $0.0022 | 9–12 | 0.0 / 0 |
| 60% | deep checks on computers (switch on) | 2 | 0.0 (0) | $0.0000 | 9–12 | 0.0 / 0 |
| 90% | shipped: engine server re-checks | 2 | 22.0 (22) | $0.0022 | 1–1 | 0.0 / 0 |
| 90% | deep checks on computers (switch on) | 2 | 0.0 (0) | $0.0000 | 1–1 | 0.0 / 0 |

### Engine-server calls per round, by people still connected (all endgame matches)

| People connected | Way | Rounds | Calls per round | Rounds with a call |
|---|---|---:|---:|---:|
| 1 | shipped: engine server re-checks | 356 | 0.00 | 0% |
| 1 | deep checks on computers (switch on) | 319 | 0.00 | 0% |
| 3–7 | shipped: engine server re-checks | 4 | 1.00 | 100% |
| 3–7 | deep checks on computers (switch on) | 4 | 0.00 | 0% |
| 8–20 | shipped: engine server re-checks | 576 | 0.22 | 22% |
| 8–20 | deep checks on computers (switch on) | 576 | 0.00 | 0% |

## How often a lobby has fewer than two capable devices

Assumed: a share of players on computers (all fast enough: this test machine's slow server core already does 490k
nodes/s in Chrome, above the 390k needed), the rest on phones. Chance a lobby of n people has fewer than two
computers, (1-q)^n + n·q·(1-q)^(n-1):

| People | 20% on computers | 30% on computers | 50% on computers |
|---:|---:|---:|---:|
| 2 | 96.0% | 91.0% | 75.0% |
| 3 | 89.6% | 78.4% | 50.0% |
| 5 | 73.7% | 52.8% | 18.8% |
| 10 | 37.6% | 14.9% | 1.1% |
| 20 | 6.9% | 0.8% | 0.0% |
| 30 | 1.1% | 0.0% | 0.0% |
| 50 | 0.0% | 0.0% | 0.0% |
