# The circus tiger: calibrating Balloons and Hoops (Oct 23, 2026)

The circus tiger (id `tiger`; docs/decisions/2026-10-23-tiger-rules.md). From the starting position, as every raid.
**Balloons:** a balloon on his nozzle at the start of his turn, 4 stages on the battle's clock, then at the end of a turn it
lands as his piece (the engine keeps his gain in the shape's band) or pops (pawn 55% / pops 12, knight 13 / 25, bishop 13 /
25, rook 6 / 35, fake queen 10 / always, queen 3 / never). **Hoops** (the rage meter): his whole turn, three 2x2 blocks walled
for the crowd's next 2 moves, the engine's pick nearest 1.5 pawns in [0.5, 2.5].

The rule for the choice (the brief): place him in the pack, a crowd score of about 0.08 to 0.55 and battles of about 33 to
57 crowd moves, about 3 casts a battle; choose his offset and rage speed (and, Eric's accepted default, the stage time).

**The result: shipped at offset −250, `balloonStageSec` 30 and `rageSpeed` 1.4.** With a crowd that takes 10 s to pick
(tigerM), the crowd scores **0.14** (± 0.10, 14 battles) in **38** crowd moves, with **2.2 casts** a battle and **4.6
balloons** placed a battle (2.6 landed, 0.9 popped, the rest still on the nozzle at the end): inside the pack (Alfil 0.15,
Puddles 0.17, Moo 0.21). A fast crowd (5 s) scores 0.19 (± 0.13, 8), a slow one (20 s, the raid's whole clock every turn)
0.00 (8): the slower the crowd, the more balloons (3.5 against 6.8 a battle).

- **Eric's 15 s stages made him far too strong:** the crowd scored 0.00, 0.06 and 0.00 (29 battles over three crowd speeds),
  about four balloons landing a battle. The offset can't weaken him further: at −250 against the 1600 tier he plays at
  Stockfish's floor (1350) and slips at the cap already (`bossStumbleMax`). So the stage time is the knob: a sweep at
  `rageSpeed` 2 (10 battles each) gave 0.40 at 30 s, 0.30 at 45 s and 0.50 at 60 s, the battles long (48 to 57 moves, many at
  the 60-move cap) with 3.6 to 5.2 casts; 30 s keeps the most of Eric's pump (a balloon every two minutes) and with
  `rageSpeed` 1.4 the battles shorten into the range.
- **Casts: 2.2 a battle**, short of "about 3": the meter fills at 1.4 (2.0 gave 4.4 a battle in longer battles), and the pass
  guard has a cast wait when passing would lose real material (13 waits in 14 battles), which holds the meter full.
  `rageSpeed` 1.6 to 1.8 would likely give about 3 (not run: one setting, as the testing budget asks).

## How it was run

The raid sim, as for Puddles: a Solo raid of 50 bots against him through the match runner, one battle per seed, no strikes,
his meter on. `npx tsx packages/sim/scripts/boss-sim.ts raid tiger <games> <seed> 0 <tag> '{"pickSec":N}'` (the sweep:
`"powers":{"balloonStageSec":S,"rageSpeed":{"tiger":R}}`); rows in `reports/boss-sim/raid-<tag>.jsonl`; the tables below
from them. **His balloons need a clock:** the sim keeps one (the runner's `clock`): each crowd turn passes the crowd's pick
(`pickSec`), the reveal (2.5 s), his thinking and his move's show (3 s) and the turn's moments. His landings (`landFrom`) and
casts (`hoopsFrom`) are the host's code on native Stockfish. Score: a win 1, a draw ½ (at the 60-move cap the engine's
verdict); ± one standard error. Not repeatable seed for seed (Stockfish's UCI_Elo), so runs compare by their totals; three
ran side by side on a 4-core machine. **Runs:** tigerM/F/S are the shipped code. tiger30pre (before a landing's squares were
ordered by the crowd's real attacks) and tiger30lo (before a cast's blocks were ordered by how many crowd moves they stop)
are the same settings on earlier code, stopped part way when the code changed; tiger15 is Eric's 15 s; tiger30/45/60 the
sweep at `rageSpeed` 2.

## The tables

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

- **Pops for the ninth-pawn rule (`nine`):** 5 of 64 balloons in tigerM (all pawns), 6 of 54 in the slow run: every raid
  starts from the starting position, and while he has all eight pawns and his full set nothing can land, so early
  balloons pop until he loses a pawn or a piece.
- **His gain a landing:** a third to a half measure exactly 0 (the battle already decided by the engine's measure: its win
  chances saturate). Of the rest, **pawns land in their band** (mean 0.9 in tigerM), but **pieces mostly land over theirs**
  (knights 5.7, bishops 4.1, rooks 7.1): in the engine's log-odds a safe knight from an even position is already 4 to 6
  pawns, a rook or queen saturates near 7, so the bands for the pieces (from the brief) are mostly out of reach below.
  The pick is then the nearest above, never a piece left hanging to fit (the squares the crowd attacks come last). A
  re-measured band per piece (in the engine's own scale) would be the fix if Eric wants them in band; flagged, not changed.
- **His gain a cast:** never in [0.5, 2.5]: mean −0.30, median 0.00 (a decided battle measures 0). Passing costs him a move,
  and the walls only restrict the crowd's root move in the engine's eyes (it can't be told about walls deeper), so the
  measured gain is about the tempo less what the walls take. The pick is the one nearest 1.5, which is the one that bites
  hardest. **The walls took the engine's best move from the crowd on 76% of the walled turns** (47 of 62): they bite in
  play more than the one-ply measure shows.
- **Search time:** a cast's search on native Stockfish, median 1.4 s, at most 2.1 s (under load, 3 runs on 4 cores); a slow
  phone is several times slower, inside `hoopsTimeMs` (8 s, then the blocks so far) and the request's 15 s timeout.
