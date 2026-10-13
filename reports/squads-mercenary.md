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
| #1 (4, +1, 3 s free) | 33.2 | 39.3 | 50.7 | 26.0 | 33.5 |

By skill mix (median minutes):

| Mix | #1 |
| --- | --- |
| Strong | 33.4 |
| Mixed | 33.0 |
| Casual | 33.1 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 8.4 | 10.9 | 10.9 | 35.5 | 40.5 | 30.9 |

## Sudden death

A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).

| Clock | Squads that reach it | …first in round 1 | …in round 2 | …in the final | Moves made in sudden death | …round 1 | …round 2 | …final | Moves out of time (random) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 48.1% | 17.5% | 53.8% | 14.6% | 8.4% | 3.0% | 23.0% | 20.3% | 1.4% |

## Bank carried forward

Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.

| Clock | Bank left, faster R1 wins | Bank left, slower R1 wins | Faster R1 matches (min) | Slower R1 matches (min) | R2: more bank wins | Final: more bank wins |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 30.7 s | 12.9 s | 7.3 | 9.4 | 43.7% of 142 | 50.0% of 50 |

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
| #1 | 28.5% | 31.6% | 22.9% | 43 of 167 | 10.2 | 1.4% | 0.0% of 1 |

## Missed actions

| Clock | Actions per lobby | Missed (absent or out of time) | Seats handed to a bot, per lobby |
| --- | --- | --- | --- |
| #1 | 1652.0 | 3.0% | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 6175 | 27.3% | 13.8% | 6.2% | 2.4% | 7.2% |
| Mixed | 6533 | 26.6% | 13.0% | 6.6% | 2.0% | 8.6% |
| Casual | 6015 | 25.0% | 13.0% | 7.1% | 2.6% | 7.2% |

## Round 2: same-move tokens

5 per squad per Pairs match. Refunded when the judge finds an only move (every other move 0.37 of expected score worse).

| Mix | Tokens burned per squad per match | Refunded | Not refunded: another move close | …another move better | …unranked or no judge |
| --- | --- | --- | --- | --- | --- |
| Strong | 2.5 | 74.7% | 25.3% | 0.0% | 0.0% |
| Mixed | 1.9 | 81.6% | 18.4% | 0.0% | 0.0% |
| Casual | 1.2 | 86.6% | 13.4% | 0.0% | 0.0% |

## Blocks (every round)

A 5-point bank per squad per match. Bots block sparingly: the other squad's likely reply to their own move.

| Mix | Round | Blocks per squad per match | Points spent per squad per match | In effect | Lifted: impossible after the move | …in check | …no move left | …mate in one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | Round 1 (Relay) | 2.9 | 4.7 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Strong | Round 2 (Pairs) | 3.4 | 4.0 | 64.8% | 14.7% | 0.0% | 0.0% | 0.0% |
| Strong | Final | 1.9 | 1.8 | 51.1% | 2.2% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mixed | Round 2 (Pairs) | 3.5 | 4.6 | 71.6% | 11.4% | 0.6% | 0.0% | 0.0% |
| Mixed | Final | 1.5 | 1.4 | 43.8% | 4.1% | 0.0% | 0.0% | 0.0% |
| Casual | Round 1 (Relay) | 3.0 | 4.6 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| Casual | Round 2 (Pairs) | 3.6 | 4.0 | 63.4% | 17.2% | 0.0% | 0.0% | 0.0% |
| Casual | Final | 1.9 | 1.4 | 34.8% | 4.3% | 0.0% | 0.0% | 0.0% |

## The final: the vote

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | Picks counted (mean) | A clear majority (3+ of 4) | 2 of 4 on the top move | A tie (the coin) | Nobody picked | The move played worse than the best pick (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 1594 | 3.8 | 72.9% | 17.7% | 9.3% | 0.0% | 2.9% |
| Mixed | 1405 | 3.9 | 63.1% | 23.0% | 14.0% | 0.0% | 7.7% |
| Casual | 1434 | 3.9 | 54.3% | 28.9% | 16.7% | 0.0% | 12.1% |

## Mercenary: the economy

Every lobby here is Mercenary. Earning: a capture by the piece taken (P 1, N 3, B 3, R 5, Q 9), a board won 40 (a mate 25 more), drawn 15 each, those times 1, 2, 4 in Relay, Pairs and the final; a match won 150, a brilliant move 25 (at most 2 a squad a match).
Catch-up: 50.0% of the earned gap to the next opponent, at most 150. Prices: stockfish 200 (cap 2), blocks 100 (cap 2), shield 100 (cap 2), chip 25, 25, 50, 50 then 50 (hold 3); the others each +100 for every one already bought. The people's shopping is played by the bots' policy (`botShop`): before the final it saves everything 25.0% of the time, else spends 50.0%–90.0% of its wallet; in the final all of it.

### Coins earned per squad per round

Coins by play (catch-up apart), each squad in each match it played (Armageddon with its final).

| Round | All: median | 10th–90th | Mean | Winners: median | 10th–90th | Losers: median | 10th–90th | Base: played (mean) | Captures | Board wins | Mates | Draws | Match win | Brilliant | Base share |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Round 1 (Relay) | 512 | 251–641 | 466 | 622 | 540–650 | 322 | 235–411 | 200 | 69 | 74 | 46 | 0 | 75 | 2 | 59% |
| Round 2 (Pairs) | 516 | 234–728 | 484 | 680 | 544–740 | 284 | 228–428 | 200 | 79 | 80 | 50 | 0 | 75 | 1 | 57% |
| Final | 646 | 220–746 | 481 | 726 | 678–750 | 240 | 216–276 | 200 | 75 | 80 | 50 | 1 | 75 | 1 | 57% |


Winners' rounds before a shop (Relay and Pairs): 100.0% earned at least 400 (a Stockfish token, a Time chip reload of 100 and a shield or block points), 14.4% at least 700 (a second token too).

### The shop

Each squad still in, as it shops for its next match: its wallet (catch-up included), what it spent, how many items it bought, saved everything, and items at their cap.

| Shopping for | Wallet: median | 10th–90th | Spent: median | Items bought (mean) | Saved everything | Items at their cap (mean) |
| --- | --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 627 | 561–651 | 325 | 3.6 | 26.4% | 0.9 |
| Final | 951 | 793–1,321 | 875 | 6.3 | 0.0% | 2.2 |

What was bought (per squad shopping, mean):

| Shopping for | stockfish | blocks | shield | chip |
| --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 0.1 | 1.0 | 0.7 | 1.8 |
| Final | 0.8 | 1.6 | 1.3 | 2.5 |

### Catch-up and snowballing

Matches of round 2 and the final: the squads' earned gap before catch-up, the catch-up paid, the poorer squad's coins as a share of the richer's going into the match (earned before catch-up; wallets with it, before shopping), how often the squad that had earned less won, and how often the squad that spent more won.

| Round | Matches | Earned gap: median | Catch-up: median | Earned, poorer ÷ richer: median | Wallets, poorer ÷ richer: median | 10th percentile | Under 2/3 | The poorer squad won | The squad that spent more won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Round 2 (Pairs) | 144 | 41 | 20 | 94% | 97% | 92% | 0.0% | 43.4% of 143 | 55.3% of 114 |
| Final | 72 | 105 | 50 | 92% | 85% | 67% | 9.7% | 50.0% of 72 | 49.2% of 63 |

Per squad per match of round 2 and the final: 0.4 Stockfish tokens used, 0.8 blocks shielded, 1.7 Time chips tapped. Brilliant moves: 0.8 a lobby (past the cap, unpaid: 2 in all).

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## Notes (by hand)

**The economy's shape** (Eric, Oct 13; DECISIONS.md, "Mercenary: Eric's first changes"). Like Counter-Strike's or
Valorant's: most coins are a steady base, every match a squad plays (200, and 150 more for winning it); play adds a
smaller layer (captures, board wins and mates, the capped brilliant moves), multiplied in the later rounds because
they have fewer boards (Relay ×1, Pairs ×2, the final ×4). Only squads that win go on to a shop, so the numbers that
matter are the winners'.

- **A winner's round:** median 622 in Relay (10th to 90th percentile 540 to 650), 680 in Pairs (544 to 740), 726 in
  the final. The base and the win are 57-59% of all coins earned, and about 350 of a winner's ~650.
- **What a round buys:** every winner's round before a shop paid for a Stockfish token, a Time chip reload (25 + 25 +
  50 = 100) and a shield or block points (400). 14% paid for a second token too (700): the very good rounds.
- **A tight spread.** Two squads meeting had earned within a few percent of each other: the poorer had a median 94% of
  the richer's coins earned before Pairs and 92% before the final. Their wallets, catch-up in and before shopping,
  were 97% and 85% (10th percentile 92% and 67%). The wider wallet gap before the final is a choice, not luck: a squad
  that saved everything before Pairs (about a quarter of them, as the bots play it) meets one that spent.
- **Playing well buys an extra item or two:** the 90th-percentile winner earns about 100 more than the 10th in Relay
  and 200 more in Pairs.
- **No snowball:** the squad that had earned more won 50-57% of the next matches; catch-up, half the earned gap up to
  150, is the loss bonus's job here.
- **Brilliant moves** pay 25, at most twice per squad per match: 0.8 a lobby, and the cap held back 2 in 72 lobbies.

**The Time chip** (Eric, Oct 13; DECISIONS.md, "Mercenary: the Time chip"). Squads buy 1.8 chips before Pairs and 2.5
before the final, almost always up to what they may hold, and tap 1.7 a match. A chip gives one move 30 s and never
adds to the bank, so squads reach sudden death about as often as in Classic (48% against 51%; with the time coin, which
added to the bank, 44%), and chips tapped there keep random moves for want of time at 1.4% of moves.

**Length:** a median 33.2 minutes, against Classic's 31.3 on the same seeds (90th percentiles 39.3 and 40.3), about a
minute more than with the time coin (32.0). The shop adds no time; the chips' seconds go on hard moves.

**Through the real server** (`scripts/squads-headless.ts --game mercenary|classic --device` against `wrangler dev`, the
Normal clock, one idle person whose device did its lobby's bots' engine work and the judge's):
- **With the Time chip** (this change), three full bot lobbies at once on one server, on a busy machine (another
  session's full e2e suite ran at the same time; load about 10 on 4 cores): Mercenary 39.9 and 40.1 minutes, Classic
  31.9. Relay alone, before any shop or chip, took 3-4 minutes longer in both Mercenary lobbies (15-16 minutes to
  Classic's 12), so most of the gap comes before the items exist. Both Mercenary devices also answered more bot work
  (1,912 and 1,631 jobs against 1,527) on a saturated CPU.
- **Before Eric's changes** (the Oct 12 economy), two lobbies at once: Mercenary 35.1 minutes, Classic 38.1.
- Single lobbies swing by several minutes either way, so the sim's same-seed comparison above is the measure of
  length; these runs show the whole thing working through the real server. Seven of the eight squads that went on
  bought a chip reload (3 chips) before Pairs, with block points and a shield, and the eighth saved; before the final
  each finalist reloaded 2-3 chips with block points and a shield, three of the four a Stockfish token or two too. No
  errors.

- **The bots' shopping stands in for people** here (`botShop`); real players may buy differently. The prices and caps
  are each one line in `SQUADS.mercenary`.
