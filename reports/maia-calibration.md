# Maia boss calibration (Oct 12, 2026)

Written by `npx tsx packages/sim/scripts/maia-calibration.ts summary` from `reports/maia-calibration/*.jsonl`. A modest
run by design: small samples, every number with its error bar (± two standard errors), and the choices lean on
several rows at once, never on one. The choices and why are in DECISIONS.md, "Every boss on Maia: the calibration"
and "Maia bosses harder".

**What it measures.**

- **Games** (as `boss-sim.ts` and `reports/boss-calibration.md`): a crowd of 10 bots (each a skill temperature and a
  share of random moves: beginner, casual, club, expert), the most popular pick played, the boss striking down the
  worst recent mover every 3 crowd moves down to 3, against the boss in plain chess (no powers, no God King, no Last
  Stand), up to 60 crowd moves, then the engine's verdict (60% or more: a win). The boss's strength is the crowd's
  weighted rating less 100 (as the Crowd's boss battle sets it); the boss is today's Stockfish boss, or Maia at a fixed
  rating. "One player alone" is the crowd's middle member on its own, against a boss at its own rating (Boss alone at
  Normal). The same openings for every boss, colors alternating. "Their played moves rate": the rating (the game's
  own, from points lost a move) of the moves the crowd actually played.
- **Per move**: on the positions the game's rating curve was fitted on (calibrate-rating.ts's), Maia's likeliest moves
  at a ladder of ratings, scored as the judge scores a pick. Maia's expected loss is worked out from its
  probabilities (temperature 0.8, top-p 0.9; for a guard, the guard's pick for each draw), so it has no sampling
  noise; the error bars are over positions. These are early positions (openings and a few good moves), where people
  play well, so Maia "plays like" far higher ratings here than in whole games: read them across the ladder and
  across the guards, not as the game's scale.

## Per move: what a Maia rating plays like

160 positions (calibrate-rating.ts's). Mean loss per move ± two standard errors (over positions); "plays like" is the rating whose loss per move that is on the game's own scale (RATING_CURVE, what a player's rating is), the way a player is rated.

| Maia rating | No guard: loss | plays like | Light guard: loss | plays like | Full guard: loss | plays like | Strict guard: loss | plays like |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 600 | 9.78 ± 1.66 | 1545 | 2.30 ± 0.64 | 3125 | 1.16 ± 0.29 | 3400 | 0.54 ± 0.14 | 3400 |
| 900 | 6.81 ± 1.44 | 1940 | 2.07 ± 0.61 | 3240 | 1.09 ± 0.28 | 3400 | 0.48 ± 0.13 | 3400 |
| 1200 | 5.21 ± 1.25 | 2232 | 2.03 ± 0.61 | 3263 | 1.14 ± 0.29 | 3400 | 0.46 ± 0.12 | 3400 |
| 1500 | 4.38 ± 1.07 | 2422 | 1.96 ± 0.58 | 3301 | 1.12 ± 0.30 | 3400 | 0.47 ± 0.13 | 3400 |
| 1800 | 3.78 ± 0.95 | 2582 | 1.98 ± 0.60 | 3290 | 1.11 ± 0.31 | 3400 | 0.46 ± 0.13 | 3400 |
| 2100 | 3.21 ± 0.89 | 2763 | 1.76 ± 0.58 | 3400 | 0.96 ± 0.28 | 3400 | 0.43 ± 0.12 | 3400 |
| 2400 | 2.73 ± 0.85 | 2939 | 1.74 ± 0.61 | 3400 | 0.89 ± 0.28 | 3400 | 0.39 ± 0.12 | 3400 |
| 2700 | 2.53 ± 0.80 | 3021 | 1.49 ± 0.55 | 3400 | 0.84 ± 0.27 | 3400 | 0.36 ± 0.11 | 3400 |
| 3000 | 2.80 ± 0.89 | 2911 | 1.52 ± 0.53 | 3400 | 0.87 ± 0.28 | 3400 | 0.36 ± 0.11 | 3400 |

| Today's Stockfish boss at | Loss per move | plays like |
| --- | --- | --- |
| 1600 | 1.71 ± 0.38 | 3400 |
| 2200 | 1.43 ± 0.38 | 3400 |
| 2600 | 1.39 ± 0.38 | 3400 |
| 2800 | 1.05 ± 0.30 | 3400 |

## Games: bot crowds, and one player alone, against the boss

| Who plays the boss | Their rating | Boss strength | Boss | Games | Their score ± 2 SE | Their chances at the end ± 2 SE | Wins / draws / losses | Their played moves rate | Boss moves by Maia | Median boss move, ms | Avg moves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beginner crowd | 1484 | 1384 | Stockfish (today) | 6 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 6 | 2949 | 0% | 1429 | 26 |
| beginner crowd | 1484 | 1384 | maia-raw at Maia 300 | 8 | 0.56 ± 0.30 | 0.56 ± 0.30 | 3 / 3 / 2 | 1978 | 100% | 451 | 49 |
| beginner crowd | 1484 | 1384 | maia-raw at Maia 600 | 8 | 0.13 ± 0.25 | 0.13 ± 0.25 | 1 / 0 / 7 | 2019 | 100% | 501 | 30 |
| beginner crowd | 1484 | 1384 | maia-raw at Maia 800 | 7 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 7 | 2500 | 100% | 587 | 22 |
| one casual player (Boss alone) | 1792 | 1792 | maia-raw at Maia 600 | 8 | 0.13 ± 0.16 | 0.13 ± 0.16 | 0 / 2 / 6 | 2276 | 100% | 503 | 32 |
| one casual player (Boss alone) | 1792 | 1792 | maia-raw at Maia 1000 | 8 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 8 | 2248 | 100% | 596 | 25 |
| casual crowd | 1920 | 1820 | Stockfish (today) | 6 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 6 | 2821 | 0% | 1293 | 26 |
| casual crowd | 1920 | 1820 | maia-raw at Maia 1000 | 10 | 0.35 ± 0.26 | 0.35 ± 0.26 | 2 / 3 / 5 | 2587 | 100% | 590 | 43 |
| casual crowd | 1920 | 1820 | maia-raw at Maia 1500 | 8 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 8 | 2486 | 100% | 577 | 29 |
| casual crowd | 1920 | 1820 | maia-raw at Maia 2000 | 4 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 4 | 2944 | 100% | 546 | 33 |
| casual crowd | 1950 | 1850 | the first, even rule: maia-raw at Maia 1029 | 8 | 0.38 ± 0.37 | 0.38 ± 0.37 | 3 / 0 / 5 | 2929 | 100% | 574 | 40 |
| casual crowd | 1664 | 1564 | the harder rule (shipped): maia-raw at Maia 805 | 8 | 0.25 ± 0.33 | 0.25 ± 0.33 | 2 / 0 / 6 | 2508 | 100% | 526 | 46 |
| one club player (Boss alone) | 2166 | 2166 | maia-raw at Maia 1000 | 8 | 0.25 ± 0.33 | 0.25 ± 0.33 | 2 / 0 / 6 | 3153 | 100% | 520 | 40 |
| one club player (Boss alone) | 2166 | 2166 | maia-raw at Maia 1600 | 8 | 0.13 ± 0.25 | 0.12 ± 0.25 | 1 / 0 / 7 | 2915 | 100% | 555 | 32 |
| one club player (Boss alone) | 2162 | 2162 | the first, even rule: maia-raw at Maia 826 | 8 | 0.50 ± 0.33 | 0.50 ± 0.33 | 3 / 2 / 3 | 3153 | 100% | 558 | 42 |
| one club player (Boss alone) | 2060 | 2060 | the harder rule (shipped): maia-raw at Maia 910 | 8 | 0.06 ± 0.13 | 0.06 ± 0.13 | 0 / 1 / 7 | 2404 | 100% | 590 | 29 |
| club crowd | 2266 | 2166 | Stockfish (today) | 6 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0 / 0 / 6 | 3400 | 0% | 1391 | 42 |
| club crowd | 2266 | 2166 | maia-raw at Maia 1600 | 10 | 0.75 ± 0.27 | 0.75 ± 0.27 | 7 / 1 / 2 | 3400 | 100% | 562 | 58 |
| club crowd | 2266 | 2166 | maia-raw at Maia 2100 | 10 | 0.50 ± 0.30 | 0.50 ± 0.30 | 4 / 2 / 4 | 3400 | 100% | 546 | 50 |
| club crowd | 2266 | 2166 | maia-raw at Maia 2600 | 10 | 0.55 ± 0.31 | 0.55 ± 0.31 | 5 / 1 / 4 | 3400 | 100% | 540 | 60 |
| club crowd | 2266 | 2166 | the harder rule (shipped): maia-light at Maia 2332 | 8 | 0.19 ± 0.26 | 0.19 ± 0.26 | 1 / 1 / 6 | 3400 | 99% | 573 | 37 |
| club crowd | 2183 | 2083 | the first, even rule: maia-raw at Maia 1861 | 8 | 0.50 ± 0.38 | 0.50 ± 0.38 | 4 / 0 / 4 | 3342 | 100% | 531 | 49 |
| club crowd | 2305 | 2205 | the harder rule (shipped): maia-light at Maia 2410 | 8 | 0.06 ± 0.13 | 0.06 ± 0.12 | 0 / 1 / 7 | 3400 | 99% | 528 | 42 |
| expert crowd | 2771 | 2671 | Stockfish (today) | 6 | 0.25 ± 0.22 | 0.25 ± 0.22 | 0 / 3 / 3 | 3400 | 0% | 1367 | 49 |
| expert crowd | 2771 | 2671 | maia-raw at Maia 2700 | 10 | 0.95 ± 0.10 | 0.95 ± 0.10 | 9 / 1 / 0 | 3400 | 100% | 557 | 56 |
| expert crowd | 2771 | 2671 | maia-light at Maia 2700 | 10 | 0.65 ± 0.26 | 0.59 ± 0.24 | 5 / 3 / 2 | 3400 | 99% | 546 | 51 |
| expert crowd | 2771 | 2671 | maia-strict at Maia 2700 | 10 | 0.35 ± 0.26 | 0.34 ± 0.25 | 2 / 3 / 5 | 3400 | 97% | 520 | 51 |
| expert crowd | 2771 | 2671 | the harder rule (shipped): maia-strict at Maia 2500, 57% Stockfish | 8 | 0.31 ± 0.18 | 0.36 ± 0.16 | 0 / 5 / 3 | 3400 | 38% | 913 | 59 |
| expert crowd | 2871 | 2771 | the first, even rule: maia-strict at Maia 2500, 90% Stockfish | 8 | 0.38 ± 0.25 | 0.36 ± 0.23 | 1 / 4 / 3 | 3400 | 8% | 1120 | 55 |

Where each is even with Maia (no guard), from the table above:

| Who | Their rating | Boss strength | Even with Maia at |
| --- | --- | --- | --- |
| beginner crowd | 1484 | 1384 | 343 |
| one casual player (Boss alone) | 1792 | 1792 | at or below Maia 600 |
| casual crowd | 1920 | 1820 | at or below Maia 1000 |
| one club player (Boss alone) | 2166 | 2166 | at or below Maia 1000 |
| club crowd | 2266 | 2166 | above Maia 2600 |
| expert crowd | 2771 | 2671 | above Maia 2700 |

## What it says

- **Today's Stockfish boss is far harder than its label in plain chess.** With its blunder guard (Oct 5) it beat every
  beginner, casual and club crowd here (18 games, no crowd win or draw) and held the expert crowd to a quarter. Maia with
  no guard can't be that hard below its ceiling and still be the human boss Eric asked for; the target is instead the
  boss battle's own from Oct 3 ("very hard but beatable": a club crowd about even in plain chess), the powers and
  the God King on top as before.
- **Where crowds are even with Maia (no guard):** the beginner crowd at about Maia 350 (under Maia's floor of 600, where
  it scored 0.13), the casual crowd a little under 1000, the club crowd about 2100 (it scored the same against 2600).
  The steps between crowds are far bigger than their ratings' steps: bot crowds' blunders are random moves, which
  voting filters out better the more consistent the crowd is.
- **One player alone needs a much weaker Maia** than a crowd of the same rating: the club bot alone scored 0.25
  against Maia 1000, the club crowd 0.50 against 2100. On the lines that is about 400 of level: the crowd's margin.
- **Maia's ceiling:** with no guard it stops gaining between Maia 2100 and 2700 (the same score for the club crowd at
  2100 and 2600; per move 2.73 points at 2400, 2.53 at 2700, 2.80 at 3000). The lines hold at 2500.
- **The bridge:** against the expert crowd, Maia at its ceiling with no guard lost 9 of 10; with the light guard the
  crowd scored 0.65, with the strict guard 0.35, against today's Stockfish 0.25: light, then strict, then Stockfish
  is a ramp in steps no bigger than the error bars. Per move, the light guard (about 1.5–1.7 points a move at Maia
  2400–2700) is today's boss at 2600 (1.39), the strict one (about 0.4) sharper than today's at 2800 (1.05); the
  bridge's growing share of Stockfish's moves brings it to Stockfish's own at 2800.
- **The first rule (#157), checked on fresh openings** ("the first, even rule" above, 8 games each): the casual
  crowd scored 0.38, the club crowd 0.50, the club player alone 0.50, the expert crowd (in the bridge, 90% Stockfish)
  0.38: about even everywhere, within error bars of about ±0.3 to ±0.4.

## Harder: the boss clearly favored (Eric, Oct 12)

Eric, after #157: "We should be upping the Maia rating. The numbers don't need to be accurate; people read 'boss' and
assume it's a challenge, so that's the key." The new target: each crowd, and a lone player at its own difficulty,
scoring about 0.30 in plain chess; the bridge earlier where Maia alone can't get there.

- **What changed:** the lines (level → Maia) 600 up to 1800, 850 at 2000, 1100 at 2250, 2000 at 2400, 2500 from
  2650; the guard now follows the level, so a crowd meets it sooner (light from a level of 2400, strict from 2800);
  Stockfish's share follows the strength (from 2500 to all of the moves just under 2800); the crowd's margin stays
  400.
- **What it gives** ("the harder rule" rows above, 8 games each on fresh openings): the casual crowd 0.25 (Maia
  805), the expert crowd 0.31 (strict guard, 57% Stockfish): on target. The club crowds 0.19 and 0.06 (the light
  guard at Maia 2332 and 2410) and the club player alone 0.06 (Maia 910): harder than the target. A casual player
  alone is at Maia's floor (600) already, 0.13 and 0.00 in the rows above: it can't be made easier.
- **Why the club crowd overshoots:** with no guard Maia can't hold a club crowd under about 0.5 even at its ceiling
  (2100 to 2600 above), and the light guard is a big step: it takes away exactly the blunders a voting crowd
  punishes. Nothing in between in this design, and Eric asked for the bridge earlier rather than a lost challenge.
  Two tries before this one said the same: the strict guard from a level of 2550 (the club crowd 0 of 8), and the
  light guard at Maia 2500 (0.19 and 0.12). If real club-level crowds find it too hard, the knobs are a looser
  light guard or the light guard from a higher level.

## What the game ships (BOSS_BRAIN)

Maia's rating lines (level → Maia): 1800 → 600, 2000 → 850, 2250 → 1100, 2400 → 2000, 2650 → 2500 (held above the last; never under 600); a crowd's margin 400; the light guard from a level of 2400, the strict guard from a level of 2800 (a crowd's level only: one player is Stockfish's from a strength of 2800); Stockfish's share from a strength of 2500 up to 100% just under 2800; Stockfish from 2800.

| Boss strength | Boss alone | A crowd |
| --- | --- | --- |
| 1000 | maia-raw 600 | maia-raw 600 |
| 1200 | maia-raw 600 | maia-raw 600 |
| 1400 | maia-raw 600 | maia-raw 600 |
| 1600 | maia-raw 600 | maia-raw 850 |
| 1800 | maia-raw 600 | maia-raw 1050 |
| 2000 | maia-raw 850 | maia-light 2000 |
| 2200 | maia-raw 1050 | maia-light 2400 |
| 2400 | maia-light 2000 | maia-strict 2500 |
| 2500 | maia-light 2200 | maia-strict 2500 |
| 2600 | maia-light 2400 (33% Stockfish) | maia-strict 2500 (33% Stockfish) |
| 2650 | maia-light 2500 (50% Stockfish) | maia-strict 2500 (50% Stockfish) |
| 2700 | maia-light 2500 (67% Stockfish) | maia-strict 2500 (67% Stockfish) |
| 2750 | maia-light 2500 (83% Stockfish) | maia-strict 2500 (83% Stockfish) |
| 2799 | maia-light 2500 (100% Stockfish) | maia-strict 2500 (100% Stockfish) |
| 2800 | Stockfish | Stockfish |
| 3000 | Stockfish | Stockfish |

