# Chub & Chirp's Carrot Patch: where the carrots go (Oct 18, 2026)

Their ultimate (docs/decisions/2026-10-18-carrot-patch.md): once a battle, the cast plants five carrots; the race lasts
12 moves each; his tier is the carrots he pulls; his fifth wins the battle. Eric left one thing to the sim: **where the
carrots go**, aimed so his count lands near **2 or 3 about 70%, 0 or 1 about 15%, 4 about 12%, 5 about 3%**, with the
crowd's score staying in the pack (about 0.08 to 0.55) and battles about 33 to 57 crowd moves. Placement first; the
spin's odds only if placement can't get there.

**The result: `carrotLeads` = [3, 1, 0, 0, −2]:** his count **0-1 18%, 2-3 68%, 4 11%, 5 3%** over 167 races (each
within about one standard error of the target), and the crowd scores **0.48** (± 0.09) in **44** crowd moves over 26
battles with the meter on (0.27 ± 0.08, 46 moves, with the first leads): in the pack. **The odds are unchanged** (the
sheet's). **At the top strengths** (Hard and Hardest, Elo 1800 and 2050, the race weighing 0.8 and all of it), five
carrots stay at 2% (7 of 329 races) and the crowd scores 0.19 and 0.27, as the same boss without his ultimate does
there (0.33 and 0.29): no change needed (the last section).

## How it was run

`packages/sim/scripts/boss-sim.ts raid hopper ...`: a Solo raid of 50 bots against him through the match runner, as for
Leapfrog (reports/hopper-sim.md), his offset −250 (Stockfish UCI_Elo 1350 against the bots' tier of 1600, slipping 25%
of the time), no strikes. Everything the game does: his meter, his warning, the cast, his Leapfrog, his race brain (at
his strength, a race weight of 0.35: `raceWeight`), the bots picking by the race's judge (the pulls among their
choices), the spin and the prize. Rows in `reports/boss-sim/raid-<tag>.jsonl`.

- **Battles with the meter on** (#273's seeds, 1-13 and 31-43, one battle each): the cast comes when his meter fills
  (a median of the crowd's 13th move, from the 7th to the 24th). Tags `c1Na`/`c1Nb` (the first leads) and
  `c4dNa`/`c4dNb` (the chosen leads).
- **Forced casts, for the carrots' distribution** (`{"cast": [4, 20]}`): the admins' trigger at a crowd turn drawn from
  4 to 20 (varied middlegames from the raid's openings), the battle stopped once the race and the spin are over. About
  26 s a race. Tags `c1F*`, `c2*F*`, `c3*F*`, `c4*F*`, 38 to 50 races per process.
- **Not repeatable seed for seed** (Stockfish draws its limited-strength moves from the clock), so runs compare by their
  totals; ± is one standard error.
- **His count** is the carrots he holds when the race ends (all pulled, both sides' 12 moves, or his fifth). Races the
  battle ended before they were over are left out of the distribution: 21 of 649. A race that was over counts even if
  the battle then ended before his spin: one did (c3d, all five pulled, his 3 to the crowd's 2, then his next move
  mated), so the chosen leads' 167 races hold 166 spins or wins. Nine battles never had a cast: 8 ended before their
  forced turn, and one with the meter on ended before it filled. (Corrected after the review: this said races without
  a spin were left out.)

## The placement's target

A square's **lead** is the crowd's fewest moves to it less his, from the position the cast leaves (the crowd moves
first, so a tie is the crowd's). Each carrot goes where the lead is nearest its aim, nearer squares first (in practice
every carrot was a move from one side or the other: 834 of 835), none touching, both halves. The aims tried:

| Run | Leads (`carrotLeads`) | Races | His 0-1 | 2-3 | 4 | 5 | His mean | Crowd's mean | Unpulled | Ended: all pulled / moves / his 5th | Prizes stepped down |
|---|---|---|---|---|---|---|---|---|---|---|---|
| c1 | 2, 1, 0, −1, −2 | 168 | 25% (± 3) | 65% (± 4) | 9% (± 2) | 1% (± 1) | 2.20 | 1.70 | 1.10 | 61 / 105 / 2 | 6 of 166 |
| c2a | 3, 1, 0, −1, −2 | 74 | 20% (± 5) | 70% (± 5) | 9% (± 3) | 0% | 2.20 | 1.77 | 1.03 | 31 / 43 / 0 | 4 of 74 |
| c2b | 2, 2, 0, −1, −2 | 73 | 30% (± 5) | 60% (± 6) | 7% (± 3) | 3% (± 2) | 2.11 | 1.53 | 1.36 | 17 / 54 / 2 | 3 of 71 |
| c3c | 3, 1, 1, −1, −2 | 72 | 7% (± 3) | 75% (± 5) | 17% (± 4) | 1% (± 1) | 2.62 | 1.32 | 1.06 | 28 / 43 / 1 | 2 of 71 |
| c4e | 3, 1, 0, −1, −1 | 74 | 23% (± 5) | 72% (± 5) | 5% (± 3) | 0% | 2.14 | 1.72 | 1.15 | 28 / 46 / 0 | 3 of 74 |
| **c3d + c4d (chosen)** | **3, 1, 0, 0, −2** | **167** | **18% (± 3)** | **68% (± 4)** | **11% (± 2)** | **3% (± 1)** | 2.38 | 1.72 | 0.90 | 68 / 94 / 5 | 9 of 161 |
| (its rounds) c3d | | 73 | 15% (± 4) | 67% (± 5) | 11% (± 4) | 7% (± 3) | 2.53 | 1.68 | 0.78 | 31 / 37 / 5 | 2 of 67 |
| (its rounds) c4d | | 94 | 20% (± 4) | 68% (± 5) | 12% (± 3) | 0% | 2.26 | 1.74 | 1.00 | 37 / 57 / 0 | 7 of 94 |
| Target | | | about 15% | about 70% | about 12% | about 3% | | | | | |

(c1 and the chosen row include their 26 battles with the meter on.) The chosen leads' counts: 0: 7, 1: 23, 2: 66, 3: 47,
4: 19, 5: 5.

**Who pulls what, by its lead (the chosen leads, 167 races):**

| Lead | His | The crowd's | Nobody's |
|---|---|---|---|
| 3 (rare: the board seldom has one within reach; the placement takes the nearest, 2) | 14 | 1 | 0 |
| 2 | 97 | 1 | 30 |
| 1 | 145 | 20 | 26 |
| 0 (two of them) | 129 | 162 | 43 |
| −1 (where the board had no −2) | 3 | 14 | 8 |
| −2 | 9 | 89 | 44 |

- **His leads hold** (a lead of 2: 97 his, 1 the crowd's, 30 he never got around to), **the even ones are the race**
  (129 his, 162 the crowd's: the crowd's first move isn't the edge the static count suggests, since both sides spend
  most moves on the game), **the crowd's are the crowd's** (or nobody's: a carrot he can't reach, it leaves).
- **Unpulled carrots** (about one a race): mostly the crowd's (he can't reach them, so the judge sees no hurry) and some
  of his far ones he never got around to.

## What it says

- **The chosen leads land on the target** within about a standard error in every bin: 18% (target 15%), 68% (70%), 11%
  (12%), 3% (3%). Its two rounds differ (c3d's 7% at 5 against c4d's 0%) about as much as their errors allow; together
  they're the estimate.
- **Every lead shift moves the whole curve:** a third carrot of his (c3c) cuts 0-1 to 7% but pushes 4 to 17%; two of his
  at lead 2 (c2b) did worse than one at 3 and one at 1 (his second lead-2 carrot often left in the ground); the second
  even carrot (c3d/c4d) is what brings the 5s, a carrot each side can win.
- **The odds aren't changed:** placement got there.
- **The crowd's score stays in the pack** with the meter on: 0.27 (± 0.08; 6 wins, 2 draws, 18 losses; 46 crowd moves,
  24 to 60) with the first leads, 0.48 (± 0.09; 11, 3, 12; 44 moves, 16 to 60) with the chosen ones; the two are within
  two standard errors of each other and of Leapfrog's 0.31 without the ultimate (#273). Battles inside 33 to 57.
- **The prize decides most battles it's big in:** with the meter on, the crowd lost every battle where his tier was 3 or
  more (18 of 18 over both runs) and scored 0.58 when it was 0 to 2 (30 battles). The race is the battle's turning
  point, as the sheet means it to be.
- **His race brain** (the chosen leads' races): it looked at 1,225 of his moves and changed 452 (37%), took his fifth
  carrot 5 times; 389 ms a look on the sim's machine (up to 9 searches of 30,000 nodes).
- **Prizes stepped down** (the engines' limits, docs/decisions/2026-10-18-carrot-patch.md): 9 of 161 spins, mostly two
  queens to one (he still had his queen and most of his pawns: one promotion's room) and two pawns to one (seven pawns
  left); once two queens to nothing (his whole army). The prizes given: bishop 35, two pawns 33, knight 28, a pawn 20,
  two queens 14, rook 11, queen 10, queen and rook 2, blank 8.
- **Leapfrog in the race:** a hop pulled a carrot once in 167 races; he hops 1.4 to 1.7 times a battle, as before.

## At the top strengths, and the race brain's new rule (after the review, Oct 18)

The runs above are all at his usual strength: Elo 1350 against the raid's bots (tier 1600, his offset −250), where the
race weighs 0.35 in his pick (`raceWeight`). Harder settings weigh it more, up to all of it from Elo 2000, and five
carrots is an instant loss. So, before the wiring PR puts him live, the same sim at the top: **tier 1800** (a player
rated just under 1800) on Solo's **Hard** (+250: Elo 1800, a race weight of 0.8) and **Hardest** (+500: Elo 2050, all
of it), the raid's own bots as the crowd (the same as at 1600, so the crowd is if anything weaker for him than a real
lobby of 1800 players). Patch `{"tier": 1800, "difficulty": 250 or 500}`; 150 forced casts each (seeds 801-803 and
811-813, tags `t8HF*`, `t8XF*`), 26 battles each with the meter on (#273's seeds, `t8HN*`, `t8XN*`), and, as the
reference the pack is measured against at this strength, the same 26 battles with Leapfrog alone (the meter never
filling: `{"powers": {"rageSpeed": {"hopper": 0.0001}}}`, `t8HL*`, `t8XL*`). All with this round's code, including the
race brain's minimum gain (below). Four sim processes ran at once on a 4-core machine, so the brain's times are high.

| Strength | Boss Elo (race weight) | Races | His 0-1 | 2-3 | 4 | 5 | His mean | Crowd's mean | Unpulled | Ended: all pulled / moves / his 5th | Prizes stepped down | Race brain: looks, changed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hard | 1800 (0.8) | 163 | 25% (± 3) | 61% (± 4) | 13% (± 3) | 2% (± 1) | 2.20 | 1.67 | 1.12 | 49 / 111 / 3 | 8 of 158 | 1,337, 28% |
| Hardest | 2050 (1) | 166 | 22% (± 3) | 63% (± 4) | 13% (± 3) | 2% (± 1) | 2.33 | 1.66 | 1.01 | 58 / 104 / 4 | 2 of 162 | 1,664, 27% |
| Normal, the new rule (`c5F501`, `c5F502`) | 1350 (0.35) | 92 | 21% (± 4) | 68% (± 5) | 9% (± 3) | 2% (± 2) | 2.26 | 1.71 | 1.03 | 30 / 60 / 2 | 7 of 89 | 742, 29% |
| Normal, the chosen leads (above) | 1350 (0.35) | 167 | 18% (± 3) | 68% (± 4) | 11% (± 2) | 3% (± 1) | 2.38 | 1.72 | 0.90 | 68 / 94 / 5 | 9 of 161 | 1,225, 37% |
| Target | | | about 15% | about 70% | about 12% | about 3% | | | | | | |

(Each strength's row includes its 26 battles with the meter on. Races left out because the battle ended first: 11 at
Hard, 3 at Hardest; casts that never came: 2 and 7.) The counts: Hard 0: 5, 1: 35, 2: 72, 3: 27, 4: 21, 5: 3; Hardest
0: 4, 1: 33, 2: 63, 3: 41, 4: 21, 5: 4.

**The crowd's score, with the meter on and with Leapfrog alone, at the same strength (26 battles each):**

| Strength | Carrot Patch (meter on) | Leapfrog alone | Crowd moves (on / alone) | Meter on: tier 3+ / tier 0-2 |
|---|---|---|---|---|
| Hard (1800) | 0.19 (± 0.07; 3, 4, 19) | 0.33 (± 0.08; 6, 5, 15) | 44 / 40 | 7 battles, all his / 17, the crowd 0.29 |
| Hardest (2050) | 0.27 (± 0.08; 5, 4, 17) | 0.29 (± 0.08; 5, 5, 16) | 43 / 41 | 9, 8 his and a draw / 14, the crowd 0.46 |

(Wins, draws, losses for the crowd. With the meter on, the cast came in 26 and 23 of the 26 battles, a median of the
crowd's 14th and 13th move.)

- **Five carrots stay rare at the top:** 2% at Hard and at Hardest (7 of 329 races, ± 0.8), the same as at Normal.
  Racing harder doesn't win him more carrots here. A likely reason: the crowd's bots race by the judge at full weight at
  every strength, so his extra effort meets theirs. The whole curve is close to Normal's: a few more 0-1s (22 to 25%
  against 18 to 21%), 4s at 13% (target 12%).
- **The crowd stays in the pack:** 0.19 and 0.27, inside the band (0.08 to 0.55), and within one and a half standard
  errors of the same boss without his ultimate at the same strength (0.33 and 0.29; at Hard the Carrot Patch is −0.14 ±
  0.11, at Hardest −0.02 ± 0.11). At Normal it went the other way (0.48 against 0.31): none of the three differences is
  more than about one and a half standard errors, so the Carrot Patch doesn't move the crowd's score at any strength we
  can tell. Battles stay inside 33 to 57 crowd moves on average.
- **So no change to the tuning:** the leads stay [3, 1, 0, 0, −2] at every strength, the odds the sheet's.

**The race brain's minimum gain** (`carrotMinGain`, 0.25 pawn; docs/decisions/2026-10-18-carrot-patch.md): a move
replaces his pick only for at least a quarter pawn of the race's worth, so a tiny race gain can't let a stronger chess
move in. It changes his move less often (29% of his looks at Normal, against 37% before), as it should: the switches it
drops are the ones the race barely cared about. The distribution at Normal holds within its errors (21, 68, 9, 2
against the chosen 18, 68, 11, 3), so the leads chosen above stand.

## The engines' limits (checked Oct 18)

chess.js takes any count (9 or 10 pawns a side, 17 or 18 pieces, 3 queens); Maia's worker reads positions with chess.js
and its encoder takes any count (both checked); Stockfish 19 (the game's, the Node build `stockfish-19-lite-single`)
returns nothing for more than 8 pawns a side or more pieces than promotions could make, which caps a side at 16. Our
`stockfishRefuses` already matched it exactly, so the prize steps down by it.
