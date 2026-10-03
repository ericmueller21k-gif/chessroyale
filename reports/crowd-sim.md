# Crowd mode: bot simulation (Oct 3, 2026)

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
