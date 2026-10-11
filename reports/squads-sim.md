# Squads: bot simulation

108 full lobbies of 32 (8 squads of 4), 12 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (Pick and Block), and an Armageddon board after a drawn final. Every game is played to the end (the silent
safety cap at move 120 aside). Start votes rotate between the normal start, one opening and random openings.

**The team clock.** Each squad has one bank for the whole tournament, carried from round to round and topped up
when it advances. Each of its moves being thought about drains it past the free seconds (a Relay mover, a pair, the
final's pickers; two at once drain it twice as fast). At zero it's sudden death: every move within the free seconds,
or it's a random move. No flag falls. The options:
- Fast: Team clock 3 min · +0:45 min a round · 3 s free a move.
- Normal: Team clock 4 min · +1 min a round · 3 s free a move.
- Long: Team clock 5 min · +1 min a round · 3 s free a move.

**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at
10,000 nodes, its top 8 moves) then `botPick` at the person's skill, a temperature over each move's loss:
Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. Winning, a bot plays with purpose (the
engine's order breaks ties between moves that all win, and it plays a mate it sees). The rules never ask the engine;
the engine also judges which of two picks was better, for this report only.

**A person's clock use and misses are assumptions** (there's no real Squads data yet):
- With bank left, a person thinks for their squad's bank / 40 + 0.8 × (the free seconds + any increment), times a
  random factor of 0.5–1.5, at least 2 s.
- In sudden death they try to beat the free seconds: 0.4–1.05 of them, at least 1 s; past them it's missed.
- Past the per-move ceiling (20 s) it's missed. They also miss outright (a distraction) 2.0% of the time.
- Blockers think the same way, on nobody's clock.

A half lasts as long as its slowest player, plus the show: 1 s for a Relay half's moves, 3 s for the pair's reveal,
4.5 s for the final's reveal. A match starts as soon as its two feeder matches are done, after 20 s of bracket; 22.4 s of votes come first.

## How long a lobby takes

Minutes from the votes to the final's last move (Armageddon included).

| Clock | Median | 90th percentile | Longest | Shortest | Median if rounds ran in lockstep |
| --- | --- | --- | --- | --- | --- |
| Fast (3, +0:45, 3 s free) | 30.6 | 37.1 | 78.4 | 22.9 | 31.3 |
| Normal (4, +1, 3 s free) | 33.1 | 39.7 | 42.7 | 22.8 | 33.7 |
| Long (5, +1, 3 s free) | 31.3 | 37.2 | 46.0 | 25.1 | 31.9 |

By skill mix (median minutes):

| Mix | Fast | Normal | Long |
| --- | --- | --- | --- |
| Strong | 32.5 | 35.9 | 31.2 |
| Mixed | 29.8 | 32.9 | 32.1 |
| Casual | 32.6 | 33.6 | 32.7 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| Fast | 8.0 | 9.3 | 11.9 | 37.4 | 39.3 | 37.4 |
| Normal | 8.7 | 9.2 | 11.8 | 37.7 | 36.6 | 35.9 |
| Long | 9.2 | 9.4 | 10.7 | 36.3 | 36.6 | 32.8 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fast | 64.6% | 35.1% | 54.2% | 9.7% | 12.2% | 7.2% | 29.2% | 14.8% | 1.7% |
| Normal | 47.9% | 19.8% | 50.0% | 12.5% | 6.4% | 3.2% | 18.4% | 7.0% | 1.0% |
| Long | 38.2% | 13.2% | 47.9% | 4.2% | 4.7% | 1.8% | 15.5% | 2.8% | 0.8% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| Fast | 19.0 s | 9.6 s | 6.9 | 9.1 | 51.5% of 68 | 41.7% of 24 |
| Normal | 28.3 s | 12.9 s | 7.5 | 10.0 | 39.1% of 69 | 62.1% of 29 |
| Long | 39.4 s | 16.2 s | 8.0 | 10.4 | 37.5% of 72 | 55.6% of 27 |

## How boards end

All mixes.

| Clock | Round | Mate | Draw by the rules | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- |
| Fast | Round 1 (Relay) | 92.2% | 0.0% | 0.0% | 7.8% |
| Fast | Round 2 (Pairs) | 98.6% | 0.7% | 0.7% | 0.0% |
| Fast | Final | 97.2% | 0.0% | 2.8% | 0.0% |
| Normal | Round 1 (Relay) | 92.7% | 0.3% | 0.2% | 6.8% |
| Normal | Round 2 (Pairs) | 100.0% | 0.0% | 0.0% | 0.0% |
| Normal | Final | 100.0% | 0.0% | 0.0% | 0.0% |
| Long | Round 1 (Relay) | 92.0% | 0.3% | 0.0% | 7.6% |
| Long | Round 2 (Pairs) | 100.0% | 0.0% | 0.0% | 0.0% |
| Long | Final | 100.0% | 0.0% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → bank | R2 level → bank | Level → coin | Median bank gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast | 31.3% | 30.6% | 19.4% | 27 of 85 | 10.2 | 2.8% | 100.0% of 1 |
| Normal | 27.1% | 28.5% | 26.4% | 20 of 80 | 8.4 | 0.0% | – |
| Long | 30.6% | 27.8% | 26.4% | 10 of 69 | 8.9 | 0.0% | – |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| Fast | 1701.9 | 3.1% | 0.0 |
| Normal | 1636.2 | 2.8% | 0.0 |
| Long | 1618.0 | 2.5% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 9240 | 25.9% | 13.2% | 6.5% | 3.2% | 7.0% |
| Mixed | 8600 | 26.8% | 13.5% | 6.9% | 3.3% | 6.8% |
| Casual | 8560 | 25.4% | 12.4% | 6.8% | 3.5% | 7.4% |

## The final: picks, blocks and the mercy rules

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | No blocks (3 or fewer legal moves) | A block hits a pick | Blocks that hit a pick | Active block hits a pick | …the better pick | …the worse pick | …picks level | Block cancelled (mate in one) | Forfeited blocks | The worse pick played (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 2653 | 4.7% | 67.5% | 50.2% | 47.6% | 8.5% | 2.7% | 36.4% | 15 (0.6%) | 2.1% | 12.3% |
| Mixed | 2205 | 3.2% | 66.5% | 45.9% | 43.0% | 10.5% | 3.3% | 29.3% | 7 (0.3%) | 2.3% | 17.3% |
| Casual | 2657 | 3.7% | 60.4% | 41.0% | 39.9% | 4.9% | 2.1% | 32.9% | 11 (0.4%) | 2.0% | 11.4% |

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## What this means for fun

**Caveats first.** Bots aren't people, and the minutes come from a model of how people use a team clock (above), not
from playtests. The first playtests should check how fast squads really spend a shared bank, and how often a move
misses the free seconds.

- **Every option fits.** Medians are 30.6 (Fast), 33.1 (Normal) and 31.3 (Long) minutes, and 90th percentiles 37.1,
  39.7 and 37.2 (36 lobbies each). One Fast lobby ran 78 minutes, a lone outlier.
- **The free seconds set the length; the bank sets the pressure.** People spend most of the free seconds on every
  move, so they put a floor under the lobby: at 4 s the tuning runs' medians were 36-38 minutes, at 3 s about 30.
  An increment made lobbies longer (40 minutes at +1 s) without helping, so it's off. With 3 free seconds, a bigger
  bank barely lengthens the lobby; it means less sudden death. So the options differ in pressure, not length.
- **Sudden death:**
  - It's common but not the norm: 65% of squads reach it on Fast, 48% on Normal, 38% on Long.
  - Most get there in round 2 (Pairs), after spending round 1's bank: about half of the squads playing round 2.
  - 12%, 6% and 5% of all moves are made in sudden death (29%, 18% and 16% in Pairs).
  - About 1-2% of actions miss the free seconds and become random moves.
- **Fast winners carry more forward.** Round 1 winners from the quicker half of the matches arrive at round 2 with 19,
  28 and 39 s of bank (Fast, Normal, Long), against 10, 13 and 16 s for the slower half. That's before the top-up,
  which is bigger than either.
  - That edge is small and doesn't decide matches: the squad with more bank won 38-52% of round 2 matches and 42-62%
    of finals.
  - If Eric wants fast wins to pay off more, the levers are a smaller top-up or a bigger starting bank.
- **Ties:** 28-31% of Relay and 19-26% of Pairs matches end level on points and go to the bank. A quarter of those
  (57 of 234) need the coin, mostly because both squads are at zero. Armageddon stays rare (one drawn final).
- **The coin, the blocks and the mercy rules** behave as before:
  - the coin plays a clearly weaker pair pick (5+ points) on about 7% of moves;
  - the final's active block forces a clearly worse pick on 5-11%;
  - blocks are off (few legal moves) on 3-5% of moves, and cancelled before a mate on 0.3-0.6%.

### Tuning I recommend
1. **Ship these options** (3, 4 and 5 minutes; top-ups of 45 s, 1 and 1 minute; 3 free seconds; no increment). Then
   measure real spending, sudden-death misses and lobby length in playtests.
2. **If 3 free seconds feels harsh for a pair in sudden death** (Eric's worry about Pairs), give Pairs more free
   seconds than the other rounds. That would need a per-format free-seconds setting; at 4-5 s for every round, a
   lobby runs 36-45 minutes.
3. **If the coin settles too many ties** (both squads at zero), break them next on the squad that reached sudden death
   later.
