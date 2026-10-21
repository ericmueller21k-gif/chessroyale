# Puddles, the hippo gardener: calibrating Seeds and Watering (Oct 21, 2026)

Puddles, the hippo gardener (id `gardener`; docs/decisions/2026-10-21-gardener-rules.md). From the starting position. **Seeds:** 5
as the battle begins, then one every 30 s of real time, up to 10. **Watering** (the rage meter): his whole turn; every
waiting seed rolls nothing 40%, a plain plant 30, a killer plant 12, a pawn 12, a knight, bishop or rook 5, the queen 1;
the engine places what came up, outcome by outcome, so his gain stays under 2.5 pawns, nearest 1.5 (a queen: nearest 6,
no cap).

The rule for the choice (the brief): place him in the pack, a crowd score of about 0.08 to 0.55 and battles of about 33
to 57 crowd moves, with about 3 waterings a battle.

**The result: shipped at offset −250 and `rageSpeed` 1.2.** With a crowd that takes 10 s to pick, after the review's
fixes (gardenM2: every position searched the same way, one line with the plants' moves left out, and the 8 s limit), the
crowd scores **0.17** (± 0.05, 26 battles) in **46** crowd moves, with **3.0 waterings** a battle of **7.4 seeds** each:
inside the pack on both counts, at its stronger end (Alfil 0.15, Moo & Moon 0.21). The same run before those fixes
(gardenM) scored 0.38 (± 0.09) with 3.4 waterings: measuring a plant's position as deeply as the one before it places
plants that matter (fewer waterings under the band's bottom: 15 of 56 undecided ones against 22 of 59), and he gains
more from them. No sweep: the number is in the range. Before the fixes, a fast crowd (5 s) scored 0.54 and a slow one (20 s, the raid's whole clock every turn) 0.19, on
13 battles each: the slower the crowd, the more seeds (5.1 a watering against 8.9) and the bigger his gain (Eric:
"playing too slowly gives him more seeds"). At `rageSpeed` 1 (a check, 13 battles) he waters 2.7 times a battle and the
crowd scores 0.23; 1.2 is the nearer to "about 3".

## How it was run

The raid sim, as for Smudgy and Moo & Moon: a Solo raid of 50 bots against him through the match runner, one battle per
seed, no strikes, his meter on. `npx tsx packages/sim/scripts/boss-sim.ts raid gardener <games> 1 0 <tag> '{"pickSec":N}'`;
rows in `reports/boss-sim/raid-<tag>.jsonl`. **His seeds need a clock:** the sim keeps one of its own (the runner's
`clock`), and each crowd turn passes the crowd's pick (`pickSec`: 5 a fast crowd, 10 the default, 20 one that runs the
raid's 20 s move clock out every turn), the reveal (2.5 s), his thinking and his move's show (3 s) and the turn's power
moments. The bots' tier is 1600: at −250 he plays at Stockfish's UCI_Elo 1350, slipping now and then as every boss this
far under its tier. His watering's placement is the host's (`waterAnswer`, `waterFrom`) on native Stockfish, the pass
guard on. Score: the crowd's result per battle (a win 1, a draw ½; at the 60-move cap the engine's verdict); ± is one
standard error. **Not repeatable seed for seed** (Stockfish's UCI_Elo moves), so runs compare by their totals. The three
main runs ran side by side on a 4-core machine (the search times below are under that load).

## The table

| Run | Crowd's pick | rageSpeed | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Crowd moves: mean (range), median | At the cap | Waterings a battle (0/1/2/3/4/5/6) | Seeds a watering (at 10) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **gardenM2 (shipped, after the review's fixes)** | **10 s** | **1.2** | 26 | 1 | 7 | 18 | **0.17** (± 0.05) | **46** (19-60), 47.5 | 8 | **3.0** (0/3/8/5/6/4/0) | 7.4 (29 of 78) |
| gardenM (before them) | 10 s | 1.2 | 26 | 8 | 4 | 14 | 0.38 (± 0.09) | 49 (21-60), 51 | 8 | 3.4 (0/1/6/7/7/3/2) | 6.9 (26 of 89) |
| gardenF | 5 s | 1.2 | 13 | 6 | 2 | 5 | 0.54 (± 0.13) | 53 (36-60), 60 | 7 | 3.8 (0/0/4/0/5/3/1) | 5.1 (2 of 49) |
| gardenS | 20 s | 1.2 | 13 | 1 | 3 | 9 | 0.19 (± 0.09) | 46 (33-60), 45 | 1 | 2.9 (0/0/5/5/3/0/0) | 8.9 (22 of 37) |
| gardenM1 (check) | 10 s | 1 | 13 | 2 | 2 | 9 | 0.23 (± 0.10) | 48 (31-60), 45 | 6 | 2.7 (0/1/6/4/0/2/0) | 7.9 (16 of 35) |

The pack, the same sim: Smudgy 0.44, Moo & Moon 0.21, Chub & Chirp 0.31, Big Boy 0.35, Alfil and Sawyer 0.15. The
first watering came at a median crowd move of 12 to 14.

## What came up

Each seed's roll, what came up, and what was rolled but came up as nothing (`dropped`: no square for it under the band's
top, or none its rules allow: a ninth pawn, a piece he has his full set of while he has all eight pawns, a killer plant
with no victim in the band).

| Run | Seeds | Rolled: nothing / plain / killer / pawn / piece / queen | Came up: nothing / plain / killer / pawn / piece / queen | Dropped: plain / killer / pawn / piece / queen |
|---|---|---|---|---|
| gardenM2 | 577 | 229 / 183 / 60 / 73 / 29 / 3 | 275 / 172 / 52 / 50 / 25 / 3 | 11 / 8 / 23 / 4 / 0 |
| gardenM | 617 | 248 / 191 / 68 / 79 / 30 / 1 | 287 / 183 / 65 / 56 / 25 / 1 | 8 / 3 / 23 / 5 / 0 |
| gardenF | 251 | 104 / 74 / 25 / 33 / 15 / 0 | 123 / 74 / 20 / 23 / 11 / 0 | 0 / 5 / 10 / 4 / 0 |
| gardenS | 328 | 142 / 89 / 36 / 42 / 18 / 1 | 165 / 87 / 34 / 26 / 15 / 1 | 2 / 2 / 16 / 3 / 0 |
| gardenM1 | 275 | 120 / 76 / 28 / 35 / 16 / 0 | 151 / 69 / 21 / 22 / 12 / 0 | 7 / 7 / 13 / 4 / 0 |

- The rolls keep the sheet's odds (gardenM: 40, 31, 11, 13, 5 and 0.2 percent).
- **Pawns are the most dropped** (23 of 79 in gardenM): a ninth pawn is a position the engine refuses, so while he has
  all eight none can grow; the rest are dropped where every square tried was over the top.
- **Killer plants on his own pieces: 2 of 65** in gardenM (1 of 34 in gardenS, none in the fast run): only when none of
  the crowd's keeps the band, and then only one that lands within it.
- **gardenM2:** 1 killer plant of 52 on his own pieces; 3 jackpots in 26 battles (gains 7.27, 4.08, and 0 in a battle
  already decided).
- **Jackpots: 2 queens in 65 battles** (the runs before the fixes). One in gardenS, a queen and a pawn with four plain plants (his gain 14.5: a won
  game, as Eric allowed); one in gardenM at crowd move 47 in a battle already decided (gain 0 by the engine's measure).

## His gain a watering

In pawns of log-odds of the engine's win chances (bouncePawnLogit), his evaluation after it (the crowd to move) against
before it (him to move). Those saturate: once the engine calls the battle decided either way, any watering measures
exactly 0 (30 of 89 in gardenM, mostly late in battles he was winning). Of the rest:

| Run | Waterings (not decided) | Mean | Median | Under 0.5 | Below 0 | Over 2.5 | Waits (the pass guard; no answer) |
|---|---|---|---|---|---|---|---|
| gardenM2 | 56 | 0.95 | 1.02 | 15 | 6 | 0 | 22; 1 |
| gardenM | 59 | 0.75 | 1.06 | 22 | 9 | 0 | 21; 2 |
| gardenF | 31 | 0.87 | 1.19 | 11 | 5 | 0 | 16; 3 |
| gardenS | 26 | 1.23 | 1.46 | 6 | 1 | 0 | 9; 0 |
| gardenM1 | 25 | 1.17 | 1.24 | 3 | 2 | 0 | 10; 0 |

- **Band misses: none over the top** (bar the jackpot, by design). Under the bottom: about a third of the undecided
  waterings, those that came up small (plain plants and nothing, a pawn with no square to stand on safely); dropping
  outcomes could only lower them, so they're played as they came. Below 0: a watering of plants only, where passing his
  turn cost more than the plants gained (never by `passGuardPawns` or more: then it waits).
- **Waits:** a watering due with a piece of his hanging waits a turn (the pass guard), about one due turn in five; "no
  answer" is a turn the pass alone wasn't a position a watering may leave (it handed the crowd a mate in one). It comes
  on his next turn, with whatever seeds landed since.
- No watering came up with nothing at all in the medium run (a shrug); 6 did with the fast crowd's small counts.

## The search

Positions searched a watering (the budget is 48 beside the one before, at 20,000 nodes each): mean 16.9, at most 36 in
gardenM2 (15.7 and 44 in gardenM); gardenM2's time: mean 1.4 s, at most 3.6 s, none near the 8 s limit (`waterTimeMs`). Time on native Stockfish (one thread, the machine shared by three sims): mean 1.2 s, at most 3.8 s; 1.6 s and 4.2
s with the slow crowd's bigger counts. A phone's Stockfish is a few times slower, so its worst case nears the boss
request's 15 s timeout, as Repaint's does (the same node budget); a host that runs out of time leaves the watering
waiting a turn (the server's timeout answers "", and he moves). Worth measuring on Eric's phones once he's wired.
