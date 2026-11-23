# Boss art: shop-birdie-interior-2

- Model claude-opus-5-5, effort high, adaptive thinking. 30 turns, 36 renders.
- Spend: **$5.10** of the $10 cap (64 input, 411,502 cache-write, 5,124,036 cache-read, 100,773 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/shop-birdie-interior-2/shop-birdie-interior-2.ts.
- Previews: the final preview failed: . Each look it took: scripts/boss-art/out/shop-birdie-interior-2/looks/.

## Its notes

The 12 x 12 lobby inside Birdie's station is drawn, and I've looked at the idle and every review animation. The bar reads as a U with stools on the outside and birds on three of them. The bartender's place inside the U holds nothing. The challenge table is square and white-topped, with one stool each side and nothing else on it. The two gates sit on different rows and opposite sides of the road, and the board shows pictures only. The render tool still lists the boss animations (entrance, thinking and so on) as missing; a room doesn't have them.

The first drawing and the station's front couldn't be read from here, so the palette, the camera and the export shapes come from the brief alone. The camera is a straight-on view from the south: floor squares drawn square, 37 px each, and every upright piece stands on the south edge of its squares, raised by its lift. The camera export may not match what the game expects; check it against the old file.

**Where I moved things from the suggested layout, and why**
- **Crossing:** road at cols 8-9, rows 8-10 (was cols 2-3, rows 7-9), rails at row 9. Gates at (7,10), west of the road and before the tracks, and (10,8), east of the road and after them. The 110 px door frame hides cols 4-5 rows 8-10, and a gate at (4,7) stood in front of the table, which was the bug in the stopped run.
- **The far gate is mirrored** (`rot: 2` in the layout, drawn flipped) so its raised arm sits on the road side. That meaning of `rot` is my own; check how the game reads it.
- **Table and stools:** table at (3,5) (was (4,5)), its stools at (2,5) and (5,5). Nothing tall stands south of it.
- **Bar stools:** (6,1), (6,2), (6,3) and (7,5) to (10,5). Column 6 between the table's right stool and the bar keeps it from reading as part of the bar.
- **Plants** at (1,1) and (5,1); (10,1) is under the east arm.
- **Second lamp** at (1,7); shrub-b at (1,10), shrub at (10,10).
- **Back wall:** wall-none, arch (cols 1-2), wall-pilaster (col 3), board (cols 4-7), wall with a sconce over the bar (col 8), arch-east (cols 9-10), wall-none.
- **Birds:** a dove at (6,2), a sparrow at (8,5) and a dove at (10,5) facing west. The layout format has no place for them, so they're listed in `SHOP_BIRDIE_PATRONS`.

**Each piece: width x height in px, then squares, then how far it sits above its squares' south edge (lift)**
| Piece | Size (px) | Squares | Lift |
| --- | --- | --- | --- |
| floor-a, floor-b, floor-edge, floor-edge-corner, floor-door | 37 x 37 | 1 x 1 | – |
| road-nw, road-ne, road-w, road-e, road-rail-w, road-rail-e | 37 x 37 | 1 x 1 | – |
| wall, wall-pilaster, wall-none | 37 x 120 | 1 x 1 | – |
| arch, arch-east | 74 x 120 | 2 x 1 | – |
| board | 148 x 120 | 4 x 1 | – |
| seats | 111 x 36 | 3 x 1 | 3 |
| lamp | 18 x 76 | 1 x 1 | 8 |
| plant | 30 x 48 | 1 x 1 | 5 |
| shrub, shrub-b | 30 x 32 | 1 x 1 | 4 |
| counter (28 px tall plus its top) | 148 x 65 | 4 x 1 | 0 |
| counter-arm (28 px tall plus its top) | 37 x 139 | 1 x 3 | 0 |
| stool | 22 x 24 | 1 x 1 | 5 |
| birds | 12 x 8 | – | – |
| match-table (62 x 62 white top) | 74 x 86 | 2 x 2 | 6 |
| crossing-post | 37 x 86 | 1 x 1 | 3 |
| hem | 37 x 24 | 1 x 1 | – |
| entrance | 74 x 110 | 2 x 1 | – |

The side wall's picture is 444 x 120 (12 squares long, the wall's full height), with pilasters at squares 0, 4, 8 and 11 and sconces at 2, 6 and 10.

**Idle (8 frames at 500 ms, a 4 s loop)**
- **Frames 0 and 4:** rest; the gate lights are dim.
- **Frames 1-3:** the board's three rows flip in turn, each shown mid-flip (a falling flap, the new picture's top over the old one's bottom). The yellow train crosses the west arch. The gate lights blink in turn.
- **Frames 5-7:** the rows flip back the same way. The train crosses the east arch, the other way. The lights blink again.
- **Birds, all eight frames:** each bobs its head, sips from a tiny cup on its seat and tucks a wing, each on its own timing.

**Review animations**
- One per piece (`review-<name>`). Furniture and wall pieces are scaled-up crops of the room through the 8 idle frames. Floor and road tiles show the tile alone at 4x, with a second copy beside it to check the seam.
- Also `review-bar`, `review-bar-east`, `review-challenge`, `review-crossing`, `review-floor`, `review-road` and `review-front`.

**Exports:** everything the brief listed, plus `SHOP_BIRDIE_FLOOR` (each square's floor tile and turn), `SHOP_BIRDIE_PATRONS` (the birds) and `SHOP_BIRDIE_INTERIOR_2` (the same room under id `shop-birdie-interior-2`).
- `SHOP_BIRDIE_BARTENDER_SPOT` is `{ col: 8, row: 2 }`.
- `SHOP_BIRDIE_BOARD_BOX` is x 10, y 21, 128 x 51.
- `SHOP_BIRDIE_COUNTER_SIGN` is the counter's blank brass plaque at x 64, y 41, 20 x 7.
- `SHOP_BIRDIE_LIGHTS`: the two lamps, the sconce at col 8, the bell and urn (soft), the daylight at the door, the two arches (soft) and four gate lights. The mirrored far gate's lights are at x 28 and 14.
- `SHOP_BIRDIE_POOLS`: under the two lamps, over the bartender's place, over the table and at the entrance.

**Things you might want to change**
- The birds are small (about 9 x 8 px) so the stools still read as stools; at phone size they're specks.
- The door frame stands 110 px tall and hides the doormat tiles from this camera.
- The table's white top is plain.
- The two floor tiles differ only slightly in tone, so the checker is gentle.
