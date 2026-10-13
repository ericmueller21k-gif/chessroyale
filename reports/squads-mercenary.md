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
| #1 (4, +1, 3 s free) | 32.0 | 36.4 | 45.5 | 22.1 | 32.2 |

By skill mix (median minutes):

| Mix | #1 |
| --- | --- |
| Strong | 34.4 |
| Mixed | 31.9 |
| Casual | 30.9 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 8.4 | 10.1 | 10.5 | 35.5 | 38.4 | 30.3 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 43.6% | 17.5% | 45.8% | 12.5% | 6.2% | 3.0% | 16.6% | 7.5% | 1.0% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 30.7 s | 12.9 s | 7.3 | 9.4 | 59.7% of 144 | 50.0% of 64 |

## How boards end

All mixes.

| Clock | Round | Mate | Draw by the rules | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- |
| #1 | Round 1 (Relay) | 92.5% | 0.3% | 0.0% | 7.1% |
| #1 | Round 2 (Pairs) | 99.7% | 0.3% | 0.0% | 0.0% |
| #1 | Final | 98.6% | 1.4% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → bank | R2 level → bank | Level → coin | Median bank gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 28.5% | 31.6% | 30.6% | 34 of 169 | 10.2 | 1.4% | 0.0% of 1 |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| #1 | 1627.0 | 2.7% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 6379 | 28.4% | 14.1% | 6.5% | 2.2% | 6.9% |
| Mixed | 5795 | 27.2% | 13.9% | 7.1% | 2.7% | 6.5% |
| Casual | 5981 | 24.9% | 12.6% | 6.2% | 2.4% | 6.9% |

## Round 2: same-move tokens

5 per squad per Pairs match. Refunded when the judge finds an only move (every other move 0.37 of expected score worse).

| Mix | Tokens burned per squad per match | Refunded | Not refunded: another move close | …another move better | …unranked or no judge |
| --- | --- | --- | --- | --- | --- |
| Strong | 2.1 | 75.5% | 24.5% | 0.0% | 0.0% |
| Mixed | 1.5 | 77.4% | 22.6% | 0.0% | 0.0% |
| Casual | 1.4 | 75.6% | 24.4% | 0.0% | 0.0% |

## Blocks (every round)

A 5-point bank per squad per match. Bots block sparingly: the other squad's likely reply to their own move.

| Mix | Round | Blocks per squad per match | Points spent per squad per match | In effect | Lifted: impossible after the move | …in check | …no move left | …mate in one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | Round 1 (Relay) | 2.9 | 4.7 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Round 2 (Pairs) | 3.4 | 4.2 | 66.4% | 17.1% | 0.0% | 0.0% | 0.0% |
| Strong | Final | 2.4 | 2.4 | 50.4% | 6.2% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 2 (Pairs) | 3.3 | 4.3 | 72.4% | 10.6% | 0.3% | 0.0% | 0.0% |
| Mixed | Final | 2.2 | 1.8 | 46.7% | 5.7% | 0.0% | 0.0% | 0.0% |
| Casual | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 2 (Pairs) | 3.4 | 4.1 | 66.4% | 14.4% | 0.0% | 0.0% | 0.0% |
| Casual | Final | 1.7 | 1.5 | 47.5% | 8.8% | 0.0% | 0.0% | 0.0% |

## The final: the vote

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | Picks counted (mean) | A clear majority (3+ of 4) | 2 of 4 on the top move | A tie (the coin) | Nobody picked | The move played worse than the best pick (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 1653 | 3.9 | 74.0% | 15.7% | 10.1% | 0.1% | 3.5% |
| Mixed | 1410 | 3.9 | 65.2% | 19.2% | 15.5% | 0.0% | 7.4% |
| Casual | 1232 | 3.9 | 55.5% | 26.2% | 18.3% | 0.0% | 9.8% |

## Mercenary: the economy

Every lobby here is Mercenary. Earning: a capture by the piece taken (P 1, N 3, B 3, R 5, Q 9), a board won 40 (a mate 25 more), drawn 15 each, those times 1, 2, 4 in Relay, Pairs and the final; a match won 150, a brilliant move 25 (at most 2 a squad a match).
Catch-up: 50.0% of the earned gap to the next opponent, at most 150. Prices: stockfish 200 (cap 2), blocks 100 (cap 2), shield 100 (cap 2), time 75 (cap 2), each +100 for every one already bought. The people's shopping is played by the bots' policy (`botShop`): before the final it saves everything 25.0% of the time, else spends 50.0%–90.0% of its wallet; in the final all of it.

### Coins earned per squad per round

Coins by play (catch-up apart), each squad in each match it played (Armageddon with its final).

| Round | All: median | 10th–90th | Mean | Winners: median | 10th–90th | Losers: median | 10th–90th | Base: played (mean) | Captures | Board wins | Mates | Draws | Match win | Brilliant | Base share |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Round 1 (Relay) | 512 | 251–641 | 466 | 622 | 540–650 | 322 | 235–411 | 200 | 69 | 74 | 46 | 0 | 75 | 2 | 59% |
| Round 2 (Pairs) | 512 | 234–732 | 484 | 686 | 542–742 | 276 | 224–432 | 200 | 78 | 80 | 50 | 0 | 75 | 1 | 57% |
| Final | 630 | 220–746 | 484 | 730 | 678–758 | 240 | 212–292 | 200 | 77 | 80 | 50 | 1 | 75 | 1 | 57% |


Winners' rounds before a shop (Relay and Pairs): 100.0% earned at least 400 (a Stockfish token, a time reload of 100 and a shield or block points), 14.4% at least 700 (a second token too).

### The shop

Each squad still in, as it shops for its next match: its wallet (catch-up included), what it spent, how many items it bought, saved everything, and items at their cap.

| Shopping for | Wallet: median | 10th–90th | Spent: median | Items bought (mean) | Saved everything | Items at their cap (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 627 | 561–651 | 300 | 2.4 | 26.4% | 0.5 |
| Final | 957 | 769–1,321 | 875 | 4.6 | 0.0% | 1.6 |

What was bought (per squad shopping, mean):

| Shopping for | stockfish | blocks | shield | time |
| --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 0.1 | 0.9 | 0.6 | 0.7 |
| Final | 0.6 | 1.5 | 1.2 | 1.4 |

### Catch-up and snowballing

Matches of round 2 and the final: the squads' earned gap before catch-up, the catch-up paid, the poorer squad's coins as a share of the richer's going into the match (earned before catch-up; wallets with it, before shopping), how often the squad that had earned less won, and how often the squad that spent more won.

| Round | Matches | Earned gap: median | Catch-up: median | Earned, poorer ÷ richer: median | Wallets, poorer ÷ richer: median | 10th percentile | Under 2/3 | The poorer squad won | The squad that spent more won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 144 | 41 | 20 | 94% | 97% | 92% | 0.0% | 42.7% of 143 | 57.1% of 119 |
| Final | 72 | 90 | 50 | 93% | 85% | 67% | 11.1% | 41.7% of 72 | 54.7% of 64 |

Per squad per match of round 2 and the final: 0.3 Stockfish tokens used, 0.7 blocks shielded. Brilliant moves: 0.8 a lobby (past the cap, unpaid: 2 in all).

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## Notes (by hand)

**The economy's shape** (Eric, Oct 13; DECISIONS.md, "Mercenary: Eric's first changes"). Like Counter-Strike's or
Valorant's: most coins are a steady base, every match a squad plays (200, and 150 more for winning it); play adds a
smaller layer (captures, board wins and mates, the capped brilliant moves), multiplied in the later rounds because
they have fewer boards (Relay ×1, Pairs ×2, the final ×4). Only squads that win go on to a shop, so the numbers that
matter are the winners'.

- **A winner's round:** median 622 in Relay (10th to 90th percentile 540 to 650), 686 in Pairs (542 to 742), 730 in
  the final. The base and the win are 57-59% of all coins earned, and about 350 of a winner's ~650.
- **What a round buys:** every winner's round before a shop paid for a Stockfish token, a time reload (100 at Eric's
  Time chip prices) and a shield or block points (400). 14% paid for a second token too (700): the very good rounds.
- **A tight spread.** Two squads meeting had earned within a few percent of each other: the poorer had a median 94% of
  the richer's coins earned before Pairs and 93% before the final. Their wallets, catch-up in and before shopping,
  were 97% and 85% (10th percentile 92% and 67%). The wider wallet gap before the final is a choice, not luck: a squad
  that saved everything before Pairs (about a quarter of them, as the bots play it) meets one that spent.
- **Playing well buys an extra item or two:** the 90th-percentile winner earns about 100 more than the 10th in Relay
  and 200 more in Pairs.
- **No snowball:** the squad that had earned more won 57-58% of the next matches (it played better, so some edge is
  fair); catch-up, half the earned gap up to 150, is the loss bonus's job here.
- **Brilliant moves** pay 25, at most twice per squad per match: 0.8 a lobby, and the cap held back 2 in 72 lobbies.
- **Length:** a median 32.0 minutes, against Classic's 31.3 on the same seeds (90th percentiles 36.4 and 40.3). The
  shop adds no time; the time coins bought make squads reach sudden death less often (44% against 51%).

**Through the real server** (`scripts/squads-headless.ts --game mercenary|classic --device` against `wrangler dev`, the
Normal clock, one idle person whose device did the bots' engine work and the judge's), run on Oct 13 before these
changes (the Oct 12 economy, with the Breather): two full bot lobbies at the same time on one server, Mercenary 35.1
minutes and Classic 38.1, each with a long final (17 and 15 minutes). The Mercenary squads earned 69 to 660 in Relay.
Of the four that went on, two saved everything before Pairs and two spent most of their wallets (shields, time coins,
block points); no errors, 994 bot-work jobs answered. The economy above replaces those numbers; the Time chip's change
reruns these lobbies.

- **The bots' shopping stands in for people** here (`botShop`); real players may buy differently. The prices and caps
  are each one line in `SQUADS.mercenary`.
