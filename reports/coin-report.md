# Play coins: a day's coins by player and hours

Written by `packages/sim/scripts/coin-report.ts` from the settings (`PLAY_COINS`), through core's `gameCoins`, game by game.
Run it again after changing the settings to see their effect. The design: `docs/decisions/2026-11-17-payments-design.md`, section 6.

## The settings

- Play coins: 1.8 of a game's XP minutes (at most 30 a game: 54 coins), at least 1 online, 300 a day.
- Bonus: a win 15, a ranked draw 5, a 50 v 50 team's top 3 10, Squads 1st 40, 2nd 25, 3rd-4th 15, 5th-8th 5. Solo: none.
- Steps of the day's earned bonus: to 150 at 1, to 350 at 0.5, to 550 at 0.25, then none: 300 bonus at most.
- The most a day: **600 coins** (6.0 keys at 100 coins a key). Solo alone: 216 (XP's 120 solo minutes).
- A win's bonus through a day, step by step: 15, then 8, then 4, then 0.

## A day

Games of 15 minutes, 4 an hour. Coins (keys at 100).

| Player | Bonus a game | 1 h a day | 3 h a day | 6 h a day |
| --- | --- | --- | --- | --- |
| Weak | 4 | 124 (1.2) | 348 (3.5) | 396 (4.0) |
| Average | 8 | 140 (1.4) | 396 (4.0) | 472 (4.7) |
| Strong | 13 | 160 (1.6) | 452 (4.5) | 535 (5.3) |

Each player's games cycle through five results (each day averaged over the five places the cycle could start):

- Weak: a win, a ranked draw, three losses.
- Average: a 50 v 50 win in its team's top 3, a win, three losses.
- Strong: a 50 v 50 win in the top 3, two wins, a top 3 in a loss, a loss.

Play coins and bonus, the same days:

| Player | 1 h: play + bonus | 3 h: play + bonus | 6 h: play + bonus |
| --- | --- | --- | --- |
| Weak | 108 + 16 | 300 + 48 | 300 + 96 |
| Average | 108 + 32 | 300 + 96 | 300 + 172 |
| Strong | 108 + 52 | 300 + 152 | 300 + 235 |

## The design's examples

- A 15-minute ranked win: 42; a loss: 27; a draw: 32.
- A 30-minute Squads lobby: 1st 94, 2nd 79, 3rd-4th 69, last 59.
- A 20-minute 50 v 50 win in the team's top 3: 61.
