# The board layer: calls made building it (Nov 18, 2026)

Battle Tower PR 1 (design: [2026-11-18-battle-tower-design.md](2026-11-18-battle-tower-design.md), "The board layer").
`packages/chess/src/board-layer.ts`; no boss reads it yet.

- **Castling is two paths** (`movePaths`): the king's and the rook's, each with its own landing and way; Chess960's
  king-onto-rook too.
- **An "all" edge** stops a move whose line between squares' middles meets it, end corners included: a whole line stops
  every crossing, knights and diagonals too.
- **Which mark is named:** a held mover, then square marks, edges, shields; within each, the layer's order.
- **Held and drawn kinds** (`frozen`, `splat`…) live in the layer; core's `StopReason` is unchanged (a core change runs
  every e2e spec). Exported through `boss-powers.ts`, not `index.ts`, for the same reason.
- **For PRs 2-5's twin tests**, where today's code differs: Boingo's own moves check `to` only; Don Dough's gold lets an
  en passant capture through; a toy block counts a castling rook's corner; `heldIn` misses a Chess960 castling rook.
