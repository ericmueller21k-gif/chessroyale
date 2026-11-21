# The judge scores a check that sets off Sawyer's Saw Swap on the board after it (Nov 21, 2026)

**Eric, Nov 21** (the director: "make the engine score that checking move as if the swap happens. It's predictable (it always fires
the first time it can) ... The game already does the same thing for Jefferson's candle."): "Yeah, that sounds good." This closes the
gap call 5 of `2026-11-20-sawyer-saw-swap.md` accepted (the review of #856: a checking fork scored as winning the rook, though the
swap breaks it).

**Built:** while the swap is still to come, every crowd move that would set it off is scored on the board after the swap, him to move:
the crowd's expected score there (the best line of the board's top-moves search, read from the crowd's side). Every other move, and
every move once the swap's used, as before. The best move, each move's loss, the bots' picks, solo's hints and eval bar, the meter's
judged number and the God King's Last Stand all follow. How it runs: docs/areas/engine.md, "Judging past a power".

**Calls:**
1. **Which moves:** `sawyerBattle.judgeSwaps`, the swap's own rules a move ahead (one predicate, `swapToCome`, for both): still to
   come, not a tower floor with `sawSwapInTower` off, not the move cap, never a move that ends the game on the board (a mate stands),
   and `sawSwapFen`. A side of several bosses gets none (which boss moves after the crowd isn't settled until it lands; such sides
   exist only on tower floors, where the swap is off). Revisit if `sawSwapInTower` goes on.
2. **All of them, searched up front** (not only the top moves and picks): a fixed list known as the turn begins, so the devices
   prefetch the boards with the turn's own while players think (no wait at scoring), two judges search exactly the same, the lobby
   checks the report has exactly those moves, and a move outside the top moves that the swap makes best counts for the best move.
3. **The search:** the top-moves search every position gets (`TopMovesCache`, MultiPV `botCandidateMoves` at `engineNodes`), so it
   is prefetched and reused alike; the move's score is 1 minus his best line's. Its reply and mate are dropped (they're his answers
   on the board without the swap): the Last Stand fires on the swapped numbers and names no reply for such a move.
4. **Applied once, in `resolveBoard`** (`swapJudged`), for the moves the runner finds set it off itself (a host's number for any
   other move is ignored). The scorers send it beside the plain numbers (`swapped`), so the re-check and the engine server's verdict
   stay plain chess's and unchanged; such a move isn't re-checked deeper (its score is the 250k search's). Two judges' looks must
   match exactly (`boardsAgree`); a verdict keeps only the looks both give alike (`sharedSwaps`), the rest scored as they stand.
   An older app's report without them is read as plain (no strike).
5. **Fair play:** no change. The runner's existing rule for a boss's judge that changes the numbers (written for the race) applies:
   the turn counts only when the engine's best keeps its own score, and fair play then records the engine's own numbers; when the
   plain best is a check that sets off the swap, the turn doesn't count.
6. **Online hints** don't read boss rules today (the fire's neither): left as they are.

**Cost:** one search (250k nodes) per qualifying move, on the device that scores the turn (solo: the player's; online: the host or
each judge), only while the swap is still to come, prefetched during the turn. A random-playout count over 11,855 positions: a third
of turns have one or more (0.5 a turn on average, 1.6 on a turn with any, 68% of those exactly one). Never the engine server: $0.
