# Square marks on the board layer (Nov 18, 2026)

Battle Tower PR 3 (brief: "no boss battle changes, not one move"). Boingo's pies, Big Boy's toy blocks, Puddles' plain plants,
Chandy's beam walls and scatter shot, and Don Dough's dough moved from each boss's `crowdFilter`, `bossStops` and `stopReason`
geometry onto the layer (`BossRules.layer`: `pieMarks`, `toyMarks`, `plantMarks`, `chandyMarks`, `doughMarks`). No behavior
change; calls made:

- **His own moves read the layer too.** `bossAllowed`, the runner's "his only move went through" (`bossStopped`) and the Last
  Stand's "something stops his moves" read the marks that bind him (`binds` "both" or "bosses"), for the side to move; `bossStops`
  stays for the bosses not moved yet (Sawyer, the hoops, Smudgy's paint).
- **Where today's code differed, the difference can't happen in a battle, so the layer's rule stands:**
  - Boingo's and Don Dough's own moves checked `to` only (the layer: castling's rook landing too). Pies always lie behind a crowd
    piece, toward the crowd's back rank, and dough never on his back rank, so neither is ever where his castling lands.
  - A toy block and a plant counted a castling rook's corner. Marks only go on empty squares and castling needs its rook on its
    corner (a rook that leaves loses the right; `withoutPiece` clears it). Chandy's beam on a corner still holds the rook there.
  - `lands` comes from `movePaths`: it differs only for Chess960's king-onto-rook, and no boss battle starts from Chess960.
- **One rule, not two:** the powers' own picks (the pie's target, the scatter shot's squares, the beam, a topple's scatter, the
  watering's guard, Chandy's last chance, Big Boy's power turn and Last Stand test) ask the same marks (`marksStop`);
  `blockedBy`, `toyStops`, `plantStops` and `beamAllows` are the layer's rule now; `topples` is gone. The screens' words read
  the marks too, either side as before (Don Dough's dough: his pieces only, as before).
- **Big Boy's tower is two marks:** the crowd's (`noLand` until `towerEnter`) and his (`noLand` unless `hisToppleOpen`).
- **Left for later PRs:** Chandy's shields and Don Dough's gold (PR 5, still `crowdFilter`); Sawyer and Folio's crease (PR 4).
- **The guard:** `square-layer-twin.test.ts` keeps today's rules frozen and checks every turn of seeded battles (the kit's, two
  seeds each, plus each mark-making power switched on), both sides: allowed moves (the dispatcher's and the runner's), which of
  his moves went through, the screens' words for every legal move (state and view), the Last Stand's test, Big Boy's power turn,
  and the picks' geometry (landings, a wall on every empty square, beams). A planted change (pies binding the crowd only) fails it.
