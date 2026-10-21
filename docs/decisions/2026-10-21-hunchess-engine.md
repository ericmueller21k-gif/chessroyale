# The HunChess engine: our own chess engine for Auto chess (Oct 21, 2026)

## What Eric asked for

Auto chess fights are played by an engine for both armies, and Stockfish can't be told our rules: it thought a pawn one step
from the end was about to queen (and the defender panicked about it too), and it didn't know that 5 checks in a row win or that
a bare king loses. Eric (Oct 20): "Our own engine is going to be a must." "The best players in this should also be the best chess
players still." **Target: at least 2200 Elo, proven, not guessed.** Name: **the HunChess engine**, written from scratch (no code
from Stockfish or any other engine; public algorithm knowledge only). With it, "+5 gold when a pawn reaches the end" replaces "a
pawn stops one short". How Auto chess works now: [docs/areas/autochess.md](../areas/autochess.md); the measurements:
[reports/hunchess-engine.md](../../reports/hunchess-engine.md).

## What was built

1. **The board** (`packages/chess/src/hunchess/board.ts`, exported as `@chessroyale/chess/hunchess`): a 0x88 board with piece
   lists, make/unmake, Zobrist keys, legal moves, and two rule sets. **The fight's:** no promotion: a pawn that moves onto its last
   rank (a push or a capture) **cashes in**: it leaves the board and is counted for its side; 5 checks in a row by one side win;
   a side left with only its king loses (both: a draw); 10 moves a side with no capture, cash-in or check, or 60 moves a side: the
   side with more material (P1 N3 B3 R5 Q9) wins, equal is a draw; mate, stalemate, threefold repetition, the fifty-move rule and
   too little material to mate exactly as chess.js counts them. The counters that decide results (each side's checks in a row,
   quiet plies, plies played, cash-ins) are part of the position, so the search plays toward and away from them. **Ordinary
   chess** (castling, promotion) for measuring it against Stockfish. Perft matches the published counts and chess.js move for move.
2. **The search and evaluation** (`search.ts`, `eval.ts`, `pst.ts`): iterative deepening, principal variation search with
   aspiration windows, quiescence on captures and cash-ins (all moves in check), a transposition table keyed by the position and
   the fight's counters, ordering by the table's move, captures (most valuable victim, least valuable attacker), two killers and
   history, a check extension, null-move pruning (off when the side to move has fewer than two pieces besides pawns: zugzwang),
   late-move reductions, reverse futility, futility and late-move pruning, an evaluation cache. The evaluation: material and
   piece-square values of our own shapes, blended from middlegame to endgame; the bishop pair; doubled, isolated and passed pawns
   (in a fight a passed pawn is worth little, and a pawn less in the endgame: no queen at the end); mobility; rooks on open files;
   king safety (the pawn shelter and pieces bearing on the king's squares); and the fight's rules: a side down to its last piece
   or two is close to losing, checks in a row are worth something, and a cash-in is the pawn given up plus `cashInValue` (20
   centipawns) for the gold. **A fixed node budget a move, the same for both sides, deterministic** (no randomness at all).
3. **In the game:** the engine runs in its own Web Worker (`autochess/hunchess-worker.ts`); the fight (`fight.ts`) is refereed by
   the engine's own rules code, and the bot's adjust looks use the engine. The Auto chess screen no longer loads Stockfish.
4. **Proof:** `reports/hunchess-engine.md` and the scripts `packages/sim/scripts/hunchess-match.ts`, `hunchess-agreement.ts`,
   `hunchess-speed.ts`, `hunchess-fights.ts`.

## The calls made here, and why

- **A package path of its own inside `packages/chess`** (`src/hunchess/`, exported as `@chessroyale/chess/hunchess`), not a new
  workspace package: the app, the sims and the tests already depend on `@chessroyale/chess`, so no new package, config or CI wiring.
- **The fight is refereed by the engine's rules, not chess.js.** chess.js can't play a cash-in, and one rules code for both the
  search and the referee means the engine never searches a different game from the one being played. It keeps one board for the
  whole fight and makes each move on it (never replayed from the start). chess.js still checks the engine in the tests.
- **A cash-in restarts the 10-quiet-moves count**, as a capture does: a piece has left the board for good (the old fight counted
  "fewer pieces on the board" as a capture, and a cash-in is that). It also resets the fifty-move count (it is a pawn move).
- **Cashing in your last piece loses at once** (it leaves a bare king): that is the bare-king rule as written, and the engine
  knows it, so it never does it.
- **Repetition in a fight is the true threefold, even inside the search.** Engines usually call a position repeated once inside
  the search a draw; here a checking side that repeats can still reach 5 checks in a row before the third time, so a two-fold is
  not a draw in a fight. (Ordinary chess keeps the usual two-fold shortcut.)
- **All wins score alike** (mate, 5 checks, a bare king, material at a cap): a win is a win in a fight. The damage counts the
  pieces left, but the engine plays to win, not to farm damage.
- **The cash-in on screen:** the pawn slides onto the last rank like any move (the board's knock plays), a short double coin clink
  (`acCash`, a new synthesized sound, under a move's peak and loudness like the others) and the floating "+5" from v6's
  `FloatGold` rise from that square, and 0.22 s later the pawn leaves (the board fades it out as it does a captured piece). The 5
  gold waits for the next round, like the survivors' refund, and is counted in the interest: "+ 5 from cash-ins" in the result's
  gold line (not "5 cash-ins", which would read as five pawns).
- **The fight's box:** "Pawns don't promote." became "A pawn that reaches the far end cashes in for +5 gold."
- **The worker's timeout fallback stays as it was:** 4 s without an answer plays a stand-in move (a capture if there is one, else
  a random legal move); three misses in a row and the rest of the visit plays stand-ins, so a fight always ends. A late answer is
  ignored (each request has an id). Its table is cleared when a fight starts, so a fight plays the same way every time.
- **Test switches** (only where test switches work): `?fightfen=FEN` starts the fight from a position (a cash-in can't be forced
  through the shop and the engine, so the e2e uses a position whose one legal move is a cash-in, as Smudgy's `?paint=1` does);
  `?stall=1` makes the engine never answer (the timeout path, in the e2e).
- **The match against Stockfish is played under ordinary chess rules** (promotion on), as the brief says, so the comparison is fair:
  Stockfish only knows chess. Stockfish is the full 19 build with `UCI_LimitStrength` and `UCI_Elo` 2200 at 350 ms a move (the
  fight's move time); ours searches its fixed node budget. Each start is played twice with the colors swapped; a game both engines
  score at 10 pawns or more for the same side four plies running is adjudicated to that side; 300 plies is a draw.
- **30,000 nodes a move for the fight** (`fightNodes`, was Stockfish's 6,000): the most a phone with its CPU slowed 4x still searches in
  under the fight's 350 ms on every move measured (max 338 ms over 283 fight positions; 35,000 went over twice). It measured about 2285
  against Stockfish at 2200 (95%: 2248 to 2324). In the fast late fight (175 ms) such a slow phone takes longer than the move's time on
  most moves, so its late fight runs a little slower than twice as fast; the fight waits for the engine rather than cutting its search,
  so both sides stay equal and a fight plays the same on every device.
- **8,000 nodes for the bot's adjust looks** (`bot.adjustNodes`, was 1,500 Stockfish nodes): its 17 looks take well under a second on
  a 4x-slowed phone (the step is 5 s), and HunChess nodes are cheaper and shallower than Stockfish's.
- **Strength work, measured not guessed:** the first build scored 49% against Stockfish at 2200 at 25,000 nodes; exchange evaluation,
  an evaluation cache, a pawn-threat term, passed pawns' king distance in chess endings, razoring and a history malus took it to 56 to
  58.5% (100-game runs), and 30,000 nodes to 62% over 300 games. The numbers: [reports/hunchess-engine.md](../../reports/hunchess-engine.md).
- **`e2e/areas.json`:** `packages/chess/src/hunchess/**` belongs to Auto chess's area, so a change to the engine runs its spec.
