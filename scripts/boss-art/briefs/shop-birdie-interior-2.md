# Inside Birdie's station, second pass: a bigger lobby with a U-shaped bar, the challenge spot and staggered crossing gates

You are redrawing a **room**, not a boss: the lobby inside Birdie's station. The first drawing is
`scripts/boss-art/out/shop-birdie-interior/shop-birdie-interior.ts` (read it first, and keep what it gets right). Its front is
`scripts/boss-art/out/house-birdie/house-birdie.ts` if that exists. Players tap the station, "Go in", and the view fades into this room.

Eric, Nov 23, on the first drawing (his words, in full): "the table and chairs are all out of place ... there should have been a
separate area. Like the station should have been a little bigger. There should be like little birdies sitting at the bar stools,
and it should be like a 3-sided ... bar ... and then in the back is a bartender guy who's also doubles as the shop guy. ... the guard
crossings ... you have them exactly parallel, but they should actually be on different lines, just like on a real ... road ...
kitty corner ... when I said the table and chairs, I just mean like just 2 of those bar stools that you have drawn ... one on the
left, one on the right, and in the center ... a normal ... square [table] with the white top."

## Keep (from the first drawing)
- **The back wall's split-flap board**, with its pictures and **no letters or numbers**: the flaps flip in turn now and then.
- **The arched windows** onto the tracks behind, with trains passing in and out (scenery, not walkable).
- **The airport-style seats**, the lamps and the plants.
- **The palette and the style** (below), and the clean footing and tile rules of the first drawing.

## Change
1. **A little bigger: 12 x 12 squares** (columns 0-11 west to east, rows 0-11 north to south; you come in at the south). The first
   room was 10 x 10. The game's room format takes any size (its default is 20), so 12 fits; keep the back wall, the arches and the
   board on row 0 as the first drawing does, and spread the new floor into the extra two columns and rows. Export `SHOP_BIRDIE_N = 12`.
2. **A separate bar area** (its own part of the room, not the café's old counter): a **three-sided, U-shaped bar counter** with
   **stools on the outside of it**, and **little birds perched on some of those stools** (small doves and sparrows, cozy patrons:
   a head bob, a sip from a cup now and then, a little idle life). **Behind the counter, the bartender's place**: a clear space
   inside the U, left empty of anything, because the game draws the bartender there. Leave his place clear, as the other shops
   leave their clerk's place.
3. **The challenge spot in the middle**: a plain **square table with a white top** (`match-table`, 2 x 2, a warm-wood base and a
   white top), with **one of the bar's stools on its left and one on its right**, facing each other across the table
   (`stool`, 1 x 1). Nothing else on it: no cups, no chairs, no cloth.
4. **The railroad crossing**: one gate before the tracks on one side, the other after the tracks on the opposite side
   (**kitty-corner**), **never side by side on the same line**. Use two `crossing-post` pieces (1 x 1), one on each side of the
   road, on different rows. **No chairs, stools or table on the crossing itself.** Keep the crossing as a strip of road across the
   floor, its gates and its rail ties at a real road's scale (the rails and ties read as tracks, not a painted square).

## Suggested layout (a call you may adjust within the rules above; record any change in your notes)
```
row 0      back wall: wall-none at col 0 and col 11; arch (cols 1-2); wall at col 3; board (cols 4-7, 4 x 1); wall at col 8;
           arch-east (cols 9-10). The board's pictures and the arches' trains as in the first drawing.
row 1      plants at (1,1) and (10,1), in the corners. The bar's two arms start here (see below).
rows 2-3   airport seats at cols 1-3 (`seats`, 3 x 1 at (1,2) and (1,3)), facing north toward the board.
           A standing lamp at (4,2).
rows 1-4   the U-SHAPED BAR, on the east side of the room: its west arm `counter-arm` at col 7 (1 wide, 3 deep, rows 1-3),
           its east arm `counter-arm` at col 10 (1 wide, 3 deep, rows 1-3), and its bottom run `counter` at row 4, cols 7-10
           (4 wide). The bartender's clear place is the 2 x 3 inside the U: cols 8-9, rows 1-3. The U opens north, against
           the back wall.
row 5      STOOLS on the outside of the bar's south run: (7,5), (8,5), (9,5), (10,5). Birds on two of them.
col 6      STOOLS on the outside of the west arm: (6,1), (6,2), (6,3). Birds on one. (6,1) is the corner.
col 11     the east wall: solid. (The east arm's outer side is the wall: no stools there.)
rows 5-6   THE CHALLENGE SPOT in the middle: the square table `match-table` at (4,5) 2 x 2 (cols 4-5, rows 5-6), with its two
           stools: one at (3,5) on its left and one at (6,5) on its right, facing each other across the table.
rows 7-9   THE RAILROAD CROSSING: a road strip 2 squares wide (cols 2-3, rows 7-9), with the tracks crossing it east-to-west at
           row 8 (the rails and ties drawn into the road, the arch's trains beyond). Gates are kitty-corner: `crossing-post` at
           (1,9), on the west side of the road and south of the tracks (before them, from the door), and `crossing-post` at
           (4,7), on the east side and north of the tracks (after them). Different rows, opposite sides, never in line.
           Nothing else on the road: no stools, chairs or table on it.
row 10     the front floor: a yellow safety line one square in from the side walls and along the front (`floor-edge-*`), with
           the front floor's tiles.
row 11     the front: `hem` at cols 1-3 and cols 6-10 (charcoal, a yellow edge), and the way out at cols 4-5 (`entrance`,
           2 x 1, `exit: true`, glass doors onto the street, the day bright through them). The `floor-door` tile at (4,10) and (5,10).
cols 0, 11 the side walls: one surface each (SHOP_BIRDIE_WALL_H tall), solid blanks in the layout.
```
Floor tiles: `floor-a` and `floor-b` checker the whole floor. A `floor-door` at the way in. The yellow safety line stays one square
in from the side walls and along the front.

## The bartender's place
The bartender stands inside the U at (8,2) (facing south, toward the room, over the bottom run). That square and the two beside it
in row 1-3 of cols 8-9 must stay clear of any piece, so the game can draw him there. Mark the place in the exports:
`SHOP_BIRDIE_BARTENDER_SPOT = { col: 8, row: 2 }`. The counter's front (the bottom run and both arms' outer faces) faces the room;
its top carries the brass service bell and a small urn, as in the first drawing, and a blank plaque (`SHOP_BIRDIE_COUNTER_SIGN`).

## The pieces (sizes in squares; 1 square = 37 px)
- **Floor (`floor-a`, `floor-b`, `floor-edge`, `floor-edge-corner`, `floor-door`):** as in the first drawing: terrazzo, cream and
  warm stone flecks, flat, 37 x 37, grout on all four sides so turned tiles meet with no seams.
- **The back wall (`wall`, `wall-pilaster`, `wall-none`):** as in the first drawing (cream plaster, a charcoal dado a third up,
  a red stripe rail, slim warm-wood pilasters now and then).
- **The arches (`arch`, `arch-east`, 2 x 1):** as in the first drawing: warm wood, a yellow keystone, the opening showing a pale sky
  and 2 or 3 tracks receding in perspective; a yellow toy diesel train (Birdie's train: yellow, dark roof, red stripe) slides across
  the nearest or middle track now and then, moving away from the room.
- **The split-flap board (`board`, 4 x 1):** as in the first drawing, pictures only. Export `SHOP_BIRDIE_BOARD_BOX`.
- **Airport seats (`seats`, 3 x 1):** a molded row of three, charcoal shells, yellow cushions, armrests between them.
- **The U-shaped bar (`counter`, 4 x 1 bottom; `counter-arm`, 1 x 3 each arm):** a warm-wood top with a cream edge, a charcoal front
  with a red stripe, a brass service bell, a small coffee urn. **At most about 32 px tall** so the stools read beside it.
- **Stools (`stool`, 1 x 1):** tall round stools, a warm-wood seat with a yellow cushion, a charcoal post, a ring footrest.
- **Birds on the stools (idle life; part of the stool pieces' idle, not separate pieces):** small doves (grey-blue, a pale collar)
  and sparrows (brown, a little black bib), sitting on the seat, a head bob, a sip, a wing tuck. Two or three birds, no more
  than a few pixels tall each, so the stools still read as stools.
- **The challenge table (`match-table`, 2 x 2):** a plain square table, warm-wood base and a **white top**.
- **The railroad crossing (floor road + `crossing-post` x 2):** a charcoal road strip with two steel rails and wooden ties,
  a yellow and black edge, a red-and-white crossbuck at each end. Each `crossing-post` is a 1 x 1 upright (about 84 px tall) with a
  red light and a striped barrier arm raised out of the way.
- **Shrubs (`shrub`, `shrub-b`) and plants (`plant`):** as in the first drawing.
- **Standing lamp (`lamp`):** a warm-wood pole and a cream shade, a soft pool of light.
- **The front:** `hem` (about 24 px, charcoal, a yellow edge) and `entrance` (2 x 1, about 74 x 110, glass doors in warm-wood frames
  standing open, the bright day beyond; `exit: true`). It must clearly read as the way out.

## The colors (as the first drawing: Birdie's train, not a boss's)
Train **yellow** about `#f4c430`, deeper `#d9a21b`, pale `#ffe27a`; **charcoal** `#2b2d31`, `#3a3d44`, `#54575f`; train **red**
`#c8372d` with a deeper `#8e1f1a`; **warm wood** `#a86a3c`, `#7a4a26`, `#c99866`; cream `#f3f1ec`, white; greens for the shrubs and
plants (`#4f7a3a`, `#6f9a4f`, `#2f4f25`), a warm terracotta pot `#b5643a`. Outline `k` near-black warm brown (about `#1a1714`).
Warm light `#ffe2a0` / `#ffb85c`. Bright and welcoming: cream walls with a charcoal dado and a red stripe, a yellow safety line.

## Lights and pools
`SHOP_BIRDIE_LIGHTS` (each with its piece): the standing lamps, the sconces, the bar's bell and urn (soft), the entrance's daylight,
the arches' glow from the sky (soft), and the red crossing-post lights. `SHOP_BIRDIE_POOLS`: warm pools under the lamps, over the
bartender's place, over the challenge table, and at the entrance.

## Exports
`SHOP_BIRDIE_N = 12`, `SHOP_BIRDIE_LAYOUT`, `SHOP_BIRDIE_PIECES`, `SHOP_BIRDIE_SIDE_WALL_GRID`, `SHOP_BIRDIE_WALL_H`,
`SHOP_BIRDIE_BOARD_BOX` (the flap grid's x, y, w, h in the board's pixels), `SHOP_BIRDIE_COUNTER_SIGN`,
`SHOP_BIRDIE_BARTENDER_SPOT` (`{ col: 8, row: 2 }`, the clear place behind the bar), `SHOP_BIRDIE_LIGHTS`, `SHOP_BIRDIE_POOLS`,
`SHOP_BIRDIE_CAM` (the fixed camera: the whole 12 x 12 room seen as the first drawing's camera does), and **`SHOP_BIRDIE_INTERIOR`**
(id `shop-birdie-interior`): the whole room as one Character with its own `idle` (about 8 frames at about 500 ms: the board's rows
flipping in turn, a train passing on one track every few seconds, the birds on the stools bobbing a little; the rest still), and one
viewing animation per piece (`review-<name>`) for the render tool.

Define `ShopPlace` in your file (`{ piece, col, row, w?, d?, rot?, exit?, solid? }`), as the first drawing does. The piece names
the game reads must match the ones the layout uses.

## Looks
Render each new piece at 3x or 4x: the U-shaped bar's corner and an arm (the stools and their birds), the challenge table and its two
stools, the crossing road and both gates, the board's flap grid (one row mid-flip), and two floor tiles side by side. Then the room's
idle at scale 1, **a few frames only** (a many-image request can't take a picture over 3,000 px). Check: the bar reads as three sides
with stools on the outside and birds on some of them; the bartender's place is clear; the challenge table is square and white-topped,
with a stool on each side and nothing else; the two gates sit on different rows and sides; no stool, chair or table is on the
crossing road; the board's flaps show pictures and no letters or numbers; the way from the door to the table and to the bar is clear.

Call done with notes: your choices (where you moved any piece from the suggested layout, and why), each piece's size in pixels and
squares, the side wall's picture size, and the exports.

## How to write it
Write a short skeleton first (the palette, the floor, the back wall with its arches and board, the layout and the room still) and
render it; then add the pieces a few at a time with `edit_drawing`, rendering as you go. Keep each turn's writing under about 600
lines.

## Notes from the stopped first run (this is a fresh run; the earlier one hit its spend cap before done)
- The earlier run's render showed the challenge table with a crossbuck sign and a crossing post standing on its top-left corner.
  Keep the table (cols 4-5, rows 5-6) and its two stools clear of every road piece, sign and post: the road is cols 2-3, rows 7-9.
- Keep the table at a sensible square size: a 2 x 2 white-topped square, not larger than the two stools' span.
- The bar's stools must read as a bar: stools on the outside of the three runs, with a few birds on them. Don't put the bar's
  stools in the middle of the floor, except the two challenge stools.
- The bartender's clear place (cols 8-9, rows 1-3) must hold nothing, not even a plant or a lamp.
