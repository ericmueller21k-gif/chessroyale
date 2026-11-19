# The Battle Tower's floor room, second pass: two fixes found in the game

The first brief (`scripts/boss-art/briefs/shop-tower-floor.md`) still holds, except where this one changes it. Your drawing exists:
**read it first** (`scripts/boss-art/out/house-shop-tower-floor/house-shop-tower-floor.ts`). Revise it with `edit_drawing`; **don't
rewrite the file**. Change only what's below; keep every other piece, name and export as it is.

## 1. The circle's tiles: no mirrored floor tiles
The game draws floor tiles turned by `rot` but **ignores `flip` on floor tiles** (ShopRoom.tsx bakes the floor with `rotate` only).
So every circle square laid as a mirrored copy shows unmirrored, and the circle's arcs and wedges break into a swirl. Fix: in the
loop that finds identical circle tiles, reuse a tile only **unturned or half-turned (rot 0 or 2), never mirrored**: a square that
matches only a mirrored tile gets its own `circle-<n>` tile. (Half turns are safe; the rest of the room's floor tiles don't use
`flip` either: check, and give any that do their own tile.) Render `review-circle` with the layout's `rot` applied the game's way
(`rotate(rot * 90°)` about the tile's middle, clockwise on screen, no mirroring) to confirm the circle is whole.

## 2. The floor number on the back wall too (phone)
In the game on a phone (428 px wide, portrait) the side walls are seen almost edge on at the screen's edges, so the big number on
them can't be read there (on a computer, 1440 px wide, it reads well: keep it as it is). Add the floor number **on the back wall
either side of the elevator** as well, so it reads on a phone:
- A new 2 x 1 piece, `number-panel` (74 x 130, foot (37, 129), standing in the back wall, solid): the back wall's frieze, plaster,
  rail and dado as the `wall` piece has them, with a **slate panel in a gold frame** in the plaster (about 62 x 64) holding the
  floor number in the same Art Deco numerals as the side walls, **smaller** (digits about 44 to 50 px tall), two digits side by
  side fitting inside the panel (try "57" and "88").
- It depends on the floor: export `towerFloorPieces(floor)`, returning `SHOP_TOWER_FLOOR_PIECES` with its `number-panel` for that
  floor (made once per floor and kept), and keep `SHOP_TOWER_FLOOR_PIECES` itself as floor 4's.
- In `SHOP_TOWER_FLOOR_LAYOUT`, put `number-panel` at **columns 1-2** and **columns 7-8** of row 0 (both upright, the same
  number, not mirrored: no `flip`), in place of the plain wall there; the elevator stays at columns 4-5.
- Add `review-panel-4` and `review-panel-57` (the panel at 3x) and keep the room still showing floor 4.

## Looks
Render `review-circle` (the game's way, above), `review-panel-57` and the room still at scale 1 (one frame). Call done with short
notes: what changed, the panel's size and the digits' size.
