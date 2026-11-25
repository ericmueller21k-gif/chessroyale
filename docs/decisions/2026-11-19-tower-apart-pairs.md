# Battle Tower: the colliding pairs never share a floor, for now (Nov 19, 2026)

Eric, Nov 19: "If two boss things collide badly just for now make note of which combination to not use in the battle tower,
and also yes on chandy good idea".

- `BATTLE_TOWER.apart` (settings.ts) adds the three pairs PR 6's kit and reviews found colliding: **Smudgy + Alfil** (Repaint while
  the Slam holds pawns up), **Alfil + Jefferson** (the Slam lifts a piece blocking a boss pawn's promotion), **Dash + Smudgy** (Dash's
  extra move ignores the side's stops and can slide the hidden rook). Hollow + Smudgy stays. `PAIR_BREAKS` is empty.
- "For now": each pair can come back once its rule is built (the rules proposed are in `2026-11-18-several-bosses.md`); take it
  out of `apart` and the kit's pair check covers it again.
- Chandy: when the queen is gone, his queen lock aims at the crowd's best rook (Eric's yes). A separate boss-lane PR.
