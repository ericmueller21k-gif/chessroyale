# 50 v 50 scoring: a soft cap that widens by stage, streaks, shared-blunder relief, rare shoutouts, bubble grace (Oct 24, 2026)

Eric (Oct 23): "The damper on points early feels much better... blunders that leave pieces hanging still get punished
hard... after say 8-10 moves on each side you see most players between like -10 and +10... then the next rounds
progressively dampen less... [streaks:] a bonus point or half point for continuing to play strong moves within a certain
engine range and it shows each player's current streak on the scoreboard... [brilliant:] giving points and a shoutout...
if say 3 or fewer people found them or 1 person if there's like say 10 or fewer peeps left... it should be a rare
occurrence... if several players or more or a relative % of those left blunder the same move, it should dampen the hit...
with a slight elimination grace when scores are super close in the bubble." Then: "Maybe each move should be between -5
and 5? Is this something we can test?" and "After tiger, your call on everything, testing will tell us best." Maia as
the main test player.

How it works now: [crowd.md](../areas/crowd.md), "50 v 50's scoring". The sim: [reports/crowd-scoring.md](../../reports/crowd-scoring.md).

## What was built (every number in `CROWD_SCORING`, settings.ts; on in `CROWD_SETTINGS`, off in raids and Classic)

A pick's round score starts as before (the group's average counted loss less its own; the opening allowance and its
material fallback unchanged). Then, in this order:

1. **Shared-blunder relief.** A losing pick (counted loss `sharedFrom` 5 or more) made by `sharedMin` 3 or more of the
   team, or by `sharedShare` 25% of it, counts its loss × (1 − `sharedK` × its share), never below `sharedFloor` 40%
   (`sharedFactor`). The group's average is taken over these relieved losses.
2. **The soft cap, widening by stage.** `softCap(x, cap, capCurve)`: ±2 before the first cut, ±3.5 from cut 1, ±5 from
   cut 5, ±8 from cut 9 and in the endings (`cap`, `capFrom` by the match's stage), on the **ratio** curve
   x / (1 + |x| / cap).
3. **A piece hung isn't capped.** A pick that gives up `uncapPawns` 3 (a piece) or more of material against the best
   move by the exchange check keeps a minus score whole (`uncap`, marked by the runner's `allowanceFor` all game).
4. **Streaks.** A strong move is within `streakStrong` 2 points of the engine's best (its raw loss). From `streakFrom` 3 in
   a row each strong move adds `streakBonus` +0.25, +0.5, +0.75, then +1 from 6 in a row on (ramp ii), after the cap. Any
   other pick or a miss ends it. Streaks count from the `streakFromMove` 6th picked move on the usual start, from the
   first in Random opening and Freestyle (picked moves count from the board's dealt opening: `openingPlies`, never the
   game's move number).
5. **A miss** scores `missCaps` 2 × the stage's cap below zero (−4 before the first cut; `missedMoveScore` with no cap).
6. **2 decimals.** Every round score is rounded to 0.01 (`round2`) and shown to 2 decimals in 50 v 50 (`scoreDp`).
7. **Rare brilliant finds** (`crowdBrilliant`, once power-ups are marked): `brilliance` with the rest giving away
   `brilliantMinGap` 35 points or more, found by `brilliantMaxFound` 3 or fewer (exactly one when `brilliantFewLeft` 10 or
   fewer picked): +`brilliantBonus` 1 to each finder and a shoutout naming them. It never changes the move played.
8. **The bubble grace.** At a cut (not the last before the ending) anyone within `cutGrace` 0.1 of the last player
   through goes through like an exact tie; what that leaves over is owed by the cuts to come (`cutCarry`), so the endings
   keep their sizes.
9. **The scoreboard's fire** (`StreakFire`): our own inline flame and the count, a badge on the rank square's corner from
   3 in a row; orange 3-4, a hotter red 5-6, a white-blue core 7+; a gentle flicker on the flame only, still under reduced
   motion. It was first drawn beside the name, which left one letter of each name in the full leaderboard at 320 px; on
   the rank square (the rank moved left to make room, the badge reaching only into the gap beside it) every name keeps
   the room it had before this change, measured at 320, 360, 390, 428 and 1280 px, and the points columns kept their
   widths (2 decimals fit them). The header's number labels now sit right, over their numbers, so a narrow name column
   no longer reads "PLAYERPTS".

## The sim (the deciding evidence)

`crowd-scoring-trace.ts` recorded **118 Crowd 50 v 50 matches of Maia players** (100 a match, ratings drawn evenly from
1100 to 1900, each pick sampled from Maia's own probabilities at its rating) and **40 of the game's bots** for
comparison, every pick judged as the runner judges (top moves, then every other pick, 150k nodes), the exchange check on
every distinct pick, the popular pick played. `crowd-scoring-sim.ts` re-scores every match under today's scoring and
each variant through the game's own core code (scoreGroup, crowdBrilliant, applyRound, endStage). Each number below is
the mean ± its standard error over the matches.

Two simplifications, the same for every variant: every player keeps picking after a cut and the move played is the
popular pick of all 50 (so the games are identical across variants: common random numbers); and a game the judge calls
decided (5% or 95% for two plies) starts again from the start, as a game that ended does, because in a decided game every
pick of the losing side scores 0 under any scoring and later cuts would only measure ties. Real decided games will make
more exact ties than the sim shows.

Maia, the main test (selected rows; every row and the bots' table are in the report):

| Scoring | in ±10 after 10 moves | ties at the line / cut / team | near ties (0.1) | bottom 5% at move 5 → through cut 1 | → final | top band (1900s) wins | rank corr | streak share of the final 8's points | shoutouts / match | piece-hanger's place after 10 (0 top, 1 bottom) | hangers cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today | 27 ± 1% | 0.25 ± 0.03 | 0.29 ± 0.03 | 27 ± 2% | 0.3 ± 0.2% | 28 ± 4% | 0.32 ± 0.01 | — | — | 0.65 ± 0.01 | 97 ± 1% |
| A ±2/3.5/5/8, tanh, ramp ii | 78 ± 1% | 0.32 ± 0.03 | 0.59 ± 0.04 | 45 ± 2% | 1.0 ± 0.4% | 31 ± 4% | 0.33 ± 0.01 | 8 ± 1% | 0.46 ± 0.07 | 0.86 ± 0.01 | 100% |
| B ±3/5/8/none, tanh, ramp ii | 65 ± 1% | 0.25 ± 0.03 | 0.48 ± 0.04 | 42 ± 2% | 1.2 ± 0.5% | 30 ± 4% | 0.33 ± 0.01 | 6 ± 0% | 0.46 ± 0.07 | 0.83 ± 0.01 | 99% |
| C ±5 flat, tanh, ramp ii | 53 ± 1% | 0.18 ± 0.02 | 0.38 ± 0.03 | 41 ± 2% | 0.7 ± 0.4% | 32 ± 4% | 0.34 ± 0.01 | 6 ± 0% | 0.47 ± 0.07 | 0.79 ± 0.01 | 99% |
| A, ratio, ramp i | 89 ± 1% | 0.15 ± 0.02 | 0.42 ± 0.03 | 48 ± 2% | 1.5 ± 0.5% | 34 ± 4% | 0.34 ± 0.01 | 18 ± 1% | 0.47 ± 0.07 | 0.88 | 100% |
| **A, ratio, ramp ii (chosen)** | **92 ± 0%** | **0.14 ± 0.02** | **0.43 ± 0.03** | **45 ± 2%** | **0.8 ± 0.4%** | **28 ± 4%** | **0.34 ± 0.01** | **10 ± 1%** | **0.46 ± 0.07** | **0.88** | **100%** |
| A, ratio, ramp iii | 92 ± 0% | 0.15 ± 0.02 | 0.44 ± 0.03 | 44 ± 2% | 1.2 ± 0.4% | 28 ± 4% | 0.34 ± 0.01 | 9 ± 1% | 0.45 ± 0.07 | 0.88 | 100% |
| B, ratio, ramp ii | 82 ± 1% | 0.15 ± 0.02 | 0.37 ± 0.03 | 43 ± 2% | 0.8 ± 0.4% | 30 ± 4% | 0.34 ± 0.01 | 7 ± 1% | 0.48 ± 0.07 | 0.85 | 100% |
| C, ratio, ramp ii | 69 ± 1% | 0.15 ± 0.02 | 0.34 ± 0.02 | 41 ± 2% | 0.7 ± 0.4% | 34 ± 4% | 0.34 ± 0.01 | 8 ± 1% | 0.48 ± 0.07 | 0.82 | 99% |

The tuning sweeps on the chosen scoring: shared relief k 0 / 0.5 / 1: ties 0.16 / 0.15 / 0.14, near ties 0.50 / 0.47 /
0.43, nothing else moves. Strong move within 1 / 2 / 4 points: streak share 7 / 10 / 13%. Bubble grace 0 / 0.05 / 0.1 /
0.25: saves 0 / 0.17 / 0.29 / 0.74 per team per cut. Uncapped from 1 pawn of material instead of 3: 71% in ±10, the
spread 19 (a pawn's slip is common and isn't "a piece hanging"), rank corr 0.27. Shoutout gap 8 / 15 / 25 / 35 / 50:
1.50 / 0.96 / 0.67 / 0.46 / 0.07 a match. Streaks only from the first cut: share 5%.

The bots' comparison (40 matches) agrees on the cap and curve (chosen: 96% in ±10, rank corr 0.74 against today's 0.66,
the strongest band's wins 53 ± 8% against 60 ± 8%), but bots earn far more from streaks (51% of the final 8's points;
max streak 15): the game's bots pick from the engine's top moves at a low temperature, so nearly every move of the
strong ones is within 2 points. No brilliant finds (bots never split the field that far).

## The calls made here, and why

- **Cap A (±2 / ±3.5 / ±5 / ±8), on the ratio curve.** Every schedule kept the strongest players winning as often as today
  (the 1900s top the final 8 in 28-34 ± 4% of matches against 28 ± 4% today; rank correlation 0.33-0.34 against 0.32), so
  the targets decide. A is the only schedule that puts most players inside −10..+10 after 10 moves on either curve
  (tanh 78%, ratio 92%; B 65/82%, C 53/69%). The **ratio** curve beats tanh on the other target, ties: a tanh cap
  flattens within a few points (any miss past about 6 points reads −2.00 to 2 decimals), so big misses all tie and the
  line fills with them (0.32 exact ties a cut against 0.25 today); the ratio curve keeps a bigger miss a little worse all
  the way, which halves the ties (0.14) while squeezing as hard. It also answers Eric's worry that a ±2 range makes
  everyone "too close than what the numbers reflect": the order of moves is never lost, and the range widens to ±8.
  Eric's "−5 → −2, −4 to −1 → −1" reads closer to tanh; the ratio curve is softer in the middle (−5 → −1.43 at ±2), which
  the sim says costs nothing.
- **Streak ramp ii, Eric's** (+0.25 at 3, +0.25 a move, +1 from 6). It lands at 10 ± 1% of the top players' points, in
  the 10-20% target, with no snowball (rank correlation unchanged, longest streak 8.4 on average). Ramp i (+1 at 3) makes
  18% and gives a stage-1 move worth at most about ±1.5 a full +1 on top: the "+1 too much early" case. Streaks from the
  first cut only were tested (5%) and not needed, since the ramp starts small.
- **Strong = raw loss within 2 points** ("one of the engine's best few"), not the counted loss: the opening allowance
  forgives up to 8 points through move 10, so counted would call nearly every opening move strong.
- **`sharedK` 1** (with the floor at 40%): the relief changes no ranking metric, so it's set where it's clearly forgiving
  ("everyone fell for it" costs each about half when half the team made it) and trims ties a little.
- **The cap's exemption is for a piece** (`uncapPawns` 3), not the allowance's pawn: Eric's words are "pieces hanging",
  the exchange check's one-pawn bar flags many ordinary moves in the opening, and uncapping those undid the squeeze (71% in
  ±10, rank correlation 0.27). A piece hung still costs: hangers sit at 0.88 of the field after 10 moves (0.65 today) and
  all of them are cut before the final.
- **A miss** is 2 × the cap below zero (was −25 flat, which would outweigh a dozen moves under a ±2 cap): never better
  than the worst capped pick, and a streak ends.
- **The shoutout's gap is 35 points** (the rest gave away 35 on average), with Eric's 3-or-fewer / exactly-one rule: about
  one every two matches (0.46 ± 0.07), "rare, celebrated". At brilliance's own 8 it was 1.5 a match.
- **Bubble grace 0.1.** At 2 decimals, 0.1 is "super close"; it saves 0.29 ± 0.02 players per team per cut (about one
  every two cuts per team), what it saves is owed by later cuts, and the endings keep their sizes. Teams can be one or
  two apart for a few cuts (each team owes its own), never at the ending.
- **Comebacks.** The brief's "bottom 5% after stage 1 reaching the final" is 0% under every scoring, today's included: the
  first cut comes straight after stage 1 and takes the bottom 16. So the sim also measures the bottom 5% after 5 moves a
  side: under the new scoring 45 ± 2% of them make it through the first cut (27 ± 2% today), and 0.8 ± 0.4% reach the
  final (0.3 ± 0.2% today): possible, not common.
- **Where it applies.** Crowd 50 v 50 only (its finals and the Hidden Boss's battle included: the cap there is the last
  stage's ±8). A raid sets `crowdScoring: undefined`; Classic never had it.
- **The scoreboard keeps its dark tower in both themes**, so the fire's colors are set once; the reveal's "+0.50 streak
  bonus" line gets a deeper count color in light mode. The scoreboard's existing 🔥 beside the top-rated Elo is a separate
  feature and stays.
- **In 50 v 50 the old "Brilliant move: … · only N of M found it" line gives way to the shoutout** (only rare finds get a
  line now); raids keep it. Profiles still count every brilliant move as before.

## Tests

Unit `packages/core/test/crowd-scoring.test.ts` (the cap's shape on both curves and its widening by stage, pieces
uncapped and a pawn's slip still capped, the relief at its thresholds, streak counting and its start rule, breaks, the
ramp, a miss, the rare-find rule and its switch, the bubble grace and what carries, 2 decimals), `faq.test.ts`. Updated
with the reason: `packages/chess/test/crowd.test.ts` (teams even but for what each still owes; cut sizes the plan's within
the grace, the ending's exact) and `packages/server/test/lobby.test.ts`'s bot chat test (its GG roll's seed). e2e
`e2e/crowd-scoring.spec.ts` (the fire's tiers, steady rows, nothing cut short at 320 and 1280, still under reduced motion,
dark; the shoutout and its bonus, the board still); test switches `?streaks=1` and `?shoutout=1` (solo).
