# Squads: bot simulation

108 full lobbies of 32 (8 squads of 4), 12 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (Pick and Block), and an Armageddon board after a drawn final. Every board has a chess clock and is played
to the end (the silent safety cap at move 120 aside): each Clock option sets a quick clock for rounds 1 and 2 and a
roomier one for the final. Start votes rotate between the normal start, one opening and random openings.

**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at
10,000 nodes, its top 8 moves) then `botPick` at the person's skill, a temperature over each move's loss:
Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. Winning, a bot plays with purpose (the
engine's order breaks ties between moves that all win, and it plays a mate it sees). The rules never ask the engine;
the engine also judges which of two picks was better, for this report only.

**A person's clock use and misses are assumptions** (there's no real Squads data yet): a person thinks for their
bank / 25 + 0.8 × the increment, times a random factor of 0.5–1.5, at least 2 s; past the per-move ceiling
(20 s) that's a miss, past their bank a flag fall. They also miss outright (a distraction) 2.0% of the time. Blockers think the
same way, on nobody's clock.
A half lasts as long as its slowest player, plus the show: 1 s for a Relay half's moves, 3 s for the pair's reveal,
4.5 s for the final's reveal. A match starts as soon as its two feeder matches are done, after 20 s of bracket; 22.4 s of votes come first.

## How long a lobby takes

Minutes from the votes to the final's last move (Armageddon included).

| Clock | Median | 90th percentile | Longest | Shortest | Median if rounds ran in lockstep |
| --- | --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | 32.6 | 35.3 | 36.9 | 25.6 | 32.8 |
| Normal 1+2, final 4+4 | 33.8 | 36.8 | 38.7 | 26.4 | 34.0 |
| Long 1+2, final 4:30+4 | 36.0 | 39.2 | 43.5 | 25.2 | 36.0 |

By skill mix (median minutes):

| Mix | Fast 1+2, final 4+3 | Normal 1+2, final 4+4 | Long 1+2, final 4:30+4 |
| --- | --- | --- | --- |
| Strong | 33.2 | 34.4 | 35.4 |
| Mixed | 32.4 | 33.6 | 36.3 |
| Casual | 32.5 | 33.6 | 37.9 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | 6.4 | 6.9 | 16.6 | 33.8 | 27.5 | 35.0 |
| Normal 1+2, final 4+4 | 6.4 | 6.9 | 17.7 | 33.8 | 27.5 | 35.0 |
| Long 1+2, final 4:30+4 | 6.4 | 6.9 | 19.5 | 33.8 | 27.5 | 37.5 |

## How boards end

All mixes. A flag is a win on time; a flag against bare material is a draw.

| Clock | Round | Mate | Draw by the rules | Flag (win) | Flag (draw) | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | Round 1 (Relay) | 73.6% | 0.0% | 20.1% | 0.0% | 0.0% | 6.3% |
| Fast 1+2, final 4+3 | Round 2 (Pairs) | 39.6% | 0.0% | 60.4% | 0.0% | 0.0% | 0.0% |
| Fast 1+2, final 4+3 | Final | 94.4% | 0.0% | 5.6% | 0.0% | 0.0% | 0.0% |
| Normal 1+2, final 4+4 | Round 1 (Relay) | 73.6% | 0.0% | 20.1% | 0.0% | 0.0% | 6.3% |
| Normal 1+2, final 4+4 | Round 2 (Pairs) | 39.6% | 0.0% | 60.4% | 0.0% | 0.0% | 0.0% |
| Normal 1+2, final 4+4 | Final | 97.2% | 0.0% | 2.8% | 0.0% | 0.0% | 0.0% |
| Long 1+2, final 4:30+4 | Round 1 (Relay) | 73.6% | 0.0% | 20.1% | 0.0% | 0.0% | 6.3% |
| Long 1+2, final 4:30+4 | Round 2 (Pairs) | 39.6% | 0.0% | 60.4% | 0.0% | 0.0% | 0.0% |
| Long 1+2, final 4:30+4 | Final | 94.4% | 0.0% | 5.6% | 0.0% | 0.0% | 0.0% |

Games decided on time (a flag fall, a win or a draw), by round:

| Clock | Round 1 boards | Round 2 boards | Finals | Armageddons |
| --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | 20.1% | 60.4% | 5.6% | – |
| Normal 1+2, final 4+4 | 20.1% | 60.4% | 2.8% | – |
| Long 1+2, final 4:30+4 | 20.1% | 60.4% | 5.6% | – |

## Ties

Rounds 1 and 2: a level match goes to the squad with more clock time left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → time | R2 level → time | Level → coin | Median time gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black | Minutes per Armageddon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | 25.0% | 41.7% | 36.1% | 0 of 86 | 18.6 | 0.0% | – | – |
| Normal 1+2, final 4+4 | 25.0% | 41.7% | 36.1% | 0 of 86 | 18.6 | 0.0% | – | – |
| Long 1+2, final 4:30+4 | 25.0% | 41.7% | 36.1% | 0 of 86 | 18.6 | 0.0% | – | – |

## Clock pressure and missed actions

| Clock | Actions per lobby | Missed | …the ceiling reached | Flag falls per lobby | Seats handed to a bot, per lobby |
| --- | --- | --- | --- | --- | --- |
| Fast 1+2, final 4+3 | 1478.4 | 2.3% | 0.0% | 5.7 | 0.0 |
| Normal 1+2, final 4+4 | 1478.5 | 2.3% | 0.0% | 5.7 | 0.0 |
| Long 1+2, final 4:30+4 | 1498.2 | 2.3% | 0.1% | 5.7 | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 6579 | 37.4% | 18.3% | 8.7% | 4.2% | 2.9% |
| Mixed | 6975 | 35.0% | 18.7% | 10.3% | 4.5% | 3.1% |
| Casual | 6306 | 31.6% | 15.6% | 8.2% | 3.1% | 3.3% |

## The final: picks, blocks and the mercy rules

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | No blocks (3 or fewer legal moves) | A block hits a pick | Blocks that hit a pick | Active block hits a pick | …the better pick | …the worse pick | …picks level | Block cancelled (mate in one) | Forfeited blocks | The worse pick played (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 2433 | 3.7% | 69.1% | 50.5% | 48.0% | 9.3% | 3.8% | 35.0% | 14 (0.6%) | 2.5% | 13.0% |
| Mixed | 2599 | 3.8% | 64.2% | 43.6% | 41.0% | 5.7% | 1.0% | 34.4% | 10 (0.4%) | 1.7% | 10.7% |
| Casual | 2537 | 3.8% | 60.9% | 40.0% | 38.0% | 7.6% | 1.4% | 29.0% | 15 (0.6%) | 2.2% | 15.7% |

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## What this means for fun

**Caveats first.** Bots aren't people. These bots play with purpose when winning (otherwise every game "to the end"
runs to the safety cap). The minutes come from a model of how people use a clock, not from playtests:
- bank / 25 + 0.8 × increment a move, never under 2 s;
- a 2% chance of drifting off and missing an action.

The first playtests should check that model: real think times, real misses.

**Eric's option B: quick early rounds, a roomier final.** Each Clock option sets a quick clock for rounds 1 and 2
and the final's own, longer one.

- **Every option fits 20-40 minutes:**
  - Fast (1+2, final 4+3): median 32.6, 90th percentile 35.3.
  - Normal (1+2, final 4+4): median 33.8, 90th percentile 36.8.
  - Long (1+2, final 4:30+4): median 36.0, 90th percentile 39.2. One Long lobby of 36 ran 43.5 minutes.
- **The final is the showdown and rarely ends on time:** 2.8-5.6% of finals (36 each), against 37-75% with one clock
  for every round. A final takes 17-20 minutes and about 35 moves a side. Earlier tuning runs found the final needs
  about 4 minutes of bank, so a miss (the whole 20 s ceiling) is absorbed, and at least 3 s of increment (4+2: 17% on
  time). With 3:30 the share hovered around the
  15% line (8-22% across runs), and with 3 minutes it was 17-23%. An increment of 3-4 s lets two pickers keep pace, and more didn't clearly help.
- **The early rounds are a scramble, by design.** On time: 20% of Relay boards and 60% of Pairs boards. Pairs runs
  on the slower picker's time at 1+2, so most Pairs boards end on a flag. Relay matches take about 6.5 minutes, Pairs
  about 7.
- **The options can't spread far.** A 4-minute final costs 17-20 minutes and the early rounds about 16, so every
  option lands at 32-36 minutes. The options differ in the final's room (4+3, 4+4, 4:30+4), not much in length.
- **Ties stay clean.** About 40% of Relay matches and a third of Pairs matches end level on points and go to the squad
  with more time left (a median gap of 19 s); none of 86 needed the coin. No final was drawn, so Armageddon stays a
  safety net.
- **The coin, the blocks and the mercy rules** behave as before:
  - the coin plays a clearly weaker pair pick (5+ points) on 8-10% of moves;
  - the final's active block forces a clearly worse pick on 6-9%;
  - blocks are off (few legal moves) on 4% of moves, and cancelled before a mate on 0.5%.

### Tuning I recommend
1. **Ship these clocks** for the first playtests and measure real think times, misses and lobby length. Then retune
   with `npm run sim:squads -- 12 10000 "<early>/<final>,..."`, or tune finals alone with `SQUADS_SIM_FINALS_ONLY=1`.
2. **If Pairs feels decided by the clock** (60% of its boards end on time), give the early rounds 3 s of increment
   (1+3). That's about 2 minutes longer and 53% on time.
3. **If Fast should feel clearly faster,** something has to give:
   - a smaller final bank (3:30+3 saves about a minute, but 17-22% of finals end on time); or
   - shorter reveals in Pairs (3 s now).
