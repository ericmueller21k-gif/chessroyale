# Squads: bot simulation

72 full lobbies of 32 (8 squads of 4), 8 for every skill mix × Clock option, from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (Pick and Block), and an Armageddon board after a drawn final. Every board has a chess clock and is played
to the end (the silent safety cap at move 120 aside). Start votes rotate between the normal start, one opening and
random openings.

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
| Fast 1+2 | 24.3 | 27.2 | 27.5 | 19.0 | 24.3 |
| Normal 1:45+2 | 31.3 | 34.6 | 36.3 | 26.3 | 31.3 |
| Long 2+3 | 35.5 | 38.2 | 39.8 | 23.2 | 36.8 |

By skill mix (median minutes):

| Mix | Fast 1+2 | Normal 1:45+2 | Long 2+3 |
| --- | --- | --- | --- |
| Strong | 23.1 | 33.3 | 35.3 |
| Mixed | 25.6 | 28.3 | 37.1 |
| Casual | 24.3 | 30.9 | 35.5 |

A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):

| Clock | Round 1 (Relay): min | Round 2 (Pairs): min | Final: min | Round 1 (Relay): moves | Round 2 (Pairs): moves | Final: moves |
| --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2 | 6.5 | 7.0 | 8.0 | 34.2 | 27.4 | 26.1 |
| Normal 1:45+2 | 8.1 | 9.1 | 10.3 | 36.3 | 32.0 | 30.3 |
| Long 2+3 | 9.7 | 10.5 | 12.0 | 35.9 | 31.9 | 31.0 |

## How boards end

All mixes. A flag is a win on time; a flag against bare material is a draw.

| Clock | Round | Mate | Draw by the rules | Flag (win) | Flag (draw) | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2 | Round 1 (Relay) | 71.4% | 0.0% | 22.7% | 0.0% | 0.0% | 6.0% |
| Fast 1+2 | Round 2 (Pairs) | 36.5% | 0.0% | 63.5% | 0.0% | 0.0% | 0.0% |
| Fast 1+2 | Final | 25.0% | 0.0% | 75.0% | 0.0% | 0.0% | 0.0% |
| Normal 1:45+2 | Round 1 (Relay) | 85.7% | 0.0% | 5.7% | 0.0% | 0.0% | 8.6% |
| Normal 1:45+2 | Round 2 (Pairs) | 69.8% | 0.0% | 30.2% | 0.0% | 0.0% | 0.0% |
| Normal 1:45+2 | Final | 62.5% | 0.0% | 37.5% | 0.0% | 0.0% | 0.0% |
| Long 2+3 | Round 1 (Relay) | 90.1% | 0.0% | 1.0% | 0.0% | 0.0% | 8.9% |
| Long 2+3 | Round 2 (Pairs) | 77.1% | 0.0% | 21.9% | 1.0% | 0.0% | 0.0% |
| Long 2+3 | Final | 62.5% | 0.0% | 37.5% | 0.0% | 0.0% | 0.0% |

## Ties

Rounds 1 and 2: a level match goes to the squad with more clock time left (a coin if exactly level). A drawn final goes to Armageddon.

| Clock | R1 clinched early | R1 level → time | R2 level → time | Level → coin | Median time gap deciding a tie (s) | Final drawn → Armageddon | Armageddon won by Black | Minutes per Armageddon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 1+2 | 24.0% | 42.7% | 29.2% | 0 of 55 | 17.6 | 0.0% | – | – |
| Normal 1:45+2 | 34.4% | 40.6% | 37.5% | 0 of 57 | 15.3 | 0.0% | – | – |
| Long 2+3 | 35.4% | 29.2% | 37.5% | 0 of 46 | 13.9 | 0.0% | – | – |

## Clock pressure and missed actions

| Clock | Actions per lobby | Missed | …the ceiling reached | Flag falls per lobby | Seats handed to a bot, per lobby |
| --- | --- | --- | --- | --- | --- |
| Fast 1+2 | 1423.1 | 2.3% | 0.0% | 6.9 | 0.1 |
| Normal 1:45+2 | 1557.0 | 2.1% | 0.0% | 2.5 | 0.0 |
| Long 2+3 | 1578.4 | 2.1% | 0.0% | 1.5 | 0.0 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 4950 | 32.7% | 16.1% | 7.9% | 3.9% | 3.5% |
| Mixed | 4986 | 31.3% | 16.0% | 8.9% | 3.7% | 3.5% |
| Casual | 4964 | 29.1% | 14.3% | 7.9% | 3.6% | 3.4% |

## The final: picks, blocks and the mercy rules

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | No blocks (3 or fewer legal moves) | A block hits a pick | Blocks that hit a pick | Active block hits a pick | …the better pick | …the worse pick | …picks level | Block cancelled (mate in one) | Forfeited blocks | The worse pick played (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 1398 | 2.6% | 71.7% | 51.7% | 48.5% | 11.2% | 4.4% | 32.9% | 1 (0.1%) | 1.5% | 17.2% |
| Mixed | 1311 | 2.7% | 65.1% | 43.6% | 41.3% | 9.8% | 2.4% | 29.2% | 3 (0.2%) | 2.2% | 17.2% |
| Casual | 1397 | 2.1% | 60.3% | 40.0% | 38.4% | 8.6% | 2.7% | 27.1% | 3 (0.2%) | 1.9% | 18.8% |

The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->

## What this means for fun

**Caveats first.** Bots aren't people. These bots play with purpose when winning (otherwise every game "to the end"
runs to the safety cap). The minutes come from a model of how people use a clock, not from playtests:
- bank / 25 + 0.8 × increment a move, never under 2 s;
- a 2% chance of drifting off and missing an action.

The clock options are tuned to that model, so the first playtests should check it: real think times, real misses.

- **The lobby fits.** Medians are 24 (Fast), 31 (Normal) and 36 (Long) minutes, and every 90th percentile is under 40
  (the longest of 72 lobbies, 39.8). The phase-1 rules took about 98 minutes at their defaults. Each round's match
  now takes 6-12 minutes, and games run 26-36 moves a side.
- **To fit, the clocks are short and increment-heavy.** Eric's starting options (2+1, 4+2, 6+3) take about 29, 43 and
  61 minutes (medians of 12 lobbies each, same model). At 4+2 and 6+3 flags hardly decide anything (2% of Pairs
  boards, 8% of finals). **So the 20-40 minute target and few flags pull against each other:** thinking time is what
  makes a lobby long.
  - In Pairs and the final a side's clock runs until both pickers lock in, so a pair can't move much faster than its
    slower player. With a small increment its bank drains in any long game.
  - A missed action costs the whole ceiling.
  - That's why every option has at least 2 s of increment and the ceiling is 20 s, not 40. At 40 s, misses decided
    most finals on time in the tuning runs.
- **Flags decide a real share of games, more in the team rounds:**
  - Relay: 23% of boards on Fast, 6% on Normal, 1% on Long.
  - Pairs: 64%, 30% and 23%.
  - The final: 75%, 37.5% and 37.5%.

  Fast is a time scramble by design; on Normal and Long a final is lost on time about one time in three. If
  playtests find that anti-fun, the levers are, in order:
  - more increment in Pairs and the final than in Relay (two players must agree);
  - the blockers' side's clock running once both pickers have locked in (so blockers can't sit on the timer, and the
    pickers don't pay for waiting);
  - a shorter ceiling;
  - longer clocks, accepting a longer lobby.
- **Ties are common, and time settles them cleanly.** 30-43% of Relay matches and 29-38% of Pairs matches end level on
  points and go to the squad with more time left. The median gap is 14-18 s, and none of about 160 ties needed the
  coin. It rewards a squad that plays briskly, which suits a timed mode. Relay still clinches early in 24-35% of
  matches.
- **Armageddon is now rare.** No final in 72 lobbies was drawn (they end in mate or on time), so the Armageddon board
  is a safety net, not a regular feature.
- **The coin and the blocks.**
  - Pairs: the coin plays a clearly weaker pick (5+ points) on 8-9% of moves, and a real blunder (20+ points) on
    about 4%. That's lively but fair.
  - Blocks land on a pick on 60-72% of the final's moves and the active one on 38-49%. Bots that play with purpose
    all want the same best move, and blockers aim there. But only 9-11% of moves have the block force a clearly
    worse pick; most hits land on two picks that were as good as each other.
  - The mercy rules stay rare: blocks off on 2-3% of moves, a block cancelled before mate on 0.1-0.2%.
- **Missed actions:** about 2% of actions, and almost no seat goes to a bot.

### Tuning I recommend
1. **Ship these clocks** (Fast 1+2, Normal 1:45+2, Long 2+3) and the 20 s ceiling for the first playtests, and measure
   real think times, misses and lobby length. Retune with this script (`npm run sim:squads -- 8 10000 "<clocks>"`)
   once the model can be fitted to real data.
2. **For Eric: lobby length or flags.** If finals lost on time feel wrong, there are three ways out:
   - give Pairs and the final extra increment (about +1 s);
   - switch the clock to the blockers once both pickers lock in;
   - accept a longer lobby (4+2 is about 43 minutes, with few flags).

   Each changes what he asked for, so it's his call.
3. **Phase 2:** start each match as soon as its two feeder matches are done (the sim assumes it). It saves little on
   average (under a minute), but a squad never waits on a match it doesn't need.
