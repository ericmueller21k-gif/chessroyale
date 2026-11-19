# Boss art: house-shop-tower

- Model claude-opus-5-5, effort high, adaptive thinking. 17 turns, 14 renders.
- Spend: **$2.35** of the $5 cap (38 input, 181,477 cache-write, 1,810,566 cache-read, 53,837 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-tower/house-shop-tower.ts.
- Previews: scripts/boss-art/out/house-shop-tower/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-shop-tower/looks/.

## Its notes

The Battle Tower's ground-floor lobby is drawn as one self-contained room file, `house-shop-tower`. It is a room, not a boss: there are no idle/move/capture animations. The room still is `idle`, and every piece has a `review-*` view. I rendered all 15 views; none showed anything that needed changing. The room still's bottom edge (the front row) was cut off in the full-room view, so the hem and entrance were only checked in their own close-ups.

**Pieces** (37 px a square; each upright piece stands at its foot; the clerk is not drawn)
- **Floor**, 37 x 37 tiles, flat, foot at (18, 18):
  - `floor-a` and `floor-b` are calm marble in the board's two colors (#f0d9b5 and #b58863, toned down), with one or two faint veins and a short sheen at the upper left. They meet with no seams.
  - Plain tiles are turned by a fixed hash so the veins don't line up.
  - A gold inlay line runs round columns 1–8 and rows 1–8, drawn with `floor-edge-a/b` and `floor-edge-corner-a/b`, turned with `rot`.
  - The doormat is `floor-door` on a light tile and `floor-door-b` on a dark one, at columns 4–5 of row 8 just inside the doors: slate with a gold edge.
- **Back wall**, 37 x 130 each: `wall`, `wall-pilaster`, `wall-sconce` and `wall-none`. Top to bottom: a gold band and slate frieze with small gold diamonds, cream plaster, a gold rail at y 86–89, a slate dado with recessed panels, a baseboard. Column 6, the only plain square, is `wall-sconce` (a gold fan lamp).
- **Side walls:** `SHOP_TOWER_SIDE_WALL_GRID(west, run)` makes one picture, run × 37 by 130 (444 x 130 for run 12). It has pilasters at x 55, 166, 277 and 388 and fan sconces at x 111 and 333. The east wall uses the same picture.
- **Elevator**, 2 x 1 squares, 74 x 130, foot (37, 129). In the layout it is `{door: "top"}` and not solid.
  - A slate frame with a stepped gold crest, and a gold half-round floor dial with tick marks and a needle (no numbers).
  - Brushed-gold doors with a center seam and a sunburst etched from the sill, on a gold threshold.
  - A lit up-arrow call button at x 64–71, y 60–74.
- **`board-best`**, 2 x 1. **Changed from the brief:** the piece is 74 x 130, not 74 x 100, so it carries its own patch of wall like the elevator does. The board itself is 64 x 71 (x 5–68, y 12–82): a gold frame round a slate panel, a small crest, a **blank** cream header plate, and faint ruled lines below.
- **Counter**, 3 x 1, picture 111 x 38, foot (55, 35). The desk is **30 px tall**: a slate top, gold top edge, a gold zigzag band, fluting, a blank brass plaque, a brass service bell on the right, and a ground shadow.
- **Backdrop**, 3 x 1, 111 x 130: a 7 x 4 slate key rack in a gold frame with brass keys in most holes, a gold crest, and a pilaster at each end.
- **Hem**, 37 x 24: the front wall's top, a gold rail over slate. It is mirrored east of the door.
- **Entrance**, 2 x 1, 74 x 110, foot (37, 109), `{exit: true}`: glass doors in gold frames folded open, a slate header with a small sunburst, and the bright street beyond (sky, pale far towers, pavement) on a gold threshold.

**Layout**
- Row 0: `wall-none`, `backdrop` (columns 1–3), `elevator` (4–5), `wall-sconce` (6), `board-best` (7–8), `wall-none`.
- Columns 0 and 9: solid blanks.
- The counter is at columns 1–3, row 3.
- Row 9: hem pieces, with the entrance at columns 4–5.
- The way from the door to the elevator and across to the counter is open. Nothing else is in the room.

**Exports**
- `SHOP_TOWER_N` = 10; `SHOP_TOWER_LAYOUT` (floor tiles first, then uprights north to south); `SHOP_TOWER_PIECES` (ids `shop-tower-<name>`); `ShopPlace`.
- `SHOP_TOWER_SIDE_WALL_GRID` and `SHOP_TOWER_WALL_H` = 130.
- `SHOP_TOWER_COUNTER_SIGN` = {x 37, y 17, w 36, h 8}.
- `SHOP_TOWER_KEEPER` = [{c:2,r:2},{c:3,r:2}] and `SHOP_TOWER_CLERK_AT` = [2.5, 2.4].
- `SHOP_TOWER_BOARD_HEAD` = {12, 19, 50, 10} and `SHOP_TOWER_BOARD_BODY` = {11, 35, 52, 43}.
- `SHOP_TOWER_LIGHTS`: the sconce, the call button, the dial (soft) and the daylight through the doors. `SHOP_TOWER_POOLS`: under the sconce and in front of the elevator.
- `SHOP_TOWER_SIDE_LIGHTS` (extra): the side-wall sconces, in the side-wall picture's pixels.
- `SHOP_TOWER_CAM` = {x 4.5, y 4.0}.
- `HOUSE_SHOP_TOWER`: `idle` is the whole room still; there are `review-<piece>` views for every upright piece, plus `review-floor`, `review-floor-corner`, `review-floor-door` and `review-side-wall`.

**Things you might want to change**
- The side-wall sconces aren't pieces, so their lights can't name a piece. They're exported separately as `SHOP_TOWER_SIDE_LIGHTS` for the scene to place.
- `SHOP_TOWER_CAM` is my guess, scaled from the walk-up hall's camera; check it in the game.
- The counter plaque's face is bright gold, so dark lettering will read best on it.
- The board's crest and the elevator's crest sit over the frieze.
