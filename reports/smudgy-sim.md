# Smudgy's calibration: Camouflage and Repaint (Oct 19, 2026)

Smudgy (id `smudgy`), the chameleon painter (docs/decisions/2026-10-19-smudgy-rules.md). Always from the starting
position. **Camouflage:** his first two moves forced (an end pawn two squares, that side's rook to its third rank),
then the rook swaps places with one of his pawns and hides as a pawn: pawn moves only until the crowd's 3rd move after
the swap, then any rook move; revealed by a strike, a check or the crowd taking it. **Repaint** (at most 2 a battle):
one of his pawns painted the crowd's color and one of its knights or bishops his, his whole turn, the pair the engine's
pick within 1.5 to 2.5 pawns of gain for him.

The rule set for the choice (the brief): place him in the pack, a crowd score of about 0.08 to 0.55 and battles of
about 33 to 57 crowd moves; one run at one setting, a second only if the first lands outside.

**The result: offset 0** (he plays at the lobby's strength). The crowd scores **0.44** (± 0.09, 26 battles) in **45**
crowd moves. At the usual −250 the crowd scored 0.69 (± 0.08): outside the pack, too easy.

## How it was run

The raid sim, as for Alfil and Chub & Chirp: a Solo raid of 50 bots against him through the match runner, one battle per
seed, seeds 1 to 13 (`a`) and 31 to 43 (`b`), no strikes, his meter on.
`npx tsx packages/sim/scripts/boss-sim.ts raid smudgy 13 <1|31> 0 <tag> [patch]` (offset 0: the patch
`{"offset": {"smudgy": 0}}`, now his roster value); rows in `reports/boss-sim/raid-<tag>.jsonl` (`smA`, `smB` at −250;
`sm0A`, `sm0B` at 0). Score: the crowd's result per battle (a win 1, a draw ½; at the 60-move cap the engine's verdict,
60% or more a win); ± is one standard error. The bots' tier is 1600: at −250 he plays at Stockfish's UCI_Elo 1350, at 0
at 1600, slipping to a random legal move 25% of the time at both. **Not repeatable seed for seed** (Stockfish draws its
limited-strength moves from the clock), so runs compare by their totals.

An earlier run, stopped after 4 battles, had the rook's lift refuse a square a crowd piece attacked: Camouflage was given
up in 3 of the 4 (the crowd's replies open a bishop onto h6 or a6 between his two moves). Since the swap follows the lift
at once, the lift now needs only to be legal (decision file, call 4); both runs below are on that rule.

## The table

| Run | Offset (his Elo) | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Crowd moves: mean (range), median |
|---|---|---|---|---|---|---|---|---|
| **sm0A, sm0B (adopted)** | **0 (1600)** | 26 | 9 | 5 | 12 | **0.44** (± 0.09) | 0.42 / 0.46 | **45** (22-60), 49 |
| smA, smB | −250 (1350) | 26 | 16 | 4 | 6 | 0.69 (± 0.08) | 0.54 / 0.85 | 53 (28-60), 60 |

The pack, the same sim: 0.04 (Jefferson) to 0.79 (Hollow) on Oct 15; on newer code Big Boy 0.35, Sawyer 0.15, Alfil
0.15, Chub & Chirp 0.31 (Leapfrog alone) and 0.48 (with the Carrot Patch).

## Camouflage

| Run | Swapped | Given up | Turns the forced moves waited | Side (h / a) | Swap after crowd move | Revealed by a strike / a check / taken | Still hidden at the end | Strike: crowd moves after the swap, median (range) | Taken: after |
|---|---|---|---|---|---|---|---|---|---|
| **offset 0** | 26 of 26 | 0 | 0 | 25 / 1 | 2 in all | 21 / 0 / 5 | 0 | **8** (3-20) | 8, 11, 14, 14, 16 |
| −250 | 26 of 26 | 0 | 0 | 25 / 1 | 2 in all | 22 / 0 / 4 | 0 | 12 (3-32) | 5, 11, 14, 21 |

- **It always comes, on time:** both forced moves on his first two turns in every battle. The h-side nearly always: the
  bots' first move opens the f1 bishop onto a6 (1.e4 or 1.e3), which rules the a-side out.
- **The strike** comes as soon as it may (3 crowd moves after the swap) in a few battles, at a median of 8; the rook is
  never still hidden at the end.
- **The crowd takes the hidden rook** in about 1 battle of 5 (5 of 26 at offset 0), always before it struck, thinking it
  a pawn (the bots see the true board, so these are trades the engine liked: the decision file, call 1).
- **No check reveals** in these runs: his brain never gave a check with the hidden rook before striking.

## Repaint

| Run | Repaints | A battle | Battles with 0 / 1 / 2 | His gain, mean (range), pawns | First, median crowd move | Turns tried with no pair in the band | Pairs weighed | Of every pair weighed: in the band / below / above (exactly 0) |
|---|---|---|---|---|---|---|---|---|
| **offset 0** | 29 | **1.12** | 5 / 13 / 8 | **1.92** (1.59-2.46) | 15 | 166 | 1,190 | 3% / 44% / 52% (25%) |
| −250 | 25 | 0.96 | 4 / 19 / 3 | 1.95 (1.53-2.49) | 19 | 360 | 2,015 | 1% / 48% / 51% (36%) |

- **The band does the work:** a pair's gain is spread wide (quartiles 0 / 3.2 / 7.7 pawns at offset 0): a knight or
  bishop painted his is often worth 4 to 8 pawns, or nothing at all when your next move takes it back. Only about 3%
  of pairs fall in 1.5 to 2.5, so he tries again turn after turn until one fits: a Repaint about once a battle, its
  gain 1.92 on average, right on the target. (A gain of exactly 0: a position already decided either way, where the
  engine's odds are at their limit and nothing moves them.)
- **The target stays 2:** every Repaint landed between 1.59 and 2.46, averaging 1.92, so a different target inside the
  band would change little; the band (Eric's) is what decides how often and how big.
- **No Repaint while the crowd has all eight pawns** (a ninth pawn is a position the engine refuses) and only his
  advanced pawns qualify (an unmoved one would stand one step from promoting for you), so the first comes mid-game
  (crowd move 15, median), a few turns after the meter fills.

## What it says

- **Offset 0, at the lobby's strength:** 0.44, in the pack, with battles of 45 moves (inside 33 to 57). At −250, 0.69
  in 53 moves: too easy. His forced opening (a wing pawn and a rook out on his first two moves) is a real cost, and
  his powers make it back only at full strength.
- **Camouflage** is reliable and short-lived: the rook hides about 8 crowd moves at offset 0, then strikes.
- **Repaint** comes about once a battle, a little under 2 pawns each time.
