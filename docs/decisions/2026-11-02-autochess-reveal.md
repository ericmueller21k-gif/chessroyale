# Auto chess: the reveal while you buy (Nov 2, 2026)

**Eric (Nov 1-2):** make the reveal fair and strategic. Live circles; a reveal every 3 s, alternating sides, piece for piece by
kind (pawn with pawn, knight or bishop with knight or bishop, rook with rook, queen with queen), so unmatched pieces stay
hidden; whoever placed first keeps that piece hidden longer; everything shows at the move step. On screen (his simplified
look): your pieces slightly grayed until the opponent has seen them, the next one with a thin 2 px yellow border, no green.

**The calls made** (`packages/app/src/autochess/reveal.ts`, tested in `autochess-reveal.test.ts`):

- **The 2 s delay is gone** (`circlesDelaySeconds` 0, kept as a setting). No reason was recorded beyond Eric's Oct 19 design
  and keeping their gold and bench in step with the circles; with "placing first pays" you must see who placed first. Their
  bench, gold spent and level are live too, as they were tied to the circles.
- **Order:** in each group the two sides' unrevealed pieces pair up in placement order (first with first). The pair that formed
  first (the earlier "later placement") opens first; a tie goes pawns, minors, rooks, queens. Within a pair the later-placed
  piece shows first and the other side's answers on the next tick. So reveals alternate within a pair; across pairs the same
  side can show twice in a row (its piece answered one pair, then opened the next).
- **Your next** (the yellow border): the piece of yours the coming ticks reveal first if nothing changes: the answer you owe,
  else yours in the next pair to open. That is your earliest-placed unrevealed piece of the earliest-formed pair. None when no
  tick is left (an answer that would fall after 27 s waits for the move step).
- **Sold:** it leaves its pair. If its side owed the answer, the next unrevealed piece of the group answers; with none the pair
  is broken and that tick opens the next pair. A revealed piece sold is gone. **Moved:** there is no board-to-board move while
  buying today; the rules keep a moved piece's place in the order and a revealed one stays revealed.
- **The last tick (27 s)** can open a pair whose answer comes only at the move step (3 s later, by then locked anyway).
- **Same for the bot as for a person:** one pure function of both boards' change logs and the time. The bot doesn't read what it
  sees (it never did). There is no online auto chess.
