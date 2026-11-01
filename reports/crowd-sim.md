# Crowd mode: bot simulation (Oct 3, 2026)

(A snapshot from Oct 3. Everyone moves was removed on Oct 15, 2026, so the script now runs 50 v 50 only.)

`npx tsx packages/sim/scripts/crowd-sim.ts 10`: 10 matches of 100 bots per turn mode, real engine at 100k nodes,
default Crowd settings (no cuts for 20 plies, then a cut every 2 plies down to 4, 2v2 final of 5 moves each).

| | 50 v 50 | Everyone moves |
|---|---|---|
| Rank correlation, skill vs placement (Classic: 0.63) | 0.73 | 0.81 |
| Strongest bot reaches the final | 30% | 20% |
| Top-5 bots in the final (of 4 seats, average) | 2.1 | 1.3 |
| Game ended and restarted before the final | 0 per match | 0.1 per match |
| Plies per match (of which the final) | 64 (20) | 64 (20) |
| Final cut short by the game ending | 0% | 0% |
| Game decided at the end (mate, or 60%+ for one side) | 90% | 50% |

Reading:

- **The game lasts.** A crowd voting for the most popular move almost never blunders into an early mate: in 20 matches
  the game restarted once before the final and never ended during it. Every match ran the full 64 plies.
- **Placement tracks skill better than Classic** (one shared position each turn, scores carried over all game).
- **Length:** 64 plies at up to 20 s plus a ~5 s reveal, and 12 cut screens of ~7 s: roughly 25 minutes at most, less
  when players move quickly (the round locks once everyone has picked).
- In 50 v 50 the result is usually clear by the end (one team's crowd outplays the other's), which makes the team win
  on your record meaningful.

## The new cut schedule, before → after (Nov 1, 2026)

`npx tsx packages/sim/scripts/crowd-sim.ts 10` (the team final, the usual start): 10 matches of 100 bots, 100k nodes,
seeds 900 to 909, on today's code. "Before" is the same script with the old schedule put back (a cut after every move
from move 10: 16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4; the cap's old stages, `capFrom` [0, 1, 5, 9]); "after" is the new one
(cuts after moves 10, 15, 19, 23, 26 and 29: 30, 22, 16, 12, 8, 4). docs/decisions/2026-11-01-crowd-cuts.md.

| | before | after |
|---|---|---|
| The team final starts at move | 21 | 30 |
| Game ended (and restarted) before the final | 0 of 10 matches | 1 of 10 (once) |
| Final cut short by the game ending | 0% | 0% |
| Rank correlation, skill vs placement | 0.75 | 0.73 |
| Strongest bot reaches the final | 20% | 40% |
| Top-5 bots in the final (of 8 seats, average) | 1.4 | 1.9 |
| Plies per match (of which the final) | 126 (86) | 158 (100) |
| Game decided at the end (mate, or 60%+) | 80% | 90% |
| Mean pick loss before the final, raw (counted) | 1.93 (1.00) | 1.80 (1.05) |

Reading: the final starts 9 moves later (move 30, was 21), and a game now and then ends before it (one restart in 10
matches; none before), which `replaceBoard` handles as before: a new board of the same kind, and the cuts carry on. The
strongest bots reach the final a little more often (fewer cuts, so fewer chances for one bad move to cost them); 10
matches is a small sample, so read the strength numbers as "no worse". All bots: the sim has no people.
