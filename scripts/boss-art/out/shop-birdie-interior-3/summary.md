# Boss art: shop-birdie-interior-3

- Model claude-opus-5-5, effort high, adaptive thinking. 24 turns, 13 renders.
- Spend: **$2.99** of the $6 cap (50 input, 168,238 cache-write, 2,027,753 cache-read, 86,998 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/shop-birdie-interior-3/shop-birdie-interior-3.ts.
- Previews: scripts/boss-art/out/shop-birdie-interior-3/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/shop-birdie-interior-3/looks/.

## Its notes

**Important: I couldn't open round 1's code.** shop-birdie-interior-2.ts was not readable from my tools, and house-birdie.ts wasn't reachable either. So I rebuilt the room from scratch, copying round 1's first-frame picture (lobby-first-frame.png): the same palette, the 37 px squares, the back wall 120 px tall, side walls drawn flat, the terrazzo floor, the yellow safety line, the arches, the board, the seats, lamps, plants, the hem and the doorway. It is built in parts, as the brief asked. The export names are the ones the brief lists, but the shapes of the data inside them are my guesses, because I couldn't see round 1's. Please check them against round 1 before wiring.

The room is a single 444 x 527 px picture, 12 x 12 squares at 37 px each. Row r's floor starts at y = 83 + 37r.

**The idle** (8 frames, 500 ms each). Everything else holds still.
- **Board:** row (f % 4) flips each frame: you see the new picture's top half and the old flap falling as a dark band. The fourth beat is a rest. Each row switches between two sets of pictures, so the loop joins up cleanly.
- **Trains:** in the west arch, three yellow-and-red cars run east through frames 1–5. In the east arch, a train runs west through frames 7–3.
- **Birds:** six birds, each with its own timing: up, head bob, sip (beak down) and wing tuck.
- **Gate lights:** each gate's two red lights blink in turn, and the far gate is one beat behind the near one.
- The boss animations (entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory) all just reuse the idle frames, since a room has no moods.

**Layout: the suggested layout, with these changes.**
- **Shelves:** hung on the wall at y 8–87 rather than standing on the floor. Standing, the east arm of the bar hid about a quarter of the jars.
- **Sconces:** that move left no room for a sconce over the shelves, so the two sconces are on the corner wall squares, cols 0 and 11.
- **No wood pilaster:** the piece is defined but not placed; the board and arches fill row 0.
- **Bar:** arms `counter-arm` at (5,1) and (8,1), each 1 x 3; bottom run `counter` at (5,4), 4 x 1. The seed vat is at (6,1). The bartender's 2 x 2 at cols 6–7, rows 2–3 is empty.
- **Stools:** (4,1–3), (5–8,5) and (9,1–3).
- **Birds (6):** a dove at (4,1), sparrow (4,3), dove (5,5), sparrow (7,5), sparrow (9,1) and dove (9,2). The east-arm birds face west.
- **Counter feeders (7) and the bell:** two on each arm, three on the bottom run, and the brass bell. No cups, glasses, bottles or urn.
- **Challenge spot:**
  - The `match-table` is 1 x 1 at (6,7), with stools at (5,7) and (7,7). Row 6 stays empty between it and the bar stools.
  - The table is one square because the brief asked for about one square across. Its picture is 30 x 44 px, with a 30 x 28 white top, so it still holds two feeders and reads as a table beside the 22 px stools.
  - There are 2 feeders on the floor (`feeder-floor`), at (5,8) and (7,8), nudged in toward the table and not blocking.
- **Crossing:**
  - A gravel road at cols 2–3, rows 8–10, runs north–south: `road` 2 x 1 at row 8, `road-rails` at row 9, and `road` turned half round at row 10.
  - The rails sit on wood ties in darker ballast. There's a yellow-and-black edge and a painted red-and-white crossbuck at each end, and no dashed line.
  - The gates are kitty-corner: `crossing-post` at (1,10), west of the road and before the tracks coming from the door, and a mirrored one at (4,8), east and after the tracks. Nothing stands on the road.
- **Seats** are at (1,4) and (1,5), clear of the stools and the crossing.
- **Lamps, plants and shrubs:**
  - lamps at (3,1), (1,7) and (10,7)
  - plants at (1,1) and (10,5)
  - shrub-b at (8,10), shrub at (10,10)
- **Front:** `hem` at cols 1–3 and 6–10, and `entrance` at (4,11), 2 x 1, with `exit: true`. The `floor-door` mats at (4,10) and (5,10) are hidden behind the doorway's frame.

**Piece sizes** (picture in px, then squares). `SHOP_BIRDIE_PIECES` gives each piece's grid, footprint and offset.

| Piece | px | squares |
|---|---|---|
| floor-a, floor-b, floor-edge, floor-edge-corner, floor-door (grout on all four sides) | 37 x 37 | 1 x 1 |
| wall, wall-b, wall-pilaster, wall-none | 37 x 120 | 1 x 1 |
| arch, arch-east | 66 x 72 | 2 x 1 |
| board | 140 x 72 | 4 x 1 |
| shelves | 72 x 80 | 2 x 1 |
| sconce | 12 x 5, plus a 22 x 14 glow | 1 x 1 |
| counter-arm | 31 x 115 | 1 x 3 |
| counter (31 px tall front) | 144 x 68 | 4 x 1 |
| vat | 34 x 46 | 1 x 1 |
| stool | 22 x 26 | 1 x 1 |
| birds | 9 x 8 | — |
| feeder | 9 x 11 | — |
| feeder-floor | 7 x 12 | 1 x 1 |
| bell | 7 x 5 | — |
| match-table | 30 x 44 | 1 x 1 |
| road, road-rails | 74 x 37 | 2 x 1 |
| crossing-post | 26 x 84 | 1 x 1 |
| seats | 110 x 40 | 3 x 1 |
| lamp | 18 x 76 | 1 x 1 |
| plant | 32 x 50 | 1 x 1 |
| shrub | 32 x 36 | 1 x 1 |
| shrub-b | 24 x 38 | 1 x 1 |
| hem | 37 x 24 | 1 x 1 |
| entrance | 74 x 110 | 2 x 1 |

The side wall picture is 37 x 407 px (rows 1–11), with the east wall mirrored.

**Exports**
- `SHOP_BIRDIE_N = 12` and `SHOP_BIRDIE_WALL_H = 120`.
- `SHOP_BIRDIE_LAYOUT` is a list of `ShopPlace` entries. Beyond the brief's fields I added `flip`, `dx`/`dy` (pixel nudges, e.g. feeders on the counter and table) and `z` (draw order).
- `SHOP_BIRDIE_PIECES` and `SHOP_BIRDIE_SIDE_WALL_GRID`.
- `SHOP_BIRDIE_BOARD_BOX = {x:6, y:14, w:128, h:52}`.
- `SHOP_BIRDIE_COUNTER_SIGN = {x:59, y:40, w:26, h:7}`: the brass plate, in the counter piece's own pixels.
- `SHOP_BIRDIE_BARTENDER_SPOT = {col:6, row:2}`.
- `SHOP_BIRDIE_LIGHTS`: lamps, sconces, the bell (soft), the doorway's daylight, the arches (soft), and the gate lights with `blink` "a" or "b".
- `SHOP_BIRDIE_POOLS`: under the lamps, over the bartender's place, over the table, and at the door.
- `SHOP_BIRDIE_CAM = {x:0, y:0, w:444, h:527, tile:37, wallH:120, floorY:83}`.
- `SHOP_BIRDIE_INTERIOR_3`.

**Viewing animations.** A 444 x 527 frame always rendered at 1x, so each review is a close-up cut out of the room's own frames and enlarged by 3–6x. They are: review-floor, -arch, -board, -shelves, -vat, -bar, -bar-east, -table, -crossing, -seats, -front, plus review-room-pieces. I looked at all of them and at the room's idle. review-seats wasn't rendered on its own; I checked the seats, lamps and plants in the room view.

**Choices you might change**
- The feeders have red roofs so they stand out on the wood counter; at 1x they read as little red birdhouses.
- The birds are very small, 9 x 8 px.
- The vat is galvanized metal rather than wood.
- The crossbucks are painted on the road surface as well as on the gates.
- The board pictures are a train, tree, sun, seed sack, dove, plane, cloud and feeder.
