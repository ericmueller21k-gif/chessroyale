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
   other move is ignored). The scorers send it beside the plain numbers (`swapped`), so the engine server's verdict stays plain
   chess's. The re-check works on the final numbers (`recheckView`): close calls are measured from the best the game charges from,
   anchored on the judge's best or, when that is such a move, the best of the others, and such a move is never searched again (its
   score is the 250k search's of the board after the swap; the engine server never sees it). **Trust** (the review of #863): the look
   counts only where two devices gave it exactly alike (two judges agreeing, or two of three); a lone judge's (with the engine server
   on), a dispute's verdict or fallback without the other judge's look exactly alike, and a newer app's beside an older one's are one
   device's word, which nothing can check: those moves are scored as plain chess, the bots picking as plain chess has them
   (`plainOf`, `lookTrusted`, `agreedBoard`; each report with a look scores the bots' plain picks too, `plainBots`, so that board
   always holds together). An older app's report without the look abstains on it: the two are compared as plain chess, never a
   disagreement or a strike, and a bot plan made either way is never struck.
5. **Fair play:** no change. The runner's existing rule for a boss's judge that changes the numbers (written for the race) applies:
   the turn counts only when the engine's best keeps its own score in the game's numbers, and fair play then records the engine's
   own numbers; when the plain best is a check that sets off the swap, the turn doesn't count. On a turn that counts, fair play's
   numbers for a check that sets it off are plain chess's, not the game's: one the swap breaks reads as good, and one the swap helps
   (even the game's best) as plain chess's loss, which can be more than the round's (the runner's comment says so).
6. **Online hints and the eval bar** (the review of #863, finding 2; first left plain): they agree with the judge. The boss view
   names the moves it looks past with their boards (`powers.swap`, the runner's `judgeAfter`), and the app folds them in as solo does
   (`swapScores`, `swapIn`), so a paid hint never recommends the fork the judge charges as a blunder. On a turn the judge reads as plain
   chess (a lone or disputed look) the hints still show the look's value: they're advice.
7. **The bots' candidates** (finding 5): a move it looks past that isn't among the bots' top moves joins them when its score after
   the swap is above their best (`swapIn`), since the judge can name such a move its best; one below it stays out (as any move outside
   the top moves).

**Review fixes, the calls (Nov 21, the review of #863):**
- *A lone judge with no engine server keeps its look.* Then nothing checks a lone judge's numbers at all (no spot check), the look's no
  less than the rest, and its own re-check was worked out on the board with the look. With the engine server on (production) a lone
  judge's look is set aside.
- *A dispute keeps the look all or nothing:* the closer judge's look only when the other's is exactly alike, since the bots' picks
  follow every number of the look (a per-move share would leave bots picking with numbers nobody vouched for).
- *No strike for a look alone in dispute with no third device:* the verdict can't tell who lied, and a liar gains nothing but plain
  chess for that turn; with a third device two of three decide and the odd one is struck, as for any number.
- *The host scoring alone and solo keep the look:* the host's word already stands for every number (the match is unvouched).

**Cost:** one search (250k nodes) per qualifying move, on the device that scores the turn (solo: the player's; online: the host or
each judge; a player's own device for a hint or the eval bar), only while the swap is still to come, prefetched during the turn. A
random-playout count over 11,855 positions: a third of turns have one or more (0.5 a turn on average, 1.6 on a turn with any, 68% of
those exactly one). The engine server never searches a board after the swap, and its re-check never searches a move that sets it off
(before the review fix it did, when the plain best was one). Its re-check of close calls is still one search a board, as before, but
now measured on the final numbers, so it can fall on somewhat different turns (not measured). A turn
read as plain chess re-checks as before the look.
