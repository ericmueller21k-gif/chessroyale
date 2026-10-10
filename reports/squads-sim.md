# Squads: bot simulation (phase 1)

108 full lobbies of 32 (8 squads of 4), 6 for every skill mix × Pace × Length (and 12 more for a tuning check), from
`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.
Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),
the final (Pick and Block), and an Armageddon board after any tie. Start votes rotate between the normal start,
one opening and random openings.

**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at
10,000 nodes, its top 8 moves) then `botPick` at the person's skill, a temperature over each move's loss:
Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. The rules never ask the engine (legal
moves and mate in one come from chess.js; a cap is decided by material). The engine also judges which of two
picks was better, for this report only.

**A person's clock and misses are assumptions** (there's no real Squads data yet): someone who acts uses a random
share of the clock (uniform 25%–100%), and misses an action with chance 4.0% at 10 s, 2.0% at 15 s, 1.0% at 25 s.
A half lasts as long as its slowest player (at most the clock), plus the show: 1 s for a Relay half's moves, 3 s for the pair's reveal, 4.5 s for the final's reveal.
The bracket waits for the slowest match of a round; 20 s between rounds, 33.6 s of votes before.

## How long a lobby takes

Minutes, averaged over the skill mixes (the bracket waits for each round's slowest match, Armageddon included).

| Length | Pace | Round 1 | Round 2 | Final | Total | Total, 90th pct | Longest | Total if every half ran the full clock |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40-move cap | 10 s | 21.4 | 26.9 | 31.5 | 81.1 | 106.9 | 107.0 | 93.8 |
| 40-move cap | 15 s | 24.7 | 34.3 | 37.6 | 97.7 | 124.3 | 133.6 | 114.1 |
| 40-move cap | 25 s | 37.9 | 42.6 | 61.8 | 143.5 | 188.8 | 190.7 | 167.9 |
| To the end | 10 s | 46.4 | 55.2 | 28.6 | 131.4 | 165.5 | 173.6 | 159.1 |
| To the end | 15 s | 62.1 | 65.2 | 43.5 | 172.0 | 210.7 | 233.4 | 208.9 |
| To the end | 25 s | 87.4 | 92.3 | 55.5 | 236.4 | 295.4 | 340.7 | 291.3 |

By skill mix (all paces):

| Length | Mix | Round 1 | Round 2 | Final | Total (at 10 s) | Total (at 15 s) | Total (at 25 s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 40-move cap | Strong | 26.8 | 32.2 | 45.1 | 84.5 | 95.4 | 136.2 |
| 40-move cap | Mixed | 28.5 | 35.2 | 48.4 | 75.8 | 108.9 | 155.0 |
| 40-move cap | Casual | 28.7 | 36.4 | 37.4 | 83.1 | 88.9 | 139.3 |
| To the end | Strong | 65.6 | 67.8 | 38.2 | 126.0 | 164.2 | 228.6 |
| To the end | Mixed | 63.8 | 75.1 | 46.3 | 131.1 | 177.7 | 250.6 |
| To the end | Casual | 66.4 | 69.8 | 43.0 | 137.2 | 174.2 | 229.9 |

## Game lengths in moves

Moves per side. A match's length is its longest board; boards left unfinished by a clinch count the moves they had.

| Length | Mix | R1 match | R1 board | R2 match | R2 board | Final | Final, 90th pct | Armageddon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40-move cap | Strong | 40.0 | 38.7 | 39.8 | 38.0 | 73.0 | 120.0 | 37.8 |
| 40-move cap | Mixed | 40.0 | 38.6 | 39.4 | 38.9 | 77.1 | 120.0 | 38.7 |
| 40-move cap | Casual | 40.0 | 38.8 | 39.9 | 38.6 | 61.3 | 120.0 | 39.1 |
| To the end | Strong | 95.1 | 67.6 | 82.9 | 67.0 | 62.9 | 108.0 | 66.4 |
| To the end | Mixed | 94.3 | 64.4 | 85.7 | 67.9 | 73.2 | 120.0 | 72.1 |
| To the end | Casual | 94.1 | 65.8 | 85.0 | 65.7 | 72.9 | 120.0 | 64.4 |

How boards end (all mixes and paces):

| Length | Round | Mate | Draw by the rules | Move cap (material) | Safety cap | Left unfinished (clinched) |
| --- | --- | --- | --- | --- | --- | --- |
| 40-move cap | Round 1 (Relay) | 15.0% | 0.6% | 84.4% | 0.0% | 0.0% |
| 40-move cap | Round 2 (Pairs) | 18.1% | 0.0% | 81.9% | 0.0% | 0.0% |
| 40-move cap | Final | 81.5% | 1.9% | 0.0% | 16.7% | 0.0% |
| To the end | Round 1 (Relay) | 77.8% | 3.9% | 0.0% | 11.0% | 7.3% |
| To the end | Round 2 (Pairs) | 83.3% | 2.3% | 0.0% | 14.4% | 0.0% |
| To the end | Final | 90.7% | 0.0% | 0.0% | 9.3% | 0.0% |

## Clinches and Armageddon

| Length | Mix | R1 clinched early | R1 tied → Armageddon | R2 tied → Armageddon | Final drawn → Armageddon | Armageddon won by Black | Minutes per Armageddon |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 40-move cap | Strong | 0.0% | 27.8% | 38.9% | 5.6% | 48.6% of 35 | 11.3 |
| 40-move cap | Mixed | 0.0% | 36.1% | 55.6% | 0.0% | 58.7% of 46 | 11.2 |
| 40-move cap | Casual | 0.0% | 31.9% | 77.8% | 0.0% | 47.1% of 51 | 11.9 |
| To the end | Strong | 30.6% | 33.3% | 47.2% | 0.0% | 48.8% of 41 | 18.9 |
| To the end | Mixed | 26.4% | 27.8% | 52.8% | 0.0% | 51.3% of 39 | 21.5 |
| To the end | Casual | 30.6% | 36.1% | 58.3% | 0.0% | 51.1% of 47 | 18.3 |

## Round 2: how often the coin plays the weaker pick

Per pair move (forced moves left out). "Weaker" is by the engine's expected score after each pick (1 point = 0.01).

| Mix | Pair moves | Picks 1+ point apart | Coin played the weaker pick (1+ point) | …weaker by 5+ points | …weaker by 20+ points | Moves with a missed slot |
| --- | --- | --- | --- | --- | --- | --- |
| Strong | 18139 | 21.8% | 10.9% | 6.2% | 3.4% | 4.6% |
| Mixed | 19505 | 22.5% | 11.2% | 6.7% | 3.5% | 4.5% |
| Casual | 19213 | 24.0% | 12.0% | 7.4% | 4.0% | 4.7% |

## The final: picks, blocks and the mercy rules

Per move of the final (and its Armageddon), forced moves left out.

| Mix | Moves | No blocks (3 or fewer legal moves) | A block hits a pick | Blocks that hit a pick | Active block hits a pick | …the better pick | …the worse pick | …picks level | Block cancelled (mate in one) | Forfeited blocks | The worse pick played (1+ point) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Strong | 4875 | 4.9% | 45.6% | 29.4% | 26.8% | 6.7% | 3.0% | 17.0% | 26 (0.5%) | 2.6% | 9.9% |
| Mixed | 5275 | 5.4% | 44.0% | 26.7% | 24.6% | 5.5% | 1.8% | 17.4% | 26 (0.5%) | 2.1% | 10.2% |
| Casual | 4723 | 5.3% | 41.9% | 24.8% | 23.0% | 4.8% | 2.2% | 15.9% | 24 (0.5%) | 2.2% | 11.3% |

## Tuning check: a 25-move cap

Mixed players, the cap at 25 moves for rounds 1 and 2 and their Armageddons (the final unchanged), against the 40-move cap above.

| Cap | Pace | Lobbies | Round 1 | Round 2 | Final | Total | Total, 90th pct | R1 tied | R2 tied | Boards decided by material (R1, R2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 moves | 10 s | 6 | 23.2 | 25.9 | 25.6 | 75.8 | 85.6 | 41.7% | 50.0% | 85.0% |
| 25 moves | 10 s | 6 | 12.3 | 15.7 | 35.4 | 64.7 | 81.7 | 16.7% | 41.7% | 96.7% |
| 40 moves | 15 s | 6 | 23.7 | 35.2 | 48.8 | 108.9 | 124.3 | 29.2% | 58.3% | 86.7% |
| 25 moves | 15 s | 6 | 15.7 | 20.9 | 41.8 | 79.6 | 105.0 | 20.8% | 50.0% | 97.5% |

## Missed actions

| Pace | Actions per lobby | Missed | Seats handed to a bot (3 misses in a row), per lobby |
| --- | --- | --- | --- |
| 10 s | 3403.9 | 3.9% | 0.4 |
| 15 s | 3402.2 | 2.0% | 0.0 |
| 25 s | 3397.7 | 1.1% | 0.0 |

(390156 actions in all.) The "what this means for fun" section is written by hand below this line.

<!-- squads-sim: end of generated tables -->
## What this means for fun

**Read the numbers with two caveats.** Bots aren't people. In a won position every top move scores about 1.0, so a
bot sees nothing to choose between them and wanders instead of mating. That inflates the "to the end" lengths and the
final's (9-17% of finals reach the 120-move safety cap), so real players will finish those sooner. The minutes come from
a model of a person's clock (above), not from playtests. The capped rounds, the coin and the blocks don't depend on
either caveat.

- **A lobby is too long.** At the defaults (15 s, the 40-move cap) a lobby takes about 98 minutes on average (124 at
  the 90th percentile), and "to the end" about 3 hours. Every round is long:
  - Relay's halves wait for the slowest of four players, so a turn costs about two clocks.
  - Round 2 ties half the time, which adds an Armageddon of about 11 minutes.
  - The final averages 60-77 moves at about 35 seconds a move.

  This is the main thing to fix before people play it.
- **The cap decides almost every game in rounds 1 and 2.** 82-84% of boards are settled by material at move 40, so
  matches never clinch early under the cap (all four boards reach it together); only "to the end" clinches (about 30%
  of Relay matches). That's fine, but it means the cap's length *is* the round's length.
- **Ties are common, and Armageddon is fair.** About a third of Relay matches tie at 2-2 and about half of Pairs
  matches at 1-1 (two boards, each squad White on one, so a split is the natural result). Black wins 47-59% of
  Armageddons, so choosing colours is a real decision, not a formality. Bots always take Black, which is fine.
- **The coin adds chaos without taking over.** In Pairs the coin plays the weaker pick on 11-12% of moves, a clearly
  weaker one (5+ points) on about 7%, and a real blunder (20+ points) on 3.5-4%, partly from missed slots. That's
  about two or three coin blunders a board per game: enough to cheer or groan, not enough to make skill pointless.
- **Blocks bite, but rarely decide.** A block lands on a pick on 42-46% of the final's moves and the active one on
  about a quarter. It forces the worse pick only about 1 move in 16 (5-7%); most hits land on two picks that were as
  good as each other. Live red arrows let pickers dodge (the bots dodge half the time; people will dodge more). So
  blocks mostly push pickers off their first choice, which is the tension Eric wanted, without making the final a
  lottery. If playtests find blocks toothless, the visibility setting (blocks hidden until the reveal) is the lever.
- **The mercy rules are safety valves.** Blocks are off on about 5% of moves (3 or fewer legal moves), and a block is
  cancelled before a mate in one on 0.5% of moves (about one final in two sees one). Neither changes how the final
  feels; keep both.
- **Missed actions behave.** With the assumed miss rates, about 0.4 seats a lobby go to a bot at 10 s and almost none
  at slower paces.

### Tuning I recommend

1. **Move cap 40 → 25** for rounds 1 and 2 (the 40 was a director's call, so this is ours to change). The check
   above (Mixed players) shows it cuts 11 minutes at 10 s (76 → 65) and 29 at 15 s (109 → 80), and makes Relay ties
   rarer (about 35% → 19% over both paces; small samples). The cost is even more boards decided by material (97%).
   `SQUADS.moveCap`.
2. **A shorter Armageddon:** about 20 moves at 10 s, then material (a level count is Black's). Armageddon is common
   enough (about half of round 2) that its length matters. This would need a new `armageddonCap` setting.
3. **For Eric: the final.** It's now the long pole (35-48 minutes, more than rounds 1 and 2 together with the shorter
   cap). Options, in order of how much they change his design:
   - lower the silent safety cap from 120 to 80 moves (`SQUADS.safetyCap`; a director's call);
   - give the final its own cap (say 60 moves, then material), which reverses his "always to the end".
   Playtests first: real players mate faster than these bots.
4. **For Eric: round 2's ties.** Half of Pairs matches go to Armageddon. Before Armageddon, a 1-1 could first go to
   the material count across both boards (still no engine). That's a rule change, so it's his call; with
   recommendation 2 it matters less.
5. **Default pace:** keep 15 s as the no-vote default for now. 10 s saves about 15 minutes a lobby but doubles the
   assumed misses; real miss rates from playtests should decide it.
