# A draw on his move clears the turn's events (Nov 18, 2026)

- The cause (review of #787, finding 4): when his move ended the battle by a draw, `preparePowers` returned before
  `prepareTurn` could replace the turn's events, so every moment of that turn (the turn-start ones and those that play
  while he thinks: Moo's Full Moon, Folio's fold and Revision, Don Dough's dough, Chandy's shot, Ginger's Super Freeze)
  replayed before the result, and `bossTurnShowMs` waited for them again.
- The call: fix it once in the runner, not per kind. At game over after his move the turn's events are cleared, as a new
  turn would clear them (his fifth carrot's win still sets up its own turn). No list of "thinking" kinds to keep in step.
