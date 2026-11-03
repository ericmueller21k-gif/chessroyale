# Dash's calibration: Clock Slap, Time Scramble, the flag (Nov 3, 2026)

Dash (id `dash`; docs/decisions/2026-11-03-dash.md). From the game so far. **Clock Slap:** each capture of his steals time from your
clock (30 s off a 10 + 10 bank; a raid's next move 6 s shorter, never under 8). **Time Scramble** (the rage meter): after the
warning, your next 5 moves get 3 seconds each (Eric's numbers). **Out of time is never a loss:** a move is played for you at
random (the flag).

The aim (the brief): his win rate with the roster's. The pack in these sims at the usual −250: Babur 0.12, Puddles 0.17, Timber
0.18, Moo 0.21.

**Shipped (run dashD, 20 battles): offset −250, `rageSpeed` 1, `flagTop` 4 (a flag plays one of the judge's top 4 moves at
random), 30 s a slap off the bank: the crowd scores 0.15 (± 0.07) in 46 crowd moves**, in the pack. 1.9 Time Scrambles a battle
(8.4 scrambled moves), 1.2 of them run out (a move played for you), 10 slaps taking 5 minutes of the bank; no bank ran out.

## How: the raid sim, with the player's clock

`npx tsx packages/sim/scripts/boss-sim.ts raid dash <games> <seed> 0 <tag> [patch]`, two or three processes of 6 to 10 battles each
(`{"skip":N}`), the rows joined. The crowd is the raid's 50 bots (its move quality, as every boss's sim), the boss at tier
1600 − 250 = 1350, as the others.

His powers take **time**, which the bots don't run short of (their picks come within the clock by design), so the sim keeps a
**player's clock** (Boss alone's: Boss Battle's bank of 10 minutes + 10 a move, his slaps taking from it) and a time model:

- a move's thinking time is drawn from a log-normal, median 10 s (`pickSec`), spread 0.6;
- a scrambled move's from a log-normal, median 2.2 s (`rushSec`: a phone player taps a move in about two seconds when they must),
  spread 0.35, so about one scrambled move in five runs past its 3 seconds;
- a move whose drawn time is longer than the move's time (the bank and its increment, or the scramble's 3 s) is nobody's pick:
  his rules play the flag's move for the crowd (the runner's `resolveBoard` with every pick empty, as solo and the lobby do).

Each row logs his slaps and the time they took, the scrambles and scrambled moves, the moves run out (of them, scrambled) and the
player's lowest bank (`reports/boss-sim/raid-dash*.jsonl`). (Runs A to C and Z ran Time Scramble's turns as `powerTurn`, which the
shipped rules dropped: it only kept the God King's Last Stand out of those turns; D and E are the shipped rules.)

| Run | Seed | What changed | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves | Scrambles (moves) | Run out (all scrambled) | Slaps (time taken) | Lowest bank (mean) |
|---|---|---|---|---|---|---|---|---|---|---|
| dashZ | 2 | no Time Scramble (`rageSpeed` 0.0001): the slaps alone | 12 | 1 / 4 / 7 | 0.25 (± 0.10) | 46 | 0 | 0 | 10.8 (5:22) | 3:24 |
| dashA | 1 | `rageSpeed` 1, a flag any legal move at random | 24 | 1 / 0 / 23 | 0.04 (± 0.04) | 42 | 1.71 (8.3) | 1.75 | 10.0 (5:00) | 5:05 |
| dashB | 2 | `rageSpeed` 0.5, any legal move | 20 | 1 / 0 / 19 | 0.05 (± 0.05) | 48 | 1.05 (5.0) | 0.90 | 10.4 (5:14) | 4:08 |
| dashC | 2 | `rageSpeed` 0.35, any legal move | 20 | 0 / 1 / 19 | 0.03 (± 0.02) | 48 | 0.65 (3.0) | 0.65 | 11.1 (5:33) | 3:36 |
| dashD | 2 | **`rageSpeed` 1, `flagTop` 4 (one of the judge's top 4 moves at random): shipped** | 20 | 2 / 2 / 16 | 0.15 (± 0.07) | 46 | 1.90 (8.4) | 1.20 | 10.2 (5:06) | 4:45 |
| dashE | 2 | `rageSpeed` 0.7, `flagTop` 4 | 20 | 2 / 5 / 13 | 0.23 (± 0.08) | 46 | 1.45 (6.6) | 1.15 | 10.8 (5:22) | 4:17 |

## What it says

- **A random legal move decides the battle.** With any legal move at random, under one flag a battle (C: 0.65) took the crowd
  from 0.25 (no scramble, Z) to 0.03: a random move hangs a piece more often than not, and at this tier a piece is the game. Fewer
  scrambles (A to C) didn't help: the flag itself was too costly.
- **The flag from the judge's top 4** keeps it a real cost (a worse move than yours, and your pick's score is a miss) without
  handing him a piece: with Eric's 5 moves of 3 s and the usual meter (`rageSpeed` 1) the crowd scores 0.15 (D), in the pack; at
  0.7 (E) 0.23, a little easy.
- **The slap is pressure, not a decider:** about 10 slaps a battle take 5 minutes of the 10 + 10 bank (the increment gives most of
  it back over 46 moves); the player's lowest bank was 4:45 on average, 2:39 at its lowest, and no move ran out on the bank in any
  run. A slower player than the model's 10 s a move feels it more; nobody loses on it (never a loss on time).
- **His strength by level** is the usual −250: at the sims' tier every boss plays at Stockfish's floor with the most slips, so an
  offset further down changes nothing there; his powers carry the tuning, as Timber's did.
