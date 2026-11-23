# Edges on the board layer (Nov 18, 2026)

Battle Tower PR 4 (brief: "no boss battle changes, not one move"). Sawyer's saw cut and board saw and Folio's crease moved from
each boss's `crowdFilter`, `bossStops` and `stopReason` onto the layer (`BossRules.layer`: `sawMarks`, `creaseMarks`). No behavior
change; calls made:

- **Sawyer's marks bind both sides:** the cut one "straight" edge, the board saw the eight d|e edges, "all", listed first so the
  screens still name the board saw before the cut. His `crowdFilter` is gone; `bossStops` keeps only his first move (a pawn's).
- **The crease binds the crowd:** its line's eight edges, "all". The screens' words now ask it for the side to move (`c.side` as
  the crowd) where today's checked the moving piece's color: the same for every legal move, and only legal moves are asked
  (`refusedLine`, the runner's `through`). The words still read the crease whatever its turn, as before; the dispatcher only
  while `creaseOn`.
- **Where today's code differed, it can't happen in a battle, so the layer's rule stands:** `crossesCut` matched only a cut
  stored in `edgeOf`'s order (`chooseCut` always stores it so); `crossesMiddle` read only the move's squares (a castling rook
  never crosses d|e on a normal board: the king does on long castling); castling's paths differ only in Chess960.
- **One rule:** `creaseMoves` (the crease's guard and costs) asks the crease's marks. `chooseCut` still lists edges with the
  layer's `moveEdges`; the twin checks it agrees with the layer on every edge. `crossesCut`, `crossesMiddle`, `sawStops`
  and `crossesCrease` are gone.
- **The guard:** `edge-layer-twin.test.ts` freezes today's rules and checks every turn of seeded battles (the kit's, two seeds
  each, plus the board saw and the crease switched on), both sides. A planted change (the cut binding the crowd only, the
  crease both) fails it.
