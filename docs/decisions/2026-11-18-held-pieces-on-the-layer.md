# Held pieces on the board layer (Nov 18, 2026)

Battle Tower PR 2 (brief: "no boss battle changes, not one move"). Ginger's, Boingo's, Moo's, Folio's and Chandy's held
pieces moved from each boss's `held` list onto the layer: `BossRules.layer` (built with `heldBy`), read by `limitCrowd`
(and so `crowdAllowed`, `boardAltered`) through `layerStop`. No behavior change; calls made:

- **`heldIn` lives in the layer** (on `movePaths`) and the old one is gone: the bosses' own picks (the crowd keeps a move
  with these held) and the dock's words use the layer's rule. It differs from the old only for a Chess960 castling rook,
  and a boss battle never starts from Chess960 (`setUpStart` skips raids), so no battle changes.
- **Held marks bind the crowd** (`binds: "crowd"`): Chandy's beam can hold his own pieces in it only if they bound him,
  which they never did for his moves (`bossAllowed`); the dispatcher asks only with the crowd to move.
- **The lift stays where it was:** the layer filters, then `crowdFilter`, then `crowdAllowed` lifts both (`layerMoves`'s
  own lift would let `crowdFilter` act alone first, a change).
- **Left for later families:** `bossAllowed`, `stopReason` and `icedSquares` (drawing) don't read the layer yet (nothing
  held binds the boss, and held kinds aren't refusal reasons in core); Chandy's beam walls and `beamAllows` go with PR 3.
- **The guard:** `held-layer-twin.test.ts` keeps today's rule frozen and checks every crowd turn of seeded battles (the
  kit's, two seeds each, plus each holding power switched on); while the old hooks existed, it also matched their squares.
