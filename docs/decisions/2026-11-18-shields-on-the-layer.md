# Shields on the board layer (Nov 18, 2026)

Battle Tower PR 5 (brief: "no boss battle changes, not one move"). Don Dough's Gold Plate (no pawn of the crowd's takes a gold
piece) and Chandy's shields (the crowd takes no shielded piece this turn) moved from each boss's `crowdFilter` and `stopReason`
onto the layer: piece marks with `shieldFrom` (`goldMarks`: `"pawns"`; in `chandyMarks`: `"all"`), binding the crowd, as before.
No behavior change; calls made:

- **PR 1's listed difference can't happen in a battle, so the layer's rule stands:** the layer stops an en passant capture of a
  shielded piece and the old gold check didn't, but gold never sits on a pawn (Gold Plate never gilds a pawn or king, and gold
  follows its piece). The old check also looked at the landing square, not the piece taken; a gold square always holds his gold
  piece (`goldAfter` keeps it in step, and nothing else empties a square in his battles), so the two are the same. Chandy's
  `capturedSquare` and the layer's taken square agree on every legal move.
- **One rule, not two:** the powers' own looks ask the same marks: Don Dough's "a pawn could take gold" turn (fair play skips
  it) and Chandy's last chance (`mateOpen`). The screens' words read the marks, either side as before, in today's order (Don
  Dough: gold, then dough; Chandy: beam, scatter, shield). `pawnOnGold` and `takesShield` are gone.
- **After this PR** neither boss keeps a `crowdFilter`; Sawyer's and Folio's edges are PR 4.
- **The guard:** `shield-layer-twin.test.ts` keeps today's rules frozen and checks every turn of seeded battles (the kit's, three
  seeds each, plus `?power=goldplate` and `?power=shields`), both sides: allowed moves (the dispatcher's and the runner's), the
  Last Stand's test, Don Dough's power turn, Chandy's last chance, and the screens' words for every legal move (state and view).
  A planted change (shields from pawns only, gold from every piece) fails it.
