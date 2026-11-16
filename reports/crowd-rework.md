# 50 v 50 rework: pick modes, cuts to a 1 v 1, the soft reset, RP (sim, Nov 16, 2026)

Written by `npx tsx packages/sim/scripts/crowd-rework-sim.ts summary` from `reports/crowd-rework/*.jsonl` (branch
`design/crowd-rework`; none of these rules is in the game). **How:** 100 bots of known rating on one board, 50 a side, real
chess judged by Stockfish 19 lite at 50k nodes (the top 8 lines; a pick off them scored on its own). Bots pick as the
game's 50 v 50 bots do (BOT_LOBBY's temperature for their rating, the team turn's shared lean, `botPickSpread`, a random legal
move 2% of the time). Each lobby seats 6 probe players (2 each at 1900, 1200 and 700) among 94 from its curve: **mixed** uniform
600-2200, **strong** N(1750, 150), **weak** N(850, 150). The live games cut by schedule B with 50% carried (who is still in picks
the played move). Every seat's loss on every one of its team's moves is kept, cut or not, so each schedule, carry and tie band
below is **replayed on the same games** (paired; the played moves stay the live ones). A round score is the team's average
counted loss less yours (counted: after the opening allowance), summed over the round; 50 v 50's soft cap, streaks, rare finds
and shared relief are left out. Cuts leave 34, 23, 15, 10, 6, 4, 2, 1 a side; **A**: after moves 10, 14, 18, 22, 26, 30, 34, 38; **B**: after 14, 18, 22, 26, 30, 33, 36, 39;
**C** (the 4 v 4 three moves longer, the 1 v 1 three shorter): after 14, 18, 22, 26, 30, 33, 39, 42. The live games cut by B, so under C a 2 v 2's
moves 40-42 were played by one bot a side (the played moves stay the live ones).
A game still going after move 60 is a draw. Strong's "close": within 0.03 expected score of the best of the top 3.

Matches: 360 (strong 120, majority 120, chaos 120). Median 13 s a match on one core.

## 1. The game by pick mode (live games)

| Pick mode | Lobby | Matches | Over before the 1 v 1 | Draw at move 60 | Mate | Other draw | Median end (move), 10th-90th | Played move's mean loss | Played moves giving 25+ a game |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| strong | mixed | 40 | 10% | 48% | 48% | 5% | 58 (40-60) | 0.8 | 0.3 |
| strong | strong | 40 | 3% | 70% | 30% | 0% | 60 (48-60) | 0.9 | 0.2 |
| strong | weak | 40 | 3% | 60% | 40% | 0% | 60 (49-60) | 0.9 | 0.5 |
| majority | mixed | 40 | 15% | 53% | 48% | 0% | 60 (39-60) | 1.5 | 0.2 |
| majority | strong | 40 | 3% | 60% | 40% | 0% | 60 (46-60) | 1.6 | 0.2 |
| majority | weak | 40 | 13% | 53% | 48% | 0% | 60 (38-60) | 1.7 | 0.4 |
| chaos | mixed | 40 | 13% | 55% | 45% | 0% | 60 (37-60) | 4.4 | 6.0 |
| chaos | strong | 40 | 8% | 33% | 68% | 0% | 56 (43-60) | 3.2 | 4.0 |
| chaos | weak | 40 | 3% | 38% | 63% | 0% | 54 (45-60) | 4.4 | 6.6 |

**At the move limit, the judge's verdict** (134 games that reached it, from the second batch, which recorded it): one side at
75%+ expected score in 89%, 90%+ in 87%; within 60-40 in 11%.

**How long the late stages last** (moves actually played in each, all live games; a game over sooner plays fewer):

| Schedule | Stages (moves each, 50 v 50 down) | Reach the 4 v 4 | 4 v 4 moves (median) | Reach the 1 v 1 | 1 v 1 moves (median, 10th-90th) |
| --- | --- | --- | --- | --- | --- |
| B | 14, 4, 4, 4, 4, 3, 3, 3, then the 1 v 1 to move 60 (21) | 96% | 3 of 3 | 93% | 21 (7-21) of 21 |
| C | 14, 4, 4, 4, 4, 3, 6, 3, then the 1 v 1 to move 60 (18) | 96% | 6 of 6 | 89% | 18 (6-18) of 18 |

## 2. The cut's luck: schedule and carry (pick modes pooled)

**Rank corr.**: Spearman's rho of true rating and finish, per match, averaged (1: the field finishes in order of strength).
**Top 5 in**: the lobby's five highest-rated, the share still in when the game ends. **Strongest 1st / top 3**: the highest-rated
player. **1800+ over 900-**: in the mixed lobby, how often a player rated 1800+ finishes above one rated 900 or less. **Tied lines**: a
cut whose line fell between two exactly level scores (decided by the tie-break). **Cut with a random move**: of those cut, the
share who played the bots' 2% random move that round (luck no real player has in that form). Carry 100% is today's rule (scores
carry all game) for comparison.

| Lobby | Schedule | Carry | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- | Tied lines | Cut with a random move |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mixed | A | 0% | 0.27 | 7% | 2% / 5% | 70% | 72% | 23% |
| mixed | A | 25% | 0.27 | 5% | 1% / 6% | 70% | 31% | 23% |
| mixed | A | 50% | 0.27 | 5% | 1% / 5% | 70% | 32% | 23% |
| mixed | A | 75% | 0.28 | 5% | 1% / 5% | 71% | 31% | 23% |
| mixed | A | 100% | 0.28 | 5% | 2% / 5% | 71% | 33% | 22% |
| mixed | B | 0% | 0.31 | 7% | 1% / 5% | 73% | 71% | 25% |
| mixed | B | 25% | 0.31 | 7% | 2% / 5% | 73% | 24% | 25% |
| mixed | B | 50% | 0.32 | 6% | 2% / 5% | 73% | 25% | 25% |
| mixed | B | 75% | 0.32 | 6% | 1% / 6% | 74% | 24% | 25% |
| mixed | B | 100% | 0.32 | 6% | 2% / 6% | 74% | 26% | 25% |
| mixed | C | 0% | 0.31 | 8% | 1% / 7% | 73% | 71% | 25% |
| mixed | C | 25% | 0.31 | 7% | 2% / 6% | 73% | 24% | 25% |
| mixed | C | 50% | 0.32 | 6% | 1% / 5% | 73% | 25% | 25% |
| mixed | C | 75% | 0.32 | 6% | 1% / 5% | 74% | 24% | 25% |
| mixed | C | 100% | 0.32 | 6% | 2% / 5% | 74% | 26% | 25% |
| strong | A | 0% | 0.09 | 3% | 1% / 4% | - | 68% | 23% |
| strong | A | 25% | 0.09 | 4% | 1% / 4% | - | 30% | 23% |
| strong | A | 50% | 0.09 | 4% | 0% / 3% | - | 31% | 23% |
| strong | A | 75% | 0.09 | 4% | 0% / 3% | - | 31% | 23% |
| strong | A | 100% | 0.09 | 4% | 0% / 3% | - | 33% | 23% |
| strong | B | 0% | 0.10 | 5% | 1% / 5% | - | 70% | 26% |
| strong | B | 25% | 0.10 | 4% | 1% / 3% | - | 25% | 26% |
| strong | B | 50% | 0.10 | 4% | 1% / 4% | - | 25% | 26% |
| strong | B | 75% | 0.10 | 4% | 1% / 4% | - | 25% | 26% |
| strong | B | 100% | 0.10 | 3% | 0% / 3% | - | 26% | 26% |
| strong | C | 0% | 0.10 | 4% | 1% / 5% | - | 70% | 27% |
| strong | C | 25% | 0.10 | 5% | 1% / 3% | - | 25% | 27% |
| strong | C | 50% | 0.10 | 5% | 1% / 4% | - | 25% | 27% |
| strong | C | 75% | 0.10 | 4% | 1% / 4% | - | 25% | 27% |
| strong | C | 100% | 0.10 | 3% | 0% / 3% | - | 26% | 26% |
| weak | A | 0% | 0.12 | 6% | 5% / 12% | - | 62% | 21% |
| weak | A | 25% | 0.13 | 6% | 4% / 13% | - | 24% | 21% |
| weak | A | 50% | 0.13 | 6% | 4% / 13% | - | 25% | 21% |
| weak | A | 75% | 0.13 | 8% | 7% / 15% | - | 24% | 21% |
| weak | A | 100% | 0.13 | 8% | 7% / 13% | - | 25% | 21% |
| weak | B | 0% | 0.15 | 6% | 7% / 12% | - | 63% | 23% |
| weak | B | 25% | 0.15 | 8% | 4% / 13% | - | 18% | 23% |
| weak | B | 50% | 0.15 | 7% | 6% / 13% | - | 18% | 23% |
| weak | B | 75% | 0.16 | 8% | 7% / 15% | - | 18% | 23% |
| weak | B | 100% | 0.16 | 8% | 7% / 15% | - | 19% | 22% |
| weak | C | 0% | 0.15 | 7% | 6% / 12% | - | 63% | 23% |
| weak | C | 25% | 0.15 | 7% | 4% / 12% | - | 17% | 23% |
| weak | C | 50% | 0.15 | 7% | 5% / 11% | - | 18% | 23% |
| weak | C | 75% | 0.16 | 9% | 6% / 14% | - | 18% | 23% |
| weak | C | 100% | 0.16 | 9% | 7% / 15% | - | 19% | 23% |

By pick mode (schedule C, carry 50%):

| Pick mode | Lobby | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- |
| --- | --- | --- | --- | --- | --- |
| strong | mixed | 0.35 | 5% | 0% / 8% | 75% |
| strong | strong | 0.11 | 3% | 0% / 5% | - |
| strong | weak | 0.19 | 7% | 6% / 11% | - |
| majority | mixed | 0.31 | 7% | 2% / 2% | 74% |
| majority | strong | 0.13 | 5% | 2% / 5% | - |
| majority | weak | 0.14 | 9% | 5% / 11% | - |
| chaos | mixed | 0.29 | 6% | 1% / 3% | 72% |
| chaos | strong | 0.06 | 6% | 0% / 1% | - |
| chaos | weak | 0.13 | 6% | 3% / 11% | - |

**How much of this is the bots?** The same games, schedule C, read two other ways: `norandom` (the bots' 2% random moves count as no
loss) and `wider` (each seat's losses scaled by 2^((1150 − rating) / 600): ×1.7 at 700, ×0.4 at 1900, as if real players' strength
showed about four times more than the bots'; a sensitivity check, not a model of people).

| Lobby | Reading | Carry | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- |
| --- | --- | --- | --- | --- | --- | --- |
| mixed | norandom | 0% | 0.35 | 7% | 2% / 7% | 76% |
| mixed | norandom | 50% | 0.36 | 6% | 2% / 6% | 76% |
| mixed | norandom | 100% | 0.36 | 6% | 2% / 6% | 76% |
| mixed | wider | 0% | 0.78 | 26% | 12% / 31% | 97% |
| mixed | wider | 50% | 0.79 | 21% | 5% / 20% | 97% |
| mixed | wider | 100% | 0.79 | 21% | 8% / 24% | 97% |
| strong | norandom | 0% | 0.11 | 5% | 2% / 5% | - |
| strong | norandom | 50% | 0.11 | 5% | 0% / 4% | - |
| strong | norandom | 100% | 0.12 | 5% | 3% / 5% | - |
| strong | wider | 0% | 0.52 | 18% | 7% / 25% | - |
| strong | wider | 50% | 0.50 | 14% | 7% / 20% | - |
| strong | wider | 100% | 0.50 | 15% | 9% / 23% | - |
| weak | norandom | 0% | 0.16 | 9% | 8% / 15% | - |
| weak | norandom | 50% | 0.17 | 9% | 5% / 15% | - |
| weak | norandom | 100% | 0.17 | 11% | 7% / 14% | - |
| weak | wider | 0% | 0.51 | 30% | 34% / 70% | - |
| weak | wider | 50% | 0.50 | 30% | 25% / 67% | - |
| weak | wider | 100% | 0.50 | 31% | 27% / 74% | - |

**An engine-best player** (one White seat that never gives anything away; Eric, Nov 1: it "should finish 1st or 2nd"), schedule C,
carry 50%, all lobbies and modes: still in at the end 100%, 1st or 2nd 98%, median place 1
(its game result is the live one, so a 1 v 1 it would have won may read as a draw).

What a move gives away, by rating (all seats, all moves, counted after the allowance; the spread a cut has to see through):

| Rating | Moves | Mean counted loss a move | Its sd | Moves giving 25+ |
| --- | --- | --- | --- | --- |
| 600-800 | 437883 | 2.3 | 9.3 | 3% |
| 900-1100 | 405528 | 2.0 | 8.2 | 2% |
| 1200-1400 | 181305 | 1.5 | 6.4 | 1% |
| 1500-1700 | 406297 | 1.3 | 5.7 | 1% |
| 1800-2000 | 445388 | 1.2 | 5.4 | 1% |
| 2100-2200 | 68999 | 1.1 | 5.3 | 1% |

## 3. Winner and best player (schedule C, carry 50%)

Winner: 1st place of a decided game (a draw has none). Best: the lowest counted loss a move among those who survived at least half the cuts made.

| Lobby | Decided games | Winner's rating (median) | Best player's rating (median) | Best = winner | Best on the podium (top 3) | Best's place (median) |
| --- | --- | --- | --- | --- | --- | --- |
| mixed | 56 of 120 | 1700 | 1800 | 55% | 68% | 2 |
| strong | 55 of 120 | 1800 | 1800 | 51% | 70% | 2 |
| weak | 60 of 120 | 900 | 1000 | 35% | 73% | 2 |

## 4. RP per match

Glicko-1 expected vs actual against the other 99 (all settled, RD 60), RP = 40 × (S − E), no catch-up (mode-ranks.md's rule). A pair
split by a cut scores ½ when their relative scores at that cut were within the **tie band** (points). The gap between the last one
through and the first one out at a cut (schedule C, carry 50%): median 0.16, 10th 0.00, 90th 3.60 points.

Mean RP (10th to 90th) for the probe players, by tie band (schedule C, carry 50%):

| Lobby | Tie band | Strong (1900) | Average (1200) | Weak (700) | Pairs split by a cut that become draws |
| --- | --- | --- | --- | --- | --- |
| mixed | 0 | -8.0 (-25.1 to 5.5) | +2.5 (-11.7 to 19.0) | +10.3 (-2.3 to 27.5) | - |
| mixed | 0.5 | -8.0 (-25.1 to 5.0) | +2.6 (-11.7 to 17.7) | +10.2 (-2.3 to 26.4) | 6% |
| mixed | 1 | -8.0 (-25.1 to 4.4) | +2.5 (-11.7 to 17.4) | +10.2 (-2.3 to 25.9) | 9% |
| mixed | 2 | -7.9 (-24.3 to 3.6) | +2.6 (-11.7 to 16.8) | +10.3 (-2.3 to 24.9) | 14% |
| mixed | 4 | -7.8 (-23.0 to 2.3) | +2.6 (-11.7 to 16.4) | +10.4 (-2.3 to 23.7) | 22% |
| strong | 0 | -5.4 (-23.1 to 9.6) | +12.8 (-0.6 to 29.1) | +12.5 (0.4 to 26.3) | - |
| strong | 0.5 | -5.5 (-23.1 to 8.8) | +12.9 (-0.6 to 29.1) | +12.6 (0.4 to 27.1) | 7% |
| strong | 1 | -5.4 (-23.1 to 8.3) | +12.9 (-0.6 to 28.9) | +12.6 (0.4 to 26.5) | 11% |
| strong | 2 | -5.6 (-23.1 to 8.0) | +13.0 (-0.6 to 27.9) | +12.8 (0.4 to 26.3) | 17% |
| strong | 4 | -5.8 (-23.1 to 6.6) | +13.1 (-0.6 to 26.6) | +12.8 (0.4 to 25.9) | 27% |
| weak | 0 | -10.6 (-29.6 to -0.4) | -8.0 (-25.6 to 5.0) | +6.4 (-10.2 to 23.0) | - |
| weak | 0.5 | -10.6 (-28.7 to -0.8) | -8.1 (-25.6 to 4.5) | +6.5 (-10.2 to 22.6) | 4% |
| weak | 1 | -10.6 (-28.1 to -0.8) | -8.1 (-25.6 to 4.6) | +6.4 (-10.2 to 22.5) | 5% |
| weak | 2 | -10.7 (-26.9 to -1.1) | -8.1 (-25.2 to 4.2) | +6.4 (-10.2 to 21.9) | 8% |
| weak | 4 | -10.9 (-25.9 to -1.5) | -8.2 (-25.2 to 3.8) | +6.4 (-10.2 to 21.2) | 14% |

By carry (schedule C, tie band 1); the last column: RP's spread over the whole field (sd):

| Lobby | Carry | Strong (1900) | Average (1200) | Weak (700) | Field sd |
| --- | --- | --- | --- | --- | --- |
| mixed | 0% | -8.2 (-25.1 to 2.0) | +2.6 (-11.7 to 17.0) | +10.6 (-2.3 to 25.5) | 12.6 |
| mixed | 25% | -8.1 (-25.1 to 3.4) | +2.4 (-11.7 to 17.1) | +10.4 (-2.3 to 25.5) | 12.6 |
| mixed | 50% | -8.0 (-25.1 to 4.4) | +2.5 (-11.7 to 17.4) | +10.2 (-2.3 to 25.9) | 12.7 |
| mixed | 75% | -7.9 (-25.1 to 4.6) | +2.6 (-11.7 to 17.6) | +10.1 (-2.3 to 25.1) | 12.8 |
| mixed | 100% | -8.0 (-25.1 to 4.6) | +2.6 (-11.7 to 19.0) | +10.1 (-2.3 to 25.6) | 12.8 |
| strong | 0% | -5.9 (-23.1 to 6.9) | +13.2 (-0.6 to 27.6) | +12.9 (0.4 to 27.1) | 12.4 |
| strong | 25% | -5.5 (-23.1 to 8.1) | +13.1 (-0.6 to 28.6) | +12.7 (0.4 to 26.9) | 12.5 |
| strong | 50% | -5.4 (-23.1 to 8.3) | +12.9 (-0.6 to 28.9) | +12.6 (0.4 to 26.5) | 12.6 |
| strong | 75% | -5.4 (-23.1 to 8.2) | +12.7 (-0.6 to 28.4) | +12.6 (0.4 to 26.1) | 12.7 |
| strong | 100% | -5.5 (-23.1 to 8.5) | +12.7 (-0.6 to 28.8) | +12.4 (0.4 to 25.9) | 12.7 |
| weak | 0% | -11.7 (-28.1 to -2.5) | -9.0 (-25.6 to 2.6) | +6.5 (-10.2 to 20.3) | 12.2 |
| weak | 25% | -10.9 (-28.1 to -1.5) | -8.3 (-25.6 to 3.9) | +6.5 (-10.2 to 22.1) | 12.4 |
| weak | 50% | -10.6 (-28.1 to -0.8) | -8.1 (-25.6 to 4.6) | +6.4 (-10.2 to 22.5) | 12.4 |
| weak | 75% | -10.5 (-28.1 to -0.5) | -7.9 (-25.6 to 4.9) | +6.5 (-10.2 to 22.9) | 12.5 |
| weak | 100% | -10.4 (-28.1 to -0.4) | -7.9 (-25.6 to 5.7) | +6.5 (-10.2 to 23.3) | 12.5 |

The probes' RP if strength showed more (the `wider` reading of section 2; schedule C, carry 50%, tie band 1):

| Lobby | Strong (1900) | Average (1200) | Weak (700) |
| --- | --- | --- | --- |
| mixed | -1.8 (-10.5 to 4.8) | +0.6 (-9.6 to 9.7) | +2.1 (-3.8 to 9.1) |
| strong | -2.5 (-18.8 to 9.0) | +4.2 (-2.6 to 15.0) | +1.6 (-0.4 to 5.6) |
| weak | -2.1 (-4.5 to 0.2) | -2.0 (-13.8 to 5.5) | +2.3 (-10.8 to 18.0) |
