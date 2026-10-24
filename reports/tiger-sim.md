# Babur, the circus tiger: calibrating Balloons and Hoops (Oct 23-24, 2026)

## Oct 24: the balloons blow up faster (Eric's pace)

Eric, Oct 24, after a ~60-move Boss-alone game against him: the balloons weren't landing, "he's way too easy otherwise", and
he expects "about a bishop's worth or whatever on average of pieces a game, like a bishop and a pawn… it's still just a
little too slow." The floor the director set (Oct 24): landed material of **4 or more a battle at Eric's pace**, a bishop and
a pawn; a rook's worth is fine at times; more balloons popping is fine if that's what it takes.

**Shipped: `balloonStageSec` 12 (was 30), pops 50 / 65 / 65 / 65 (was 40 / 55 / 55 / 55; about 58% pop, was about half).**
The sweep, in the order the director set: 30 s (2.15), 20 s (3.60) and 15 s (3.80) stayed under 4.0; 12 s gave 6.35, over
6.0, so the stage stayed at 12 s and the pops were raised 10 points each (pawn 40 → 50, knight, bishop and rook 55 → 65; fake
queen 100, queen 0), once more (5.50, in 4.0 to 6.0: shipped). 10 s was not needed. Each mean is over 20 battles, so each
has a standard error of about ±0.6 to ±0.9. The two 12 s runs differ only in the pops (6.35 at the old odds, 5.50 at the new),
and their errors overlap.

**The raid check:** at the shipped values, the 10 s crowd scores **0.35** (± 0.10, 20 battles; 5 won, 4 drawn, 11 lost): the
report's 0.40 at 30 s and the same 10 s crowd re-run today at 30 s, 0.42 (± 0.10). Inside the director's 0.25 to 0.40 target,
and well above the 0.15 flag line. The slow crowd (20 s a pick, the 0.05 below) was not run again at 12 s.

**How it was run:** the sim has no Boss-alone mode (checked: `packages/sim/scripts/boss-sim.ts` has only the raid), so Eric's
pace is the raid with `"pickSec":5`: a crowd of 50 bots, each crowd turn picked in 5 s. That's a fast crowd, not one player
alone, so the pace is an approximation. Seed 41, games 0 to 19 (20 battles a run), the shipped offset −250 and `rageSpeed`
1.6, as the report's runs. Landed material: pawn 1, knight 3, bishop 3, rook 5, queen 9; a popped balloon 0. The battle's real
time is estimated from its moves (each crowd turn is the pick, the 2 s reveal and his 3 s turn: the sim doesn't log its clock).
Rows: `reports/boss-sim/raid-<tag>.jsonl`.

| Run | Crowd's pick | Stage | Pops p / n / b / r / fake q / q | Battles | W / D / L | Crowd score (± 1 s.e.) | Crowd moves: mean (range) | At the cap | Casts a battle | Balloons placed / landed / popped a battle | Landed material a battle (± 1 s.e.) | Est. real time a battle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| babur30E | 5 s | 30 s | 40 / 55 / 55 / 55 / 100 / 0 | 20 | 8 / 3 / 9 | 0.47 (± 0.11) | 53 (29-60) | 12 | 4.10 | 4.50 / 1.45 / 2.05 | **2.15** (± 0.29) | 8.8 min |
| babur20E | 5 s | 20 s | 40 / 55 / 55 / 55 / 100 / 0 | 20 | 4 / 2 / 14 | 0.25 (± 0.09) | 48 (18-60) | 8 | 3.30 | 5.55 / 1.80 / 2.75 | **3.60** (± 0.82) | 7.9 min |
| babur15E | 5 s | 15 s | 40 / 55 / 55 / 55 / 100 / 0 | 20 | 7 / 3 / 10 | 0.42 (± 0.10) | 49 (22-60) | 10 | 3.60 | 7.25 / 2.40 / 3.85 | **3.80** (± 0.62) | 8.1 min |
| babur12E | 5 s | 12 s | 40 / 55 / 55 / 55 / 100 / 0 | 20 | 4 / 1 / 15 | 0.23 (± 0.09) | 47 (17-60) | 9 | 3.45 | 7.85 / 2.85 / 4.05 | **6.35** (± 0.93) | 7.9 min |
| babur12P | 5 s | 12 s | 50 / 65 / 65 / 65 / 100 / 0 | 20 | 6 / 2 / 12 | 0.35 (± 0.10) | 52 (24-60) | 10 | 4.05 | 8.85 / 2.60 / 5.25 | **5.50** (± 0.83): shipped | 8.7 min |
| babur30R10 | 10 s | 30 s | 40 / 55 / 55 / 55 / 100 / 0 | 20 | 7 / 3 / 10 | 0.42 (± 0.10) | 47 (21-60) | 9 | 3.50 | 5.35 / 1.90 / 2.50 | 3.00 (± 0.48) | 11.7 min |
| babur12R10 | 10 s | 12 s | 50 / 65 / 65 / 65 / 100 / 0 | 20 | 5 / 4 / 11 | **0.35** (± 0.10) | 47 (15-60) | 7 | 3.45 | 9.70 / 2.75 / 5.95 | 6.25 (± 0.98) | 11.7 min |

babur30R10 and babur12R10 are the 10 s raid check: today's numbers and the shipped ones. The 5 s runs are Eric's pace.

## Oct 23-24: the review's calibration

Babur, the circus tiger (id `tiger`; docs/decisions/2026-10-23-tiger-rules.md). From the starting position, as every raid.
**Balloons:** a balloon on his nozzle at the start of his turn, 4 stages on the battle's clock, then at the end of a turn it
lands as his piece (never on a square the crowd attacks; the least valuable safe square, by the engine) or pops. **Hoops**
(the rage meter): his whole turn, three 2x2 blocks walled for the crowd's next 2 moves, the blocks that bite hardest.

The rule for the choice: place him in the pack (a crowd score of about 0.08 to 0.55, 33 to 57 crowd moves, about 3 casts),
and after the review (Oct 24) the director's target, a crowd score of 0.25 to 0.40.

**Shipped (Oct 24, the section above): offset −250, `balloonStageSec` 12, `rageSpeed` 1.6, pops 50 / 65 / 65 / 65 (fake queen
always, real queen never: about 58%), the landing on the least valuable safe square. The review's values (below, Oct 23-24) were
`balloonStageSec` 30 and pops 40 / 55 / 55 / 55 (about half).** With a crowd that takes 10 s to pick
(tigerR10) the crowd scores **0.40** (± 0.11, 20 battles) in **49** crowd moves with **3.5 casts** a battle: at the top of the
target. A slow crowd (20 s a pick, the raid's whole clock every turn; tigerR20) scores **0.05** (± 0.05, 20): the slower the
crowd, the more balloons (5.8 against 7.6 a battle) and the more land (1.9 against 2.9). Within the review's rule (try 45 s
only if under 0.20), no further run: the 10 s crowd is in the target; the slow crowd's weakness is the pump's real-time
nature (Eric: playing slowly feeds him), flagged.

Before the review, the same 30 s stages with the old pops (12 / 25 / 25 / 35), the old landing (the band's middle, the
crowd's attacked squares only tried last) and `rageSpeed` 1.4 gave 0.14 (± 0.10, 14 battles; the reviewer's 54 battles of
that code: 0.065 ± 0.03): his edge was landed material (5.5 to 8 pawns a battle, most of it pieces), not the hoops.

## How it was run

The raid sim, as for Puddles: a Solo raid of 50 bots against him through the match runner, one battle per seed, no
strikes, his meter on. `npx tsx packages/sim/scripts/boss-sim.ts raid tiger <games> <seed> 0 <tag> '{"pickSec":N}'` (the
sweep: `"powers":{"balloonStageSec":S,"rageSpeed":{"tiger":R}}`); rows in `reports/boss-sim/raid-<tag>.jsonl`. His
balloons need a clock: the sim keeps one (the runner's `clock`): each crowd turn passes the crowd's pick (`pickSec`), the
reveal (2.5 s), his thinking and his move's show (3 s) and the turn's moments. His landings (`landFrom`) and casts
(`hoopsFrom`) are the host's code on native Stockfish. Score: a win 1, a draw ½ (at the 60-move cap the engine's verdict); ±
one standard error. Not repeatable seed for seed (Stockfish's UCI_Elo). The bands: `packages/sim/scripts/tiger-bands.ts`.

## The review's runs (shipped code; bands [0.3, 1.5] for a pawn, [7, 8.5] for a piece)

| Run | Crowd's pick | Stage | rageSpeed | Battles | W / D / L | Crowd score (± 1 s.e.) | Crowd moves: mean (range) | At the cap | Casts a battle | Balloons placed / landed / popped a battle |
|---|---|---|---|---|---|---|---|---|---|---|
| tigerR10 | 10 s | 30 s | 1.6 | 20 | 7 / 2 / 11 | **0.40** (± 0.11) | 49 (29-60) | 8 | 3.5 | 5.8 / 1.9 / 2.9 |
| tigerR20 | 20 s | 30 s | 1.6 | 20 | 1 / 0 / 19 | **0.05** (± 0.05) | 45 (21-60) | 4 | 3.0 | 7.6 / 2.9 / 3.8 |

| Run | Placed | Landed: p / n / b / r / q | Popped (duds): p / n / b / r / q | Popped (`nine`): p / n / b / r / q | Never ended (on the nozzle at the end) |
|---|---|---|---|---|---|
| tigerR10 | 115 | 27 / 3 / 4 / 1 / 2 | 23 / 5 / 6 / 4 / 12 | 7 / 0 / 0 / 1 / 0 | 20 |
| tigerR20 | 152 | 36 / 5 / 6 / 5 / 5 | 22 / 11 / 9 / 6 / 12 | 10 / 0 / 1 / 1 / 3 | 20 |

| Run | Landings with a gain | Saturated (0: battle decided) | In band | Under | Over | Mean gain (not 0) by shape: p / n / b / r / q |
|---|---|---|---|---|---|---|
| tigerR10 | 37 | 12 | 15 | 1 | 9 | 1.4 / 8.7 / 9.2 / - / - |
| tigerR20 | 57 | 23 | 23 | 3 | 8 | 1.0 / 11.0 / 8.5 / 9.3 / 10.3 |

| Run | Casts | Blocks a cast | Gain a cast: mean, median | In [0.5, 2.5] | Under 0.5 | Over 2.5 | Waits (pass guard / none) | Search ms: median, max | Crowd turns walled | Walls took the engine's best move |
|---|---|---|---|---|---|---|---|---|---|---|
| tigerR10 | 70 | 3.00 | -0.26, 0.00 | 1 | 69 | 0 | 27 / 0 | 1496, 2178 | 139 | 97 (70%) |
| tigerR20 | 59 | 2.98 | -0.26, 0.00 | 2 | 57 | 0 | 31 / 1 | 1545, 2334 | 117 | 87 (74%) |

## Before the review

Runs: tiger15 (Eric's 15 s stages), tiger30/45/60 (a stage sweep at `rageSpeed` 2), tiger30pre and tiger30lo (30 s on
earlier code, stopped part way when the code changed), tigerM/F/S (the first shipped setting: 30 s, `rageSpeed` 1.4). Old
pops 12 / 25 / 25 / 35; old landing (the band's middle); old bands (pawn [0.3, 1.5], knight or bishop [2, 4], rook [3.5, 6],
queen [7, 10.5]), which the "in band" columns below use.

| Run | Crowd's pick | Stage | rageSpeed | Battles | W / D / L | Crowd score (± 1 s.e.) | Crowd moves: mean (range) | At the cap | Casts a battle | Balloons placed / landed / popped a battle |
|---|---|---|---|---|---|---|---|---|---|---|
| tigerM | 10 s | 30 s | 1.4 | 14 | 2 / 0 / 12 | **0.14** (± 0.10) | 38 (25-60) | 2 | 2.2 | 4.6 / 2.6 / 0.9 |
| tigerF | 5 s | 30 s | 1.4 | 8 | 1 / 1 / 6 | **0.19** (± 0.13) | 41 (31-60) | 1 | 2.0 | 3.5 / 1.6 / 0.9 |
| tigerS | 20 s | 30 s | 1.4 | 8 | 0 / 0 / 8 | **0.00** (± 0.00) | 39 (10-54) | 0 | 2.2 | 6.8 / 3.4 / 2.4 |
| tiger30loM | 10 s | 30 s | 1.4 | 4 | 1 / 1 / 2 | **0.38** (± 0.24) | 44 (23-60) | 1 | 2.8 | 5.2 / 2.8 / 1.5 |
| tiger30preM | 10 s | 30 s | 1.4 | 7 | 1 / 0 / 6 | **0.14** (± 0.14) | 47 (36-60) | 2 | 3.0 | 5.3 / 3.1 / 1.1 |
| tiger15M | 10 s | 15 s | 1.2 | 10 | 0 / 0 / 10 | **0.00** (± 0.00) | 36 (18-60) | 1 | 1.8 | 7.2 / 3.7 / 2.5 |
| tiger15F | 5 s | 15 s | 1.2 | 9 | 0 / 1 / 8 | **0.06** (± 0.06) | 40 (17-60) | 2 | 1.9 | 6.0 / 3.7 / 1.3 |
| tiger15S | 20 s | 15 s | 1.2 | 9 | 0 / 0 / 9 | **0.00** (± 0.00) | 38 (24-55) | 0 | 1.8 | 9.6 / 4.7 / 3.9 |
| tiger30M | 10 s | 30 s | 2 | 10 | 4 / 0 / 6 | **0.40** (± 0.16) | 53 (35-60) | 6 | 4.4 | 6.2 / 3.9 / 1.3 |
| tiger45M | 10 s | 45 s | 2 | 10 | 3 / 0 / 7 | **0.30** (± 0.15) | 48 (31-60) | 4 | 3.6 | 4.1 / 2.8 / 0.3 |
| tiger60M | 10 s | 60 s | 2 | 10 | 4 / 2 / 4 | **0.50** (± 0.15) | 57 (47-60) | 7 | 5.2 | 3.9 / 2.0 / 0.9 |

| Run | Placed | Landed: p / n / b / r / q | Popped (duds): p / n / b / r / q | Popped (`nine`): p / n / b / r / q | Never ended (on the nozzle at the end) |
|---|---|---|---|---|---|
| tigerM | 64 | 22 / 4 / 6 / 5 / 0 | 3 / 3 / 0 / 0 / 2 | 5 / 0 / 0 / 0 / 0 | 14 |
| tigerF | 28 | 5 / 2 / 3 / 1 / 2 | 0 / 3 / 0 / 1 / 2 | 0 / 1 / 0 / 0 / 0 | 8 |
| tigerS | 54 | 17 / 5 / 3 / 0 / 2 | 3 / 1 / 3 / 0 / 6 | 4 / 0 / 2 / 0 / 0 | 8 |
| tiger30loM | 21 | 8 / 1 / 0 / 1 / 1 | 2 / 0 / 0 / 1 / 1 | 1 / 1 / 0 / 0 / 0 | 4 |
| tiger30preM | 37 | 12 / 6 / 1 / 2 / 1 | 5 / 1 / 0 / 0 / 2 | 0 / 0 / 0 / 0 / 0 | 7 |
| tiger15M | 72 | 23 / 6 / 5 / 2 / 1 | 3 / 0 / 0 / 1 / 11 | 9 / 1 / 0 / 0 / 0 | 10 |
| tiger15F | 54 | 20 / 7 / 5 / 0 / 1 | 4 / 1 / 1 / 1 / 2 | 1 / 1 / 1 / 0 / 0 | 9 |
| tiger15S | 86 | 27 / 3 / 6 / 2 / 4 | 6 / 1 / 2 / 1 / 7 | 14 / 0 / 3 / 0 / 1 | 9 |
| tiger30M | 62 | 35 / 1 / 1 / 1 / 1 | 2 / 2 / 2 / 0 / 5 | 2 / 0 / 0 / 0 / 0 | 10 |
| tiger45M | 41 | 18 / 2 / 5 / 2 / 1 | 3 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 10 |
| tiger60M | 39 | 13 / 3 / 3 / 1 / 0 | 3 / 1 / 1 / 1 / 2 | 1 / 0 / 0 / 0 / 0 | 10 |

| Run | Landings with a gain | Saturated (0: battle decided) | In band | Under | Over | Mean gain (not 0) by shape: p / n / b / r / q |
|---|---|---|---|---|---|---|
| tigerM | 37 | 17 | 15 | 0 | 5 | 0.9 / 5.7 / 4.1 / 7.1 / - |
| tigerF | 13 | 5 | 3 | 0 | 5 | 2.2 / 3.1 / 7.2 / 12.7 / 9.0 |
| tigerS | 27 | 11 | 4 | 1 | 11 | 2.1 / 6.1 / 7.8 / - / 12.9 |
| tiger30loM | 11 | 2 | 7 | 0 | 2 | 1.1 / - / - / 10.3 / 7.3 |
| tiger30preM | 22 | 12 | 4 | 0 | 6 | 2.1 / 6.1 / - / 7.6 / - |
| tiger15M | 37 | 13 | 9 | 6 | 9 | 1.8 / 3.6 / 7.2 / 7.5 / - |
| tiger15F | 33 | 14 | 12 | 0 | 7 | 1.2 / 6.0 / 5.7 / - / 7.8 |
| tiger15S | 42 | 16 | 15 | 4 | 7 | 1.3 / 4.5 / 5.3 / - / 7.3 |
| tiger30M | 39 | 12 | 19 | 2 | 6 | 1.1 / 4.8 / 3.1 / - / 7.3 |
| tiger45M | 28 | 11 | 8 | 2 | 7 | 0.6 / 4.4 / 4.1 / 7.5 / - |
| tiger60M | 20 | 8 | 7 | 3 | 2 | 0.7 / 1.0 / 3.0 / - / - |

| Run | Casts | Blocks a cast | Gain a cast: mean, median | In [0.5, 2.5] | Under 0.5 | Over 2.5 | Waits (pass guard / none) | Search ms: median, max | Crowd turns walled | Walls took the engine's best move |
|---|---|---|---|---|---|---|---|---|---|---|
| tigerM | 31 | 2.97 | -0.30, 0.00 | 0 | 31 | 0 | 13 / 0 | 1421, 2063 | 62 | 47 (76%) |
| tigerF | 16 | 3.00 | -0.35, -0.05 | 0 | 16 | 0 | 22 / 0 | 1416, 1840 | 31 | 19 (61%) |
| tigerS | 18 | 2.94 | -0.46, -0.15 | 0 | 18 | 0 | 10 / 0 | 1442, 1995 | 36 | 22 (61%) |
| tiger30loM | 11 | 3.00 | -0.40, -0.11 | 0 | 11 | 0 | 8 / 0 | 1718, 2168 | 22 | 14 (64%) |
| tiger30preM | 21 | 2.90 | -0.28, 0.00 | 0 | 21 | 0 | 11 / 0 | 1385, 1955 | 42 | 23 (55%) |
| tiger15M | 18 | 2.94 | -0.28, 0.00 | 0 | 18 | 0 | 3 / 0 | 1325, 2081 | 36 | 22 (61%) |
| tiger15F | 17 | 2.88 | -0.13, 0.00 | 2 | 15 | 0 | 6 / 1 | 1533, 2005 | 34 | 18 (53%) |
| tiger15S | 16 | 2.88 | -0.33, -0.01 | 0 | 16 | 0 | 14 / 0 | 1422, 1955 | 32 | 16 (50%) |
| tiger30M | 44 | 2.95 | -0.35, -0.06 | 2 | 42 | 0 | 40 / 0 | 1644, 2843 | 88 | 43 (49%) |
| tiger45M | 36 | 2.89 | -0.26, 0.00 | 1 | 35 | 0 | 46 / 0 | 1802, 3019 | 71 | 33 (46%) |
| tiger60M | 52 | 2.94 | -0.39, 0.00 | 1 | 51 | 0 | 38 / 0 | 1513, 4062 | 104 | 48 (46%) |

## What the numbers say

- **Pops for the ninth-pawn rule (`nine`, dud or not):** 8 of 115 balloons in tigerR10, 15 of 152 in tigerR20. Every raid
  starts from the starting position: while he has all eight pawns and his full set nothing can land.
- **His gain a landing**, in the engine's own units: a third measure exactly 0 (the battle already decided). Pawns land
  in their band or near it (mean 1.0 to 1.4); a safe piece saturates the engine's win chances (the bands measured: a
  safe knight, bishop, rook or queen from an even position gains 7.1 to 8.0, `tiger-bands.ts`), so a piece's band is
  [7, 8.5] and the pick, the least valuable safe square, is the one nearest 7. Gains over 8.5 come from positions he was
  behind in (the saturation's other end).
- **His gain a cast:** still almost never in [0.5, 2.5] (mean −0.26, median 0.00): passing costs him a move and the engine
  sees the walls only at the crowd's root move. The walls took the engine's best move from the crowd on 70 to 74% of the
  walled turns. The FAQ no longer promises a gain for the hoops.
- **Search time:** a cast's search, median 1.5 s, at most 2.3 s on native Stockfish under load; a slow phone is several
  times slower, inside `hoopsTimeMs` (8 s) plus the landing's own `balloonTimeMs` (3 s), under the request's 15 s timeout.
