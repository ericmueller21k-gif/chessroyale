# Auto chess: fights judged by what each side gained (Oct 21, 2026)

## What Eric asked for

After a round he won as a stall ("you're far ahead") with the bigger army: "I shouldn't get rewarded just because I play more
pieces. The opponent should be rewarded for doing better with fewer pieces, because that means that they did something right."

**The rule:** a fight that isn't won outright is judged by what each side **gained during the fight**, measured from where it
started, not by the lead at the end. One engine plays both armies, so the gain is what the placement earned.
1. **Stalls** (a threefold repetition, 10 quiet moves each, the 60-move cap) go to the side whose score improved on the start by
   `stallWinMargin`; closer is a draw.
2. **Too far ahead** goes by gains too: a side that has gained `decisiveMargin` on its start, after each of `decisiveMoves` (6) of
   its own moves in a row, wins at once. The forced-win play-out stays.
3. **Mate, a bare king, stalemate and too little material stay absolute.**

**The margins: `stallWinMargin` 50 (half a pawn) and `decisiveMargin` 300 (3 pawns)**, retuned from 100 and 500 after the first
build's sim. The director approved the change on PR #310; tuning the margins is within the brief, and the rule stays Eric's.

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
- **The result line, in gain terms**, with "you" and "your opponent" as before. A gain of a pawn or more is said in whole pawns
  ("2 pawns", "1 pawn"). Since half a pawn wins a stall, a gain under a pawn is "the edge", never "0 pawns"; a draw is "neither
  side gained the edge". "A winning edge" means the judge saw a mate.
- **The rules box** says "Gains count, not army size" in 268 characters (280 fit at 320 px). To make room, "The engine plays both
  armies at the same strength" became "One engine plays both armies", and "A pawn that reaches the far end" became "A pawn at the far
  end". A stall "goes to the side that gained more", not "gained a pawn": half a pawn decides it now.
- **Ordinary chess is untouched:** the same 629 searches give the same move, score, depth and nodes.

## Every player-visible text that changed

| Where | Before | After |
| --- | --- | --- |
| Result, stall won by a pawn or more | `Fight stalled (<why>): you're 2 pawns up.` / `... your opponent is 2 pawns up.` | `Fight stalled (<why>): you gained 2 pawns.` / `... your opponent gained 2 pawns.` (1: `1 pawn`) |
| Result, stall won by under a pawn (new: half a pawn wins) | | `Fight stalled (<why>): you gained the edge.` / `... your opponent gained the edge.` |
| Result, stall drawn | `Fight stalled (<why>): less than a pawn apart, a draw.` | `Fight stalled (<why>): neither side gained the edge, a draw.` |
| Result, the judge saw a mate | `... you're far ahead.` / `... your opponent is far ahead.` | `... you gained a winning edge.` / `... your opponent gained a winning edge.` |
| Result, early end | `You're too far ahead: 5+ pawns for 6 moves.` / `Your opponent is too far ahead: 5+ pawns for 6 moves.` | `You gained 3+ pawns and held it for 6 moves.` / `Your opponent gained 3+ pawns and held it for 6 moves.` |
| Fight rules box | `The engine plays both armies at the same strength. A side loses with only its king left, or when the engine sees it 5 pawns down for 6 moves. A stall (repeats, 10 moves each with no capture, or 60) goes to the side a pawn up. A pawn that reaches the far end cashes in for +5 gold.` | `One engine plays both armies. A side left with only its king loses. Gains count, not army size: 3 pawns gained for 6 moves wins, and a stall (repeats, 10 moves each with no capture, or 60) goes to the side that gained more. A pawn at the far end cashes in for +5 gold.` |

`<why>` is unchanged: `moves repeated`, `10 moves each, no capture`, `60 moves each`. The mate, stalemate, bare-king, fifty-move and
too-little-material lines are unchanged.

## The sim

The same 80 fights, before (main 7419241) and after: [reports/autochess-gain.md](../../reports/autochess-gain.md).

**After (gains, 50 / 300) against before:**
- **Ends:** bare king 28, quiet cap 27, too far ahead 15, mate 7, repetition 3.
- **Draws:** 12 (15%), from 8 (10%).
- **The bigger army** wins 52 of its 60 fights, loses 6 and draws 2 (was 54 / 4 / 2).
- **The side that started behind** wins 6 (was 4).
- **The early end decides** 15 fights (was 46).
- **Length:** a median of 17.3 moves a side and 16.8 s (was 10.5 and 10.5 s); the longest is 42.3 s, as before.
- **Winners:** 68 of 80 fights have the same winner.

**First build (100 / 500), for comparison:** draws 15 (18.8%), the bigger army 46 / 7 / 7, the early end 1, a median of 20.7 s, and
long king walks back (9 fights with a 10-move walk, the longest 27).

**The long king walks:** 5 fights still have a side walking only its king for 10 or 11 moves (0 before). Each takes 5.7 to 6.3 s,
all at the fast pace (0.3 s a ply), and three of the five end at the quiet cap, which bounds them.

**Two rule-free fixes tried, neither proposed:**
- `quietCap` 8 cuts those walks to 2, but raises draws to 18.8% and makes the longest walk 14 moves.
- `decisiveMoves` 4 doesn't touch the walks.
