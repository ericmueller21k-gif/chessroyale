# Auto chess: fights judged by what each side gained (Oct 21, 2026)

## What Eric asked for

After a round he won as a stall ("you're far ahead") with the bigger army: "I shouldn't get rewarded just because I play more
pieces. The opponent should be rewarded for doing better with fewer pieces, because that means that they did something right."

**The rule:** a fight that isn't won outright is judged by what each side **gained during the fight**, measured from where it
started, not by the lead at the end. One engine plays both armies, so the gain is what the placement earned.
1. **Stalls** (a threefold repetition, 10 quiet moves each, the 60-move cap) go to the side whose score improved on the start by
   `stallWinMargin` (a pawn); closer is a draw.
2. **Too far ahead** goes by gains too: a side that has gained `decisiveMargin` (5 pawns) on its start, after each of
   `decisiveMoves` (6) of its own moves in a row, wins at once. The forced-win play-out stays.
3. **Mate, a bare king, stalemate and too little material stay absolute.**

This changes [the endings decision](2026-10-21-autochess-endings.md), which judged both by the score at the end. How Auto chess
works now: [docs/areas/autochess.md](../areas/autochess.md); the numbers: [reports/autochess-gain.md](../../reports/autochess-gain.md).

## The calls made here, and why

- **One measure for every gain: the stall judge.** It is a quiescence search from a clean slate, with no node limit and no clock
  (`stallScore`). It scores the start (`startScore`, kept on the position as `gainBase`), a stall's end, and every move for the
  early end. Gain = the judge's score now less its score of the start, from White's view; Black's gain is the negative. It is the
  same on every device, and it compares like with like.
- **The early end no longer uses the engine's search score.** A deep, node-limited search score of the position now against a
  quiescence score of the start would mix two measures. A deep score for both would need a search of the start, which is not in
  the moves' searches and depends on the engine's table. With the judge's score, the early end is also independent of who chose the
  move, so a stand-in move counts like any other. The engine's own score still serves one purpose: telling a forced win it has
  found (within `mateShowMoves`), which plays out.
- **The gain is measured after each of the mover's moves.** The position is judged with the opponent to move. An exchange the move
  starts is played out by the quiescence search, so a capture that will be taken back is no gain.
- **A piece hanging at the start is no gain.** The start's score already counts its capture, because the quiescence search plays
  it. A gain is what the fight added.
- **The search knows the rule.** A stall node is a win, a loss or a draw by the same gain, and the search table's key includes the
  yardstick, since the same position is worth something else in a fight that started elsewhere. The engine's `replay` sets the
  yardstick from the game's start, so the worker's engine and the fight's referee use the same one.
- **The result line, in gain terms**, with "you" and "your opponent" as before. Whole pawns, never under 1 for a win; "a winning
  edge" if the judge saw a mate.
- **The rules box** says "Gains count, not army size" in 268 characters (280 fit at 320 px). To make room, "The engine plays both
  armies at the same strength" became "One engine plays both armies", and "A pawn that reaches the far end" became "A pawn at the far
  end".
- **Ordinary chess is untouched:** the same 629 searches give the same move, score, depth and nodes.

## Every player-visible text that changed

| Where | Before | After |
| --- | --- | --- |
| Result, stall won | `Fight stalled (<why>): you're 2 pawns up.` / `... your opponent is 2 pawns up.` | `Fight stalled (<why>): you gained 2 pawns.` / `... your opponent gained 2 pawns.` (1: `1 pawn`) |
| Result, stall drawn | `Fight stalled (<why>): less than a pawn apart, a draw.` | `Fight stalled (<why>): neither side gained a pawn, a draw.` |
| Result, the judge saw a mate | `... you're far ahead.` / `... your opponent is far ahead.` | `... you gained a winning edge.` / `... your opponent gained a winning edge.` |
| Result, early end | `You're too far ahead: 5+ pawns for 6 moves.` / `Your opponent is too far ahead: 5+ pawns for 6 moves.` | `You gained 5+ pawns and held it for 6 moves.` / `Your opponent gained 5+ pawns and held it for 6 moves.` |
| Fight rules box | `The engine plays both armies at the same strength. A side loses with only its king left, or when the engine sees it 5 pawns down for 6 moves. A stall (repeats, 10 moves each with no capture, or 60) goes to the side a pawn up. A pawn that reaches the far end cashes in for +5 gold.` | `One engine plays both armies. A side left with only its king loses. Gains count, not army size: 5 pawns gained for 6 moves wins, and a stall (repeats, 10 moves each with no capture, or 60) goes to a side that gained a pawn. A pawn at the far end cashes in for +5 gold.` |

`<why>` is unchanged: `moves repeated`, `10 moves each, no capture`, `60 moves each`. The mate, stalemate, bare-king, fifty-move and
too-little-material lines are unchanged.

## The sim, and a proposed change

The same 80 fights, before (main 7419241) and after: [reports/autochess-gain.md](../../reports/autochess-gain.md).

**It does what Eric asked:**
- The bigger army wins 46 of its 60 fights (was 54), draws 7 (was 2) and loses 7 (was 4).
- The side that started behind wins 7 (was 4).
- The early end decides 1 fight (was 46).

**It has costs:**
- **Draws nearly double:** 15 (18.8%), from 8 (10%).
- **Fights take twice as long:** a median of 20.7 s, from 10.5 s. The bigger army now has to take every piece or mate: bare
  king 42, mate 6.
- **Long king walks are back:** 9 fights have a side walking only its king for 10 moves or more (0 before), and the longest is 27.

**Proposed, not applied: `stallWinMargin` 50 and `decisiveMargin` 300.** In the sim, that gives:
- draws 12 (15%);
- the bigger army 52 / 6 / 2, and 6 wins by the side that started behind;
- 15 early ends;
- a median fight of 16.8 s;
- a longest king walk of 11 moves.

The rule itself is Eric's and stays as he set it.
