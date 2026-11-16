# Report: could Smudgy really paint a piece? (Nov 8, 2026; report only, nothing built)

Question (director, from Eric's Nov 7 bug): instead of today's workaround (a real rook drawn as a pawn: `maskedFen`,
`crowdFilter`, the "paint" refusals, `hiddenJudged`), can our own engine let Smudgy truly change a piece (a pawn into a
rook, the back-rank case too) while Maia plays his moves?

**Short answer: a real type change (pawn becomes rook) needs no new engine; a piece that is a rook but moves as a pawn
(a true "painted" piece) is only possible with our engine as both his brain and the judge, and isn't worth it.**

1. **A real type change works with the engines we have.** A paint is a position change outside a move, exactly as
   Repaint and the Camouflage swap already are: a base FEN at its ply (`setBase`), the en passant square cleared, the
   fifty-move count kept. Maia is not the blocker: `HumanUciEngine.candidates` sends `position fen <fen>` every move,
   never a move list, so Maia already plays from whatever position the base made (its 8-board history is filled from
   that one position). Stockfish (the judge, his Stockfish brain) takes any FEN it doesn't refuse (`stockfishRefuses`).
2. **What keeps it legal:** the same filter as `repaintOptions` (no side left in check, no mate in one for either side,
   the crowd left a move), plus: castling rights dropped for a painted or created rook (a rook that wasn't there can't
   castle), never more extra pieces than missing pawns (Stockfish's rule; a pawn painted into a rook always fits it),
   never a pawn on rank 1 or 8.
3. **The back-rank case splits in two.** A pawn painted into a rook on any rank is fine. A back-rank piece painted into
   a pawn is not a position any engine, chess.js or our board accepts (`stockfishRefuses`: "a pawn on the first or eighth
   rank"): it must be ruled out, or the piece must be a new kind (point 4).
4. **A true "painted" piece** (moves like a pawn, strikes like a rook) is a fairy piece. Stockfish and Maia can't
   represent it, so while it stands neither could pick his moves nor judge the crowd's. The HunChess engine
   (`packages/chess/src/hunchess/`, about 2285 Elo in ordinary chess, `reports/hunchess-engine.md`) could learn it:
   a new piece type in the 0x88 board, its moves, its value, and the search. But it would also have to become the
   judge for those turns, and fair play's signals and the judge's fairness are calibrated on Stockfish, across players'
   devices checked against each other: a second judge means recalibration and new disagreement cases.
5. **Cost.** Point 1-3 (a visible paint): one boss-lane PR, about a day; no protocol change beyond the existing power
   event. Point 4: weeks (engine piece type, judge path on devices and server, fair-play recalibration, sims), and
   Maia could not play his moves while the piece stands (he would play our engine's moves: less human-like).
6. **Risks.** A visible paint removes the surprise that is Camouflage's point (the crowd sees a rook), so it's a
   design change, Eric's call. Out-of-distribution boards (three rooks, odd pawn counts) make Maia's moves less
   human but still legal (its legal moves come from the position). A fairy piece risks the judge naming a move the
   crowd can't understand, and any engine disagreement is a fairness bug (computing priority 1).

**Recommendation:** keep Camouflage as it is (the hidden rook is the effect players feel). If Eric wants a visible
paint (a pawn really becoming a rook), build it on the Repaint path (point 1-3), never on a fairy piece.
