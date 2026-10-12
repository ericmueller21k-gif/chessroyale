# Squads: bot simulation

108 full lobbies of 32 (8 squads of 4), 12 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (a majority vote), and an Armageddon board after a drawn final. Every game is played to the end (the silent
safety cap at move 120 aside). Start votes rotate between the normal start, one opening and random openings.

**The team clock.** Each squad has one bank for the whole tournament, carried from round to round and topped up
when it advances. Each of its moves being thought about drains it past the free seconds (a Relay mover, a pair, the
final's voting squad; two at once drain it twice as fast). At zero it's sudden death: every move within the free seconds,
or it's a random move. No flag falls. The options:
- Fast: Team clock 3 min · +0:45 min a round · 3 s free a move.
- Normal: Team clock 4 min · +1 min a round · 3 s free a move.
- Long: Team clock 5 min · +1 min a round · 3 s free a move.

**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at
10,000 nodes, its top 8 moves) then `botPick` at the person's skill, a temperature over each move's loss:
Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. Winning, a bot plays with purpose (the
engine's order breaks ties between moves that all win, and it plays a mate it sees). In Pairs it matches its partner
(a same-move token) only on an only move; in the final it sometimes copies a teammate; now and then it blocks the
other squad's likely reply (`bots.ts`). The rules never ask the engine, but for a token's refund (the judge's top
moves: here this engine's); the engine also judges which of two picks was better, for this report only.

**A person's clock use and misses are assumptions** (there's no real Squads data yet):
- With bank left, a person thinks for their squad's bank / 40 + 0.8 × (the free seconds + any increment), times a
  random factor of 0.5–1.5, at least 2 s.
- In sudden death they try to beat the free seconds: 0.4–1.05 of them, at least 1 s; past them it's missed.
- Past the per-move ceiling (20 s) it's missed. They also miss outright (a distraction) 2.0% of the time.

A half lasts as long as its slowest player, plus the show: 1 s for a Relay half's moves, 3 s for the pair's reveal,
4.5 s for the final's reveal. A match starts as soon as its two feeder matches are done, after 20 s of bracket; 22.4 s of votes come first.

## How long a lobby takes

Minutes from the votes to the final's last move (Armageddon included).

| Clock | Median | 90th percentile | Longest | Shortest | Median if rounds ran in lockstep |
| --- | --- | --- | --- | --- | --- |
| Fast (3, +0:45, 3 s free) | 28.6 | 33.3 | 40.3 | 19.6 | 29.0 |
| Normal (4, +1, 3 s free) | 30.2 | 39.6 | 47.4 | 21.4 | 30.6 |
| Long (5, +1, 3 s free) | 31.1 | 37.1 | 40.4 | 26.7 | 31.1 |

By skill mix (median minutes):

| Mix | Fast | Normal | Long |
| --- | --- | --- | --- |
| Strong | 31.7 | 33.4 | 32.9 |
| Mixed | 28.6 | 30.6 | 31.4 |
| Casual | 27.6 | 29.6 | 30.8 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| Fast | 7.9 | 9.2 | 9.1 | 36.5 | 38.7 | 30.5 |
| Normal | 8.5 | 9.8 | 9.8 | 36.5 | 39.2 | 31.7 |
| Long | 9.2 | 9.9 | 9.0 | 37.1 | 39.4 | 28.7 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fast | 63.9% | 29.9% | 61.1% | 13.9% | 12.6% | 6.1% | 30.3% | 33.0% | 2.1% |
| Normal | 49.0% | 17.7% | 53.5% | 18.1% | 7.9% | 2.7% | 22.5% | 20.9% | 1.4% |
| Long | 46.2% | 15.3% | 53.5% | 16.7% | 7.2% | 2.6% | 20.7% | 17.2% | 1.3% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| Fast | 22.5 s | 6.8 s | 6.8 | 9.0 | 53.6% of 69 | 56.3% of 16 |
| Normal | 30.1 s | 11.5 s | 7.4 | 9.6 | 54.9% of 71 | 44.4% of 27 |
| Long | 35.4 s | 15.1 s | 8.0 | 10.5 | 53.5% of 71 | 48.1% of 27 |

## How boards end

All mixes.

| Clock | Round | Mate | Draw by the rules | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- |
| Fast | Round 1 (Relay) | 93.9% | 0.0% | 0.0% | 6.1% |
| Fast | Round 2 (Pairs) | 98.6% | 1.4% | 0.0% | 0.0% |
| Fast | Final | 100.0% | 0.0% | 0.0% | 0.0% |
| Normal | Round 1 (Relay) | 92.9% | 0.5% | 0.0% | 6.6% |
| Normal | Round 2 (Pairs) | 100.0% | 0.0% | 0.0% | 0.0% |
| Normal | Final | 100.0% | 0.0% | 0.0% | 0.0% |
| Long | Round 1 (Relay) | 92.5% | 0.2% | 0.0% | 7.3% |
| Long | Round 2 (Pairs) | 100.0% | 0.0% | 0.0% | 0.0% |
| Long | Final | 100.0% | 0.0% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → bank | R2 level → bank | Level → coin | Median bank gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast | 24.3% | 31.3% | 13.9% | 31 of 86 | 7.5 | 0.0% | – |
| Normal | 26.4% | 31.9% | 27.8% | 24 of 90 | 9.3 | 0.0% | – |
| Long | 29.2% | 28.5% | 23.6% | 19 of 77 | 12.5 | 0.0% | – |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| Fast | 1638.7 | 3.5% | 0.0 |
| Normal | 1641.9 | 2.9% | 0.0 |
| Long | 1649.0 | 2.9% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 9781 | 28.0% | 13.3% | 6.2% | 2.2% | 8.3% |
| Mixed | 9024 | 24.8% | 12.2% | 6.0% | 2.0% | 7.9% |
| Casual | 8632 | 22.5% | 11.8% | 6.1% | 2.2% | 7.0% |

## Round 2: same-move tokens

5 per squad per Pairs match. Refunded when the judge finds an only move (every other move 0.37 of expected score worse).

| Mix | Tokens burned per squad per match | Refunded | Not refunded: another move close | …another move better | …unranked or no judge |
| --- | --- | --- | --- | --- | --- |
| Strong | 2.0 | 79.5% | 20.5% | 0.0% | 0.0% |
| Mixed | 1.4 | 75.1% | 24.9% | 0.0% | 0.0% |
| Casual | 0.9 | 80.0% | 20.0% | 0.0% | 0.0% |

## Blocks (every round)

A 5-point bank per squad per match. Bots block sparingly: the other squad's likely reply to their own move.

| Mix | Round | Blocks per squad per match | Points spent per squad per match | In effect | Lifted: impossible after the move | …in check | …no move left | …mate in one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | Round 1 (Relay) | 2.8 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Round 2 (Pairs) | 2.6 | 3.9 | 84.5% | 15.5% | 0.0% | 0.0% | 0.0% |
| Strong | Final | 1.5 | 2.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 1 (Relay) | 2.9 | 4.7 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 2 (Pairs) | 2.6 | 3.9 | 85.7% | 14.3% | 0.0% | 0.0% | 0.0% |
| Mixed | Final | 1.5 | 2.6 | 94.6% | 5.4% | 0.0% | 0.0% | 0.0% |
| Casual | Round 1 (Relay) | 3.0 | 4.7 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 2 (Pairs) | 2.7 | 3.8 | 83.1% | 16.6% | 0.3% | 0.0% | 0.0% |
| Casual | Final | 1.6 | 2.7 | 92.3% | 7.7% | 0.0% | 0.0% | 0.0% |

## The final: the vote

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | Picks counted (mean) | A clear majority (3+ of 4) | 2 of 4 on the top move | A tie (the coin) | Nobody picked | The move played worse than the best pick (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 2425 | 3.8 | 71.5% | 16.4% | 12.0% | 0.0% | 2.6% |
| Mixed | 2012 | 3.9 | 64.1% | 22.0% | 13.9% | 0.0% | 8.0% |
| Casual | 1952 | 3.8 | 54.2% | 30.2% | 15.5% | 0.0% | 12.8% |

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## What this means for fun

**Caveats first.** Bots aren't people, and the minutes come from a model of how people use a team clock (above), not
from playtests. The first playtests should check how fast squads really spend a shared bank, and how often a move
misses the free seconds. Squads v2 (Oct 12: same-move tokens, move blocks, the final's vote) is in these tables; the
bots' use of tokens and blocks is their own (`bots.ts`), not a model of people's.

- **Every option still fits, about 30 minutes.** Medians are 28.6 (Fast), 30.2 (Normal) and 31.1 (Long) minutes, and
  90th percentiles 33.3, 39.6 and 37.1 (36 lobbies each), the same as before Squads v2 (30.6, 33.1 and 31.3). Blocks
  and votes cost no extra time: a block is placed inside a move's thinking time, and the final's vote waits for its
  slowest picker as the old final waited for its four players.
- **The free seconds set the length; the bank sets the pressure.** People spend most of the free seconds on every
  move, so they put a floor under the lobby: at 4 s the tuning runs' medians were 36-38 minutes, at 3 s about 30.
- **Sudden death:** 64%, 49% and 46% of squads reach it (Fast, Normal, Long), most in round 2 (Pairs); 13%, 8% and 7%
  of all moves are made in it. About 1-2% of actions miss the free seconds and become random moves.
- **Same-move tokens (Pairs):** bots use 1-2 of their 5 a match (they match a partner only on an only move), and the
  judge gives 75-80% of them back. People will use more: they can match any move.
- **Blocks:** bots block the other squad's likely reply to their own move, sparingly: 1.5-3 blocks a squad a match,
  2.6-4.7 of the 5 points. In Pairs 14-17% are lifted (the coin played the partner's move, which made the blocked
  reply impossible: refunded); the mercy rules (check, no move left, mate in one) almost never trigger.
- **The final's vote:** a clear majority (3 or 4 of 4) on 54-72% of moves, a 2-1-1 on 16-30%, a tie settled by the
  coin on 12-16%. The move played is worse than the best pick on 3-13% (weaker squads more often).
- **Ties:** 28-32% of Relay and 14-28% of Pairs matches end level on points and go to the bank; a quarter to a third
  of those need the coin, mostly because both squads are at zero. No final was drawn.

### Tuning I recommend
1. **Ship these options** (3, 4 and 5 minutes; top-ups of 45 s, 1 and 1 minute; 3 free seconds; no increment). Then
   measure real spending, sudden-death misses, token and block use and lobby length in playtests.
2. **Watch how people use blocks.** One big blocking play is allowed (Eric); if it feels like too much, `maxPerTurn`
   caps blocks a turn, and `bankPerMatch` sets how many points a squad has.
3. **If 3 free seconds feels harsh for a pair in sudden death,** give Pairs more free seconds than the other rounds (a
   per-format free-seconds setting; at 4-5 s for every round, a lobby runs 36-45 minutes).
