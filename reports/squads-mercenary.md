# Squads, Mercenary mode: bot simulation

72 full lobbies of 32 (8 squads of 4), 24 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (a majority vote), and an Armageddon board after a drawn final. Every game is played to the end (the silent
safety cap at move 120 aside). Start votes rotate between the normal start, one opening and random openings.

**The team clock.** Each squad has one bank for the whole tournament, carried from round to round and topped up
when it advances. Each of its moves being thought about drains it past the free seconds (a Relay mover, a pair, the
final's voting squad; two at once drain it twice as fast). At zero it's sudden death: every move within the free seconds,
or it's a random move. No flag falls. The options:
- #1: Team clock 4 min · +1 min a round · 3 s free a move.

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
4.5 s for the final's reveal. A match starts as soon as its two feeder matches are done, after 20 s of bracket; 33.6 s of votes come first.

## How long a lobby takes

Minutes from the votes to the final's last move (Armageddon included).

| Clock | Median | 90th percentile | Longest | Shortest | Median if rounds ran in lockstep |
| --- | --- | --- | --- | --- | --- |
| #1 (4, +1, 3 s free) | 33.1 | 39.1 | 50.2 | 27.2 | 33.6 |

By skill mix (median minutes):

| Mix | #1 |
| --- | --- |
| Strong | 35.9 |
| Mixed | 32.4 |
| Casual | 32.6 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 8.4 | 10.8 | 11.3 | 35.5 | 39.8 | 30.7 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 39.1% | 17.5% | 36.8% | 12.5% | 5.2% | 3.0% | 12.5% | 5.6% | 0.9% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 30.7 s | 12.9 s | 7.3 | 9.4 | 52.1% of 142 | 48.6% of 70 |

## How boards end

All mixes.

| Clock | Round | Mate | Draw by the rules | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- |
| #1 | Round 1 (Relay) | 92.5% | 0.3% | 0.0% | 7.1% |
| #1 | Round 2 (Pairs) | 98.6% | 1.4% | 0.0% | 0.0% |
| #1 | Final | 100.0% | 0.0% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → bank | R2 level → bank | Level → coin | Median bank gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 28.5% | 31.6% | 36.1% | 24 of 167 | 11.3 | 0.0% | – |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| #1 | 1634.6 | 2.6% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 6276 | 26.7% | 13.4% | 5.9% | 2.0% | 5.9% |
| Mixed | 6005 | 29.0% | 14.7% | 7.5% | 2.6% | 5.8% |
| Casual | 6078 | 23.4% | 12.3% | 6.1% | 2.3% | 6.3% |

## Round 2: same-move tokens

5 per squad per Pairs match. Refunded when the judge finds an only move (every other move 0.37 of expected score worse).

| Mix | Tokens burned per squad per match | Refunded | Not refunded: another move close | …another move better | …unranked or no judge |
| --- | --- | --- | --- | --- | --- |
| Strong | 2.1 | 74.3% | 25.7% | 0.0% | 0.0% |
| Mixed | 1.8 | 75.7% | 24.3% | 0.0% | 0.0% |
| Casual | 1.4 | 75.8% | 24.2% | 0.0% | 0.0% |

## Blocks (every round)

A 5-point bank per squad per match. Bots block sparingly: the other squad's likely reply to their own move.

| Mix | Round | Blocks per squad per match | Points spent per squad per match | In effect | Lifted: impossible after the move | …in check | …no move left | …mate in one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | Round 1 (Relay) | 2.9 | 4.7 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Round 2 (Pairs) | 3.3 | 4.2 | 70.0% | 14.1% | 0.0% | 0.0% | 0.0% |
| Strong | Final | 2.0 | 2.3 | 64.2% | 5.3% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 2 (Pairs) | 3.5 | 4.5 | 72.2% | 13.4% | 0.0% | 0.0% | 0.0% |
| Mixed | Final | 1.5 | 1.7 | 56.8% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 2 (Pairs) | 3.2 | 3.9 | 70.5% | 12.5% | 0.0% | 0.0% | 0.0% |
| Casual | Final | 1.6 | 1.7 | 57.0% | 5.1% | 0.0% | 0.0% | 0.0% |

## The final: the vote

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | Picks counted (mean) | A clear majority (3+ of 4) | 2 of 4 on the top move | A tie (the coin) | Nobody picked | The move played worse than the best pick (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 1640 | 3.9 | 70.4% | 17.4% | 12.2% | 0.0% | 4.2% |
| Mixed | 1449 | 3.9 | 64.5% | 21.6% | 13.9% | 0.0% | 7.9% |
| Casual | 1230 | 3.9 | 55.1% | 28.3% | 16.6% | 0.0% | 12.4% |

## Mercenary: the economy

Every lobby here is Mercenary. Earning: a capture by the piece taken (P 3, N 9, B 9, R 15, Q 27), a board won 50 (a mate 50 more), drawn 15 each, a match won 75, a brilliant move 75.
Catch-up: 50.0% of the earned gap to the next opponent, at most 300. Prices: stockfish 200 (cap 2), breather 150 (cap 1), blocks 100 (cap 2), shield 100 (cap 2), time 75 (cap 2), each +100 for every one already bought. The people's shopping is played by the bots' policy (`botShop`): before the final it saves everything 25.0% of the time, else spends 50.0%–90.0% of its wallet; in the final all of it.

### Coins earned per squad per round

Coins by play (catch-up apart), each squad in each match it played (Armageddon with its final).

| Round | All: median | 10th–90th | Winners: median | Losers: median | Captures (mean) | Board wins | Mates | Draws | Match win | Brilliant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Round 1 (Relay) | 446 | 153–663 | 609 | 271 | 207 | 93 | 93 | 0 | 38 | 5 |
| Round 2 (Pairs) | 259 | 51–461 | 394 | 105 | 119 | 49 | 49 | 0 | 38 | 3 |
| Final | 196 | 12–277 | 256 | 24 | 55 | 25 | 25 | 0 | 38 | 0 |

### The shop

Each squad still in, as it shops for its next match: its wallet (catch-up included), what it spent, how many items it bought, saved everything, and items at their cap.

| Shopping for | Wallet: median | 10th–90th | Spent: median | Items bought (mean) | Saved everything | Items at their cap (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 621 | 509–693 | 350 | 2.4 | 26.4% | 0.6 |
| Final | 690 | 518–1,048 | 625 | 3.9 | 0.0% | 1.4 |

What was bought (per squad shopping, mean):

| Shopping for | stockfish | breather | blocks | shield | time |
| --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 0.1 | 0.2 | 0.8 | 0.5 | 0.6 |
| Final | 0.3 | 0.5 | 1.1 | 0.9 | 1.0 |

### Catch-up and snowballing

Matches of round 2 and the final: the squads' earned gap before catch-up, the catch-up paid, how often the squad that had earned less won, and how often the squad that spent more won.

| Round | Matches | Earned gap: median | Catch-up: median | The poorer squad won | The squad that spent more won |
| --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 144 | 72 | 40 | 48.3% of 143 | 62.4% of 125 |
| Final | 72 | 138 | 70 | 45.8% of 72 | 47.7% of 65 |

Per squad per match of round 2 and the final: 0.2 Stockfish tokens used, 0.6 blocks shielded. Brilliant moves: 0.7 a lobby.

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## Notes (by hand)

**What the tables say for the calibration** (DECISIONS.md, "Squads modes: Classic and Mercenary"):

- **Earning.** A squad that wins Relay earns about 600 coins. With Pairs' winnings it reaches the final's shop with
  about 700 (median 690), Eric's "~700 saved by the later rounds".
- **The shop.** Before Pairs a squad has about 620 to spend: a Stockfish token and a shield and a time coin, or block
  points and a breather, about 2-3 items. Before the final, more; a strong squad caps a few items, never all of them.
- **Brilliant moves** are rare (well under one a lobby), as they should be.
- **No snowball.** Catch-up is small, because the earned gaps between squads that both won are small. The squad that
  had earned less won about half of its matches (48% in Pairs, 46% in the final). Spending more helps (62% in Pairs),
  without deciding (48% in the final).
- **Length.** On the same seeds Classic took a median 31.3 minutes (90th percentile 40.3), so Mercenary adds about 2
  minutes. That's the time coins and breathers bought (more time to think): a tuning run without them matched Classic.
  The shop itself adds nothing. Squads reach sudden death less often in Mercenary (39% against Classic's 51%).
- **The bots' shopping stands in for people** here (`botShop`); real players may buy differently. The prices and caps
  are each one line in `SQUADS.mercenary`.
