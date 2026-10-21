# Auto chess: how fights end (Oct 21, 2026)

> **Changed later the same day: stalls and the early end go by what each side gained during the fight, not by the lead at the end**
> ([autochess-gain](2026-10-21-autochess-gain.md); Eric: "I shouldn't get rewarded just because I play more pieces"). The result
> lines below were reworded to match. The rest stands.

## What Eric asked for

Eric watched HunChess fights ([the engine](2026-10-21-hunchess-engine.md), merged the same day) and wants them to end cleaner:
"The last thing we want to see is just the king moving around for 10 to 15 moves." On deciding stalled fights by counted material:
board material favors whoever bought more, captured material punishes a sacrifice for position. The agreed answer: **decide by the
engine's own score (material and position).**

1. **No more "5 checks in a row win".**
2. **A stall is decided by the score:** a threefold repetition, the quiet cap (10 moves a side) and the move cap (60 a side) go to
   the side the HunChess score of the final position favors by at least `stallWinMargin` (100 centipawns, a pawn); closer is a draw.
   Deterministic (the same fight gives the same result on any device), and the search knows the rule. Stalemate and too little
   material stay draws, as in chess; the fifty-move rule stays (the quiet cap comes first).
3. **The clean-up ends early:** a side the score favors by `decisiveMargin` (500, 5 pawns) for `decisiveMoves` (3 in the brief; 6
   since the sim, see below) of its own moves
   in a row wins at once (the end `decided`), unless the engine has found it a forced mate within `mateShowMoves` (5) moves, which
   plays out.
4. **Checks no longer restart the quiet count.** Only a capture or a cash-in does.
5. **Faster when it thins out:** moves play at `fightFastMoveMs` once either side is down to its king and pawns, as well as after
   `fightFastAfter` moves a side.
6. **The result says why.**
7. **A slower pace** (Eric, on PR #305: "I think 7 seconds is too short. For fights, they should take a little bit longer."):
   `fightMoveMs` 350 to 600 ms, `fightFastMoveMs` 175 to 300 ms (after 30 moves a side, or once a side is down to king and
   pawns); the target was a typical fight of about 12 to 15 s.

How Auto chess works now: [docs/areas/autochess.md](../areas/autochess.md); the numbers:
[reports/autochess-endings.md](../../reports/autochess-endings.md).

## What was built

- **The engine** (`packages/chess/src/hunchess/`): the check streak is gone everywhere (`checksToWin`, the `checks` end, the per-side
  counters and their undo stack, their part of the search table's key, the evaluation's streak term). `Position.result()` marks a
  fight's repetition or cap as a **stall** (winner not yet known); `judgedResult()` (index.ts) judges it with `stallScore()`. A check
  no longer restarts the quiet count. The counted-material code (`capMaterial`, `CAP_VALUE`) is gone: nothing uses it now.
- **The fight** (`packages/app/src/autochess/fight.ts`): refereed by `judgedResult()`; counts each side's own moves in a row at
  `decisiveMargin` or more by the engine's score for the move it played, and ends the fight `decided` at `decisiveMoves`; plays fast
  when thin. The engine's worker already sent its score; `enginePick` now passes it on with the move.
- **The words** (`words.ts`, the screen): the result line and the fight's rules box (now `fightRulesWords`, tested), the move counter.
- **The sim** (`packages/sim/scripts/hunchess-fights.ts`): the real pace (the fight's own waits), length average, median and longest,
  how the bigger army does, the longest king-only stretches, and `set.<setting>=<n>` to try other numbers.

## The calls made here, and why

- **The stall's score is a quiescence search of the final position, not the last search's score.** Captures and cash-ins are played
  out to the end (every move when in check), so a piece left hanging on the last move isn't counted as if it were safe; a static
  evaluation alone would. It has **no node limit and no clock**, and starts from a clean slate (nothing kept from earlier searches),
  so it is the same on every device; it is a few milliseconds and runs on the page's thread, where the fight is refereed (the
  worker can time out; the referee must not). The last full search was rejected: its score is the mover's view of the position
  *before* its last move, a stand-in move has none, and it depends on the table carried over from earlier moves.
- **Inside the search a stall is valued by the same judgment:** at a stall node the search runs the same quiescence (with no rule
  ending its lines) and scores the node as a win, a loss, or a draw within the margin. So the side a pawn up steers toward a stall and
  the side behind steers away (tested: the side behind no longer takes a threefold repetition that chess would call a draw).
- **The two-fold shortcut is back in a fight:** a position repeated once inside the search counts as a stall. It was off only
  because a checking side could repeat and still reach 5 checks before the third time; with no streak that reason is gone, and the
  shortcut is the usual one. (Ordinary chess always had it.)
- **A win by a rule other than mate (a bare king, a won stall) scores `RULE_WIN - ply`, 500 under a mate's `WIN - ply`.** A win is
  still a win, but a found mate can now be told apart from other wins (`mateMoves`, `winMoves`), and a mate is preferred.
- **The early end uses the engine's score for the move it played** (its fixed node budget: deterministic, as the moves are). A
  stand-in move (the engine silent or wrong) counts for nothing and starts that side's count again. The count is checked after the
  move is played and shown; a mate, a bare king or a stall that move makes comes first.
- **A forced win by another rule plays out too, not only a mate.** When the engine sees that it takes the last enemy piece, or wins
  a stall, within `mateShowMoves`, its score is a win's (near 29,500), not a lead of so many pawns: a side 1.2 pawns up with a stall
  in sight would otherwise be ended as "5+ pawns ahead". Those fights end by their own rule within a few moves anyway. A found win
  further off than `mateShowMoves` is decided as usual.
- **The early end is not in the search.** It only stops a fight that side is already winning by a lot; nothing the side behind can
  play changes that, and the search already plays for the biggest edge.
- **"Thin" is computed before each move** from the board: either side with no knight, bishop, rook or queen. The move counter shows
  "twice as fast" from then on, as it does after 30 moves.
- **The result line** names the reason, and the sides as the rest of the screen names them: **"you" and "your opponent"**
  ("You lose 5 HP.", "Your opponent is moving their pieces…"). The first build said "White" and "Black", but your color changes
  every round (White in round 1, then Black, and so on: only the title says "Round 2 · you play Black"), so at the result a player
  would have to work out which side they were. "You" can't be misread, and it is as short at 320 px.
  - a stall: `Fight stalled (<why>): you're <n> pawn(s) up.` or `... your opponent is <n> pawn(s) up.`, or
    `... less than a pawn apart, a draw.`; the why is `moves repeated`, `10 moves each, no capture` or `60 moves each`. Whole pawns,
    rounded (1.5 is 2), never under 1 for a win; `far ahead` if the judge saw a mate. "No capture" leaves out "or cash-in" to stay
    short on a 320 px phone (a cash-in is rare: 0.14 a fight before, fewer now); the rules box says the same.
  - the early end: `You're too far ahead: 5+ pawns for 6 moves.` or `Your opponent is too far ahead: 5+ pawns for 6 moves.` (the
    numbers come from the settings).
  - mate, stalemate, a bare king, the fifty-move rule and too little material keep their lines.
- **The rules box** while the fight plays was rewritten for the new rules (it said "until mate or 5 checks in a row"). It must fit
  the box at 320 px (the layout e2e checks it): a first, fuller version (388 characters) didn't, so the speed-up sentence went (the
  move counter already says "twice as fast") and the words are as short as the old box's (280 characters).
- **Settings:** `checksToWin` removed; `stallWinMargin` 100, `decisiveMargin` 500 and `mateShowMoves` 5 as Eric set them;
  **`decisiveMoves` 6, not the brief's 3**: the sim below found 3 ended 31 of 80 fights after 3 moves a side, and the director
  approved the change on PR #305.
- **Tests:** the engine's (stalls judged the same every time, the side behind avoiding a lost repetition, mates told from other
  wins), the fight's (stalls by the score, checks no longer winning or restarting the count, the early end and its exceptions,
  the speed-up when thin, a real-engine fight far ahead ending early), the words, and an e2e at 320 px that plays two of the sim's
  fights (`?fightfen=`) and checks their exact result lines: a quiet-cap stall your opponent wins by a pawn, and you too far ahead.
- **Ordinary chess is untouched:** 629 searches from 40 openings give the same move, score, depth and node count before and after,
  so the Stockfish match wasn't rerun.

## Every player-visible text that changed

| Where | Before | After |
| --- | --- | --- |
| Result, 5 checks | `5 checks in a row count as mate.` | (gone) |
| Result, repetition | `Draw by repetition.` | `Fight stalled (moves repeated): you're 2 pawns up.` / `Fight stalled (moves repeated): your opponent is 2 pawns up.` / `Fight stalled (moves repeated): less than a pawn apart, a draw.` |
| Result, quiet cap | `10 moves each with no capture or check: more material wins.` / `10 moves each with no capture or check, and equal material.` | `Fight stalled (10 moves each, no capture): your opponent is 1 pawn up.` (or `you're 1 pawn up.`) / `Fight stalled (10 moves each, no capture): less than a pawn apart, a draw.` |
| Result, move cap | `60 moves played: more material wins.` / `60 moves played with equal material.` | `Fight stalled (60 moves each): you're 6 pawns up.` (or `your opponent is 6 pawns up.`) / `Fight stalled (60 moves each): less than a pawn apart, a draw.` (any stall, if the judge saw a mate: `... you're far ahead.` / `... your opponent is far ahead.`) |
| Result, early end (new) | | `You're too far ahead: 5+ pawns for 6 moves.` / `Your opponent is too far ahead: 5+ pawns for 6 moves.` |
| Fight rules box | `The engine plays both armies at the same strength until mate or 5 checks in a row, a draw, 60 moves each, or 10 each with no capture or check. A side left with only its king loses. After 30 moves each, moves play twice as fast. A pawn that reaches the far end cashes in for +5 gold.` | `The engine plays both armies at the same strength. A side loses with only its king left, or when the engine sees it 5 pawns down for 6 moves. A stall (repeats, 10 moves each with no capture, or 60) goes to the side a pawn up. A pawn that reaches the far end cashes in for +5 gold.` |
| Move counter | `Move 12 of 60 · twice as fast` after 30 moves each | the same, and also once a side is down to its king and pawns |

## The sim, and the change to 6 moves

The same 80 fights as the engine's report, before (main, e709a59) and after: [reports/autochess-endings.md](../../reports/autochess-endings.md).
As shipped (`decisiveMoves` 6):
- **Ends:** too far ahead 39, quiet cap 17, bare king 15, mate 7, repetition 2. Before: bare king 28, 5 checks 25, quiet 10,
  mate 6, move cap 6, repetition 5.
- **Draws:** 7 (before 8).
- **Length in moves a side:** 13.4 on average, 11.8 at the median, 40 at most (before 27, 22, 60).
- **Length in seconds, at the new pace (600 / 300 ms):** 14.1 on average, 12.0 at the median, 42.0 at most. At the old pace
  (350 / 175 ms) the same fights took 8.3, 7.0 and 24.5; before this change, fights took 16.7, 15.4 and 31.5.
- **The bigger army** wins 61, loses 3 and draws 2 of 66 uneven fights (before 61, 2, 3).
- **Longest king-only stretch:** 10 plies (before 14). One side's longest king walk: 11 moves (before 16).
- **Cash-ins:** 0.03 a fight (before 0.14).
- **Winners:** 76 of 80 fights have the same winner as before.

**Why 6, not 3:** with the brief's 3, 31 of 80 fights were over after 3 moves a side, about 2 s. The bot armies are often lopsided
from the start, so the engine sees one side 5 pawns up at once. I proposed 6 and the director approved it on PR #305. With 6, no
fight ends inside 6 moves a side except by mate or a bare king, and the winners and the draw rate are the same as with 3. A bigger
`decisiveMargin` (800, 1000) was tried too: it keeps lopsided fights going longer, and the king walks come back.

## The pace

- **600 ms a move, 300 ms when fast** (the director's numbers, from Eric's "a little bit longer"). The rules and the moves are
  unchanged; the engine searches a fixed number of nodes, so the fights are identical and only the seconds change.
- **The median fight is 12.0 s, the bottom edge of the 12 to 15 s target** (average 14.1 s; a quarter of fights are under 6.6 s,
  a quarter over 21 s). **650 ms (325 fast) would give a 13.0 s median**, and 700 ms gives 14.0 s; left at 600 until Eric or the
  director says.
- **Nothing else depended on the old pace.** The worker's 4 s fallback is its own timeout, and the e2e tests run with `?quick=1`,
  which sets its own 60 / 30 ms. The engine now has room to spare: its node budget was sized to fit 350 ms on a phone with its
  CPU slowed 4x. Only the unit tests that check the numbers changed.
