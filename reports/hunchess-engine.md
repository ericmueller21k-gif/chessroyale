# The HunChess engine: strength, agreement, speed and fights (Oct 21, 2026)

Our own engine for Auto chess (docs/decisions/2026-10-21-hunchess-engine.md), measured at the fight's budget: **30,000 nodes a move**
(`fightNodes`), the same for both sides. Target (Eric, Oct 20): at least 2200 Elo. Raw data: `reports/hunchess-engine/`.

## Summary

| What | Result |
| --- | --- |
| **Match vs Stockfish 19 at UCI_Elo 2200** (300 games, ordinary chess) | **62.0%** (+170 =32 -98): **+85 Elo, 95% interval +48 to +124: about 2285 (2248 to 2324)** |
| Normal openings (150 games) | 66.3%: +118 (+65 to +177) |
| Auto-chess-like sparse starts (150 games) | 57.7%: +54 (+2 to +108) |
| Best move = deep Stockfish's (depth 16), 300 positions | 45.3% (openings 48.7%, sparse 42.0%) |
| Within 0.3 pawns of deep Stockfish's best | **74.7%** (openings 72.0%, sparse 77.3%); mean loss 29 cp |
| Time a move, this machine (Node / Chromium) | mean 39 / 37 ms, p95 61 / 59 ms, max 72 / 99 ms |
| Time a move, Chromium with the CPU throttled 4x | mean 174 ms, median 213, p95 282, **max 338: never over the fight's 350 ms**; over the fast late fight's 175 ms in 194 of 283 moves |
| Fights (80, bot armies rounds 1 to 8, the fight's rules) | 54 plies (16.7 s) a fight; ends: bare king 28, 5 checks 25, quiet 10, mate 6, move cap 6, repetition 5; White 37, Black 35, draws 8; 0.14 cash-ins a fight (9 fights of 80 had one) |

**Verdict: 2200 is met, measured.** The 95% interval's low end is 2248 over all 300 games. On the sparse starts alone (the positions
Auto chess makes) the point estimate is 2254 and the interval's low end 2202: at 2200 or above, but closer.

## The match (`packages/sim/scripts/hunchess-match.ts`)

- **Opponent:** Stockfish 19 (the full WebAssembly build, one thread, 16 MB hash) with `UCI_LimitStrength` on and `UCI_Elo` 2200, given
  **350 ms a move** (the fight's move time). **Ours:** 30,000 nodes a move (about 80 ms on this machine in Node through tsx), its table
  kept through each game.
- **Rules:** ordinary chess (castling, promotion), as the brief asks, so the comparison is fair: Stockfish knows no other game.
- **Starts:** 150, each played twice with the colors swapped: 75 normal openings (distinct lines of the repo's opening library, not
  the unusual ones, 6 to 10 plies in) and 75 sparse positions (both kings and the armies the Auto chess bot buys in rounds 1 to 8,
  4 to 10 pieces a side, from `fightStart`, no castling). Seeds 1021 and 1022.
- **Ends:** chess.js referees (mate, stalemate, threefold, fifty moves, too little material). A game both engines score at 10 pawns
  or more for the same side four plies running is adjudicated to that side (263 of 300); 300 plies is a draw (4).
  Ends: adjudicated 263, repetition 10, stalemate 7, material 7, mate 5, fifty 4, length 4.
- **By color:** as White 105.5 of 150 (70%), as Black 80.5 of 150 (54%).
- **Elo:** from the score with draws (logistic), the interval from the per-game variance (wins, draws, losses).
- **How it got there** (100-game runs, 25,000 nodes; each ±65 Elo, so single steps are within the noise): the first build scored 49%
  (-7); with exchange evaluation and an evaluation cache 52% (+14); with a pawn-threat term and passed pawns' king distance in chess
  endings 58.5% (+60); with razoring and a history malus 56% (+42, depth 8.6 to 9.1). Then the budget went from 25,000 to 30,000
  nodes (what a 4x-throttled phone still does in under 350 ms) for the 300-game run above.

## Best-move agreement (`hunchess-agreement.ts`)

300 positions: 150 from normal openings and 150 sparse starts, each played on 4 to 28 plies (openings) or 4 to 16 (sparse) by the engine
itself at 3,000 nodes. Deep Stockfish: the full build at depth 16 for its best move and score; when our move differs, Stockfish
scores our move at the same depth (`searchmoves`) and the loss is the difference. Ordinary chess rules.

| | Same move | Within 30 cp | Mean loss |
| --- | --- | --- | --- |
| All (300) | 45.3% | 74.7% | 29 cp |
| Openings (150) | 48.7% | 72.0% | 36 cp |
| Sparse (150) | 42.0% | 77.3% | 23 cp |

## Speed (`hunchess-speed.ts`)

283 positions: every move of 8 fights between bot armies played by the engine (the fight's rules), each searched to the budget with the
table carried between the moves of a fight as in the game. Chromium is Playwright's (the same V8 as a phone's Chrome) on this machine,
the CPU throttled through CDP (`Emulation.setCPUThrottlingRate`).

| Nodes | Node mean / p95 / max | Chromium mean / p95 / max | Chromium 4x mean / median / p95 / max | 4x over 350 ms | 4x over 175 ms |
| --- | --- | --- | --- | --- | --- |
| 25,000 | 33 / 57 / 74 ms | 32 / 58 / 129 ms | 148 / 173 / 252 / 389 ms | 1 of 283 | 137 |
| **30,000** | 39 / 61 / 72 ms | 37 / 59 / 99 ms | **174 / 213 / 282 / 338 ms** | **0** | 194 |
| 35,000 | 45 / 71 / 94 ms | 45 / 77 / 115 ms | 201 / 248 / 326 / 389 ms | 2 | 209 |

The engine thinks while a move's time runs (the fight waits for whichever is longer), so at 30,000 nodes a 4x-slowed phone keeps the
350 ms pace. **In the fast late fight (175 ms, after 30 moves a side) a slow phone is the limit:** at 4x a move takes 174 ms on average and up to
338 ms (over 175 ms in 194 of 283 moves), so on such a phone the late fight plays a little slower than twice as fast (on this machine,
and on a phone that isn't that slow, it keeps 175 ms). The node budget keeps both sides equal and the fight the same on every device; only the pace differs.

## Fights (`hunchess-fights.ts`)

80 fights between two bot armies (rounds 1 to 8, as `sparseStarts` makes them: the bot's buys for both sides, 4 to 10 pieces a side),
played by the real fight (`playFight`, the fight's rules) with the engine at 30,000 nodes for both sides.

- **Ends:** a side left with only its king 28, 5 checks in a row 25, 10 quiet moves each (material) 10, mate 6, 60 moves each
  (material) 6, repetition 5.
- **Results:** White 37, Black 35, draws 8.
- **Length:** 54 plies a fight on average, 16.7 s at the fight's pace.
- **Cash-ins:** 0.14 a fight (11 in 80 fights; 9 fights had one): the engine cashes a pawn in only when it is lost anyway or the
  position allows nothing better, as intended. The engine took 39 ms a move here (Node, this machine).
