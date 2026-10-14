# Squads: bot simulation

108 full lobbies of 32 (8 squads of 4), 12 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (a majority vote), and an Armageddon board after a drawn final. Every game is played to the end (the silent
safety cap at move 120 aside). Start votes rotate between the normal start, one opening and random openings.

**The team clock.** Each squad has one bank for the whole tournament, carried from round to round and topped up
when it advances. Each of its moves being thought about drains it past the free seconds (a Relay mover, a pair, the
final's voting squad; two at once drain it twice as fast), and each move made in time earns the increment back. No move
goes past its cap. At zero it's sudden death: every move within the free seconds, or it's a random move, until the
increment for moves made in time lifts it out again. No flag falls. The options:
- Rapid 5+2: 5 min + 2 s a move · max 20 s, +1 a round, 2 s free a move.
- Blitz 3+2: 3 min + 2 s a move · max 15 s, +0:30 a round, 2 s free a move.
- Bullet 1+1: 1 min + 1 s a move · max 10 s, +0:15 a round, 2 s free a move.

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
- They watch the clock: about to think past 85.0% of the time they can see they have (the cap on a move, or their squad's
  bank running out with all its moves going, a Time chip counted), they hurry to beat it, as in sudden death (0.4–1.05 of it).
- Past the cap on a move it's missed. They also miss outright (a distraction) 2.0% of the time: the half waits to their deadline.

A half lasts as long as its slowest player, plus the show: 1 s for a Relay half's moves, 3 s for the pair's reveal,
4.5 s for the final's reveal. A match starts as soon as its two feeder matches are done, after 20 s of bracket; 33.6 s of votes come first.

## How long a lobby takes

Minutes from the votes to the final's last move (Armageddon included).

| Clock | Median | 90th percentile | Longest | Shortest | Median if rounds ran in lockstep |
| --- | --- | --- | --- | --- | --- |
| Rapid 5+2 (+1 a round, 2 s free, max 20 s) | 35.9 | 52.6 | 82.6 | 25.3 | 36.4 |
| Blitz 3+2 (+0:30 a round, 2 s free, max 15 s) | 33.5 | 40.9 | 46.6 | 27.9 | 34.3 |
| Bullet 1+1 (+0:15 a round, 2 s free, max 10 s) | 26.9 | 34.7 | 55.8 | 21.0 | 27.4 |

By skill mix (median minutes):

| Mix | Rapid | Blitz | Bullet |
| --- | --- | --- | --- |
| Strong | 42.4 | 39.2 | 30.2 |
| Mixed | 34.8 | 32.7 | 26.9 |
| Casual | 36.4 | 33.4 | 24.4 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| Rapid | 10.5 | 11.4 | 13.0 | 36.1 | 37.9 | 32.9 |
| Blitz | 9.2 | 10.8 | 10.4 | 37.4 | 39.0 | 31.6 |
| Bullet | 6.1 | 9.2 | 10.3 | 35.2 | 40.6 | 35.4 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds (or it's a random move) until the increment for moves made in time lifts it out again. "Moves made in sudden death": moves whose half began with the squad's bank at zero.

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rapid | 24.7% | 1.7% | 45.8% | 0.0% | 0.4% | 0.0% | 1.8% | 0.0% | 0.5% |
| Blitz | 21.5% | 0.7% | 41.7% | 0.0% | 0.4% | 0.0% | 1.6% | 0.0% | 0.6% |
| Bullet | 30.9% | 0.7% | 60.4% | 0.0% | 0.5% | 0.0% | 2.1% | 0.0% | 0.7% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| Rapid | 48.5 s | 33.2 s | 9.0 | 12.0 | 54.2% of 72 | 58.3% of 36 |
| Blitz | 39.7 s | 30.6 s | 7.8 | 10.8 | 58.3% of 72 | 47.2% of 36 |
| Bullet | 22.7 s | 18.2 s | 5.3 | 7.0 | 66.7% of 72 | 44.4% of 36 |

## How boards end

All mixes.

| Clock | Round | Mate | Draw by the rules | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- |
| Rapid | Round 1 (Relay) | 92.5% | 0.3% | 0.0% | 7.1% |
| Rapid | Round 2 (Pairs) | 98.6% | 1.4% | 0.0% | 0.0% |
| Rapid | Final | 88.9% | 8.3% | 2.8% | 0.0% |
| Blitz | Round 1 (Relay) | 93.8% | 0.3% | 0.0% | 5.9% |
| Blitz | Round 2 (Pairs) | 99.3% | 0.7% | 0.0% | 0.0% |
| Blitz | Final | 100.0% | 0.0% | 0.0% | 0.0% |
| Bullet | Round 1 (Relay) | 91.8% | 0.0% | 0.0% | 8.2% |
| Bullet | Round 2 (Pairs) | 99.3% | 0.7% | 0.0% | 0.0% |
| Bullet | Final | 91.7% | 8.3% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → bank | R2 level → bank | Level → coin | Median bank gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rapid | 28.5% | 31.3% | 44.4% | 0 of 77 | 9.6 | 11.1% | 25.0% of 4 |
| Blitz | 23.6% | 42.4% | 50.0% | 0 of 97 | 7.1 | 0.0% | – |
| Bullet | 32.6% | 31.9% | 45.8% | 0 of 79 | 4.8 | 8.3% | 0.0% of 3 |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| Rapid | 1682.1 | 2.2% | 0.0 |
| Blitz | 1650.6 | 2.3% | 0.0 |
| Bullet | 1709.9 | 2.4% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 9768 | 26.9% | 13.3% | 6.0% | 1.8% | 5.3% |
| Mixed | 9140 | 26.8% | 13.6% | 7.0% | 2.7% | 4.4% |
| Casual | 8798 | 25.7% | 12.5% | 6.5% | 2.4% | 4.6% |

## Round 2: same-move tokens

5 per squad per Pairs match. Refunded when the judge finds an only move (every other move 0.37 of expected score worse).

| Mix | Tokens burned per squad per match | Refunded | Not refunded: another move close | …another move better | …unranked or no judge |
| --- | --- | --- | --- | --- | --- |
| Strong | 2.2 | 79.2% | 20.8% | 0.0% | 0.0% |
| Mixed | 1.8 | 80.1% | 19.9% | 0.0% | 0.0% |
| Casual | 1.0 | 84.1% | 15.9% | 0.0% | 0.0% |

## Blocks (every round)

A 5-point bank per squad per match. Bots block sparingly: the other squad's likely reply to their own move.

| Mix | Round | Blocks per squad per match | Points spent per squad per match | In effect | Lifted: impossible after the move | …in check | …no move left | …mate in one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | Round 1 (Relay) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Round 2 (Pairs) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Final | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 1 (Relay) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 2 (Pairs) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Final | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 1 (Relay) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 2 (Pairs) | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Final | 0.0 | 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |

## The final: the vote

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | Picks counted (mean) | A clear majority (3+ of 4) | 2 of 4 on the top move | A tie (the coin) | Nobody picked | The move played worse than the best pick (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 3283 | 3.9 | 68.5% | 19.2% | 12.4% | 0.0% | 3.2% |
| Mixed | 2190 | 3.9 | 66.1% | 20.1% | 13.8% | 0.0% | 8.3% |
| Casual | 2005 | 3.9 | 51.8% | 30.6% | 17.7% | 0.0% | 13.7% |

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## What this means for fun

**Caveats first.** Bots aren't people, and the minutes come from a model of how people use a team clock (above), not
from playtests. The first playtests should check how fast squads really spend a shared bank, how often a move misses
its time, and whether Bullet's 2 free seconds feel fair on a phone. The model changed once for the time controls (Oct
13): people watch the clock, and about to think past what they can see they have (the cap, or their squad's bank
running out), they hurry as in sudden death. Without it, a squad living on its increment near zero would have its
people blindly thinking past the bank.

**The time controls** (Eric, Oct 13; DECISIONS.md, "Squads: three chess time controls"): Bullet 1+1, Blitz 3+2, Rapid
5+2 (5+3 until Oct 14, below); 2 free seconds a move each; at most 10, 15 and 20 s a move; +15 s, +30 s and +1 minute a
round.

- **Lengths:** medians of 26.9 (Bullet), 33.5 (Blitz) and 35.9 (Rapid) minutes, 90th percentiles 34.7, 40.9 and 52.6
  (36 lobbies each). The usual bot spread (Mixed) gives 26.9, 32.7 and 34.8; strong bots play longer games (30.2,
  39.2, 42.4). With 36 lobbies the 90th percentile is about the fourth longest lobby and swings by 4-7 minutes: on 72
  lobbies (below) Rapid 5+2's is 45.3 and Blitz's 45.5. Bullet can't get near 20 (below).
- **The increment sets the pace, not the bank.** People spend about their bank over 40 moves plus most of the free
  seconds and the increment, so a squad's bank settles where its drain and its increments meet: in these runs a round
  1 winner carried about 20 s on Bullet, 35 on Blitz and 50 on Rapid. The bank and the top-ups only add a slower start
  to each round. With every option's increment the same, they'd all be within a few minutes of each other.
- **Bullet's floor is the reveals.** About 11 minutes of every lobby is shown, not played: each Relay half's moves
  (1 s), the pair's reveal (3 s) and the final's (4.5 s) over about 220 halves, plus the votes and the bracket. And a
  person needs about 2 s a move (the model's floor; the slowest of the four choosing in a half sets its length). With
  Pairs' reveal at 2 s and the final's at 3 s, Bullet's median falls from 26.9 to 24.0 minutes on the same seeds
  (Mixed, 12 lobbies; 90th percentile 29.6): Eric's call, since it's how the reveals look.
- **Sudden death is rare now:** 31%, 22% and 22% of squads reach it at some point (most in Pairs, where the slower of
  two pickers drains the bank), but only 0.5%, 0.4% and 0.4% of moves are made in it, against 7-13% with the old
  clocks: one move made in time earns the increment and lifts the squad out. 0.5-0.7% of actions become random moves
  for want of time (1.3-2.1% before). (Rapid 5+2 here: 25% of squads, 0.4% of moves, 0.5% random; on 72 lobbies 22%,
  0.4% and 0.5%, as Blitz's.)
- **Ties no longer go to the coin:** 0 of 258 level matches did (a quarter to a third before, when both squads sat at
  zero); the median bank gap deciding one is 5-9 s.
- **Mercenary** (12 lobbies an option, Oct 13): 29.9, 37.8 and 43.9 minutes for Bullet, Blitz and Rapid 5+3 (90th
  percentiles 39.9, 41.6, 52.7); a Time chip's 30 s go on hard moves, as before. Sudden death 28%, 23% and 17% of
  squads, 0.5%, 0.3% and 0.2% of moves. Rapid 5+2 (24 lobbies, Mixed, below): 37.4, 90th percentile 48.2.
- **Same-move tokens, the final's vote:** as before (bots use 1-2 tokens a Pairs match, 76-80% refunded; a clear
  majority on 54-72% of the final's moves, the coin on 11-18%). No blocks in these tables: they're all Classic.

### Tuning I recommend
1. **Ship these options** and measure real lengths, misses and sudden death in playtests.
2. **If Bullet should be shorter,** shorten the reveals in Bullet (above), not its clock: 1 s free seconds would make
   sudden death 1 s a move.
3. **Rapid's long tail:** done (Rapid 5+2, Oct 14, below). If it's still too long in playtests, the next lever is
   the increment again, not the bank or the cap, and Rapid would then sit on top of Blitz.
4. **Watch how people use blocks** (Mercenary): `maxPerTurn` and `bankPerMatch` as before.

### Rapid 5+2 (Eric, Oct 14: "It shouldn't be 55 minutes")

Rapid was 5+3, with a 90th percentile of 54.5 minutes. The candidates replayed the same lobbies as 5+3's calibration
(`SQUADS_SIM_SEEDS="5:00|1:00|2|3|20"`; Classic 72 lobbies an option, 24 per mix; Mercenary 24, Mixed). Minutes:

| Option | Classic median | 90th pct | Longest | Mercenary median | 90th pct | Squads reaching sudden death | Moves in it | Random for want of time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rapid 5+3 (before) | 40.7 | 51.3 | 63.7 | 42.9 | 49.1 | 21% (Merc 20%) | 0.3% (0.3%) | 0.4% (0.3%) |
| **Rapid 5+2 (chosen)** | **36.3** | **45.3** | 82.0 | **37.4** | **48.2** | 22% (22%) | 0.4% (0.4%) | 0.5% (0.4%) |
| Rapid 4+2 | 35.4 | 48.4 | 100.4 | | | 22% | 0.3% | 0.5% |
| Rapid 6+2 | 36.3 | 47.3 | 86.7 | 38.1 | 44.6 | 22% (20%) | 0.3% (0.3%) | 0.4% (0.3%) |
| Blitz 3+2 (unchanged) | 33.5 | 45.5 | 74.7 | 36.0 | 41.6 | 22% (23%) | 0.3% (0.3%) | 0.5% (0.5%) |

- **The increment does it:** one second less a move takes 4-5 minutes off the median and 6 off the 90th percentile.
  The bank hardly matters (4+2, 5+2 and 6+2 within a minute at the median), and a 17 s cap on 5+3 didn't help (40.6
  minutes, 90th percentile 56.5, 36 lobbies). So the change is one number, and the card reads "Rapid 5+2".
- **Still the slowest, but closer to Blitz:** Strong 41.6 against 34.9, Mixed 35.8 against 33.8, Casual 33.9 against
  32.5 (medians), from the bigger bank, top-up and cap. Pulling further ahead of Blitz needs a bigger increment, which
  brings back the long tail.
- **The tail is long games:** a few lobbies whose games run long (in the longest, matches of 20 minutes and more).
  The 90th percentile moves 4-7 minutes between sets of lobbies (Blitz 40.9 on the calibration's 36, 45.5 on these
  72), so compare candidates on the same lobbies, as here.
