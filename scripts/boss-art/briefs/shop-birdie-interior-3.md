# Inside Birdie's station, third pass: a bar full of seed, bird feeders, a seed vat and the crossing in the corner

You are redrawing a **room**, not a boss: the lobby inside Birdie's station. Players tap the station, "Go in", and the view fades into this room.

**Start from round 1's drawing:** `scripts/boss-art/out/shop-birdie-interior-2/shop-birdie-interior-2.ts`. Read it first, in line ranges, and keep
its structure, its palette, its floor, its back wall and its pieces wherever this brief doesn't change them. Its front is
`scripts/boss-art/out/house-birdie/house-birdie.ts` if that exists. Write your drawing to `shop-birdie-interior-3`'s own file (the runner
gives the path), in parts (see "How to write it"), starting from round 1's code and changing it as you go.

**Reference pictures** (the runner's third argument): `lobby-first-frame.png` (round 1's first frame) and `bartender-frames-sheet.png`
(the bartender's round 1 sheet). Match their style, palette and everything that worked. Look at them before you draw, and again before you
call done.

## What Eric said (Nov 23, in his words; the room notes are on top of round 1's drawing)
- "the bar should be like fill it up, put some stuff on the back ... put some bird feeders on the table, and there should be a big ...
  vat of birdseed that the bartender ... scoops it up and then he pours it ... onto the birdseed feeders around the table ... The room
  doesn't need to be that much bigger."
- Earlier, on round 1: "There should be like little birdies sitting at the bar stools, and it should be like a 3-sided ... bar ... and then
  in the back is a bartender guy who's also doubles as the shop guy." And: "the guard crossings ... they should actually be on different
  lines, just like on a real ... road ... kitty corner." And: "just 2 of those bar stools ... one on the left, one on the right, and in
  the center ... a normal ... square [table] with the white top."

## Keep (from round 1)
- **The back wall's split-flap board**, with its pictures and **no letters or numbers**: its flaps flip in turn now and then.
- **The arched windows** onto the tracks behind, with trains passing in and out (scenery, not walkable).
- **The airport-style seats**, the lamps and the plants.
- **The palette and the style**, the clean floor tiles, the doorway, and the staggered crossing gates (kitty-corner).

## Change
1. **The room stays 12 x 12** (columns 0-11 west to east, rows 0-11 north to south; you come in at the south). Export `SHOP_BIRDIE_N = 12`.
   Do not make it bigger.
2. **Shelves behind the bar:** on the back wall, behind the counter, a row of shelves filled with seed jars, sacks and tins. A new piece,
   `shelves` (2 x 1, a warm-wood shelving unit), on row 0 behind the bar. The board keeps its place on the back wall as far as the layout
   allows.
3. **The bar:** still the 3-sided U, open to the back wall, with the bartender's place inside it. **Stools on all three outer sides**: on the
   outside of the west arm, along the outside of the bottom run, and on the outside of the east arm. Birds (small doves and sparrows) sit on
   **at least five** of the stools across the three sides, with a head bob, a sip, a wing tuck, each on its own timing.
4. **Bird feeders on the counter, in place of drinks:** little seed feeders on the counter top, several along all three sides. No cups, no
   glasses, no bottles, no urns on the counter top. (The brass bell may stay; the urn may go if it crowds the feeders.)
5. **The seed vat:** inside the U, beside the bartender's place, against the back wall: a big vat heaped with birdseed, a scoop standing in
   it. It is a piece of the room (one square, or two if you need it), not a prop the bartender holds.
6. **The challenge spot in the middle of the room:** a small square table with a **white top**, **smaller than round 1's** (round 1's was a
   2 x 2 square; make this about one square across, a `match-table` at 1 x 1 or a smaller square you draw, your call, recorded in your
   notes). **Exactly one bar stool on its left and one on its right**, facing each other across the table. **Two feeders on the table top**
   (Eric: "put some bird feeders on the table") and **two more feeders on the floor just beside it**, "around the table." Nothing else
   on the table or its stools (no cups, no cloth, no chairs). It is centered in the open floor, not against the seating, and it stays one
   square clear of the bar's stools.
7. **The crossing in the corner:** a railroad crossing in the front corner of the room, nearest the door, not in the middle. Rails on wooden
   ties set in **gravel**: a real railroad crossing, **not a road with a dashed line**. Use two `crossing-post` pieces (1 x 1), **one before
   the tracks on one side of the road and one after them on the other side** (kitty-corner: opposite corners of the crossing, never side by
   side on one line). **Nothing on the crossing:** no stools, chairs, table, feeder or sign.

## Suggested layout (a call you may adjust within the rules above; record any change in your notes)
```
row 0      back wall: wall-none at col 0 and col 11; arch (cols 1-2); board (cols 3-6, 4 x 1); shelves (cols 7-8, 2 x 1, new);
           arch-east (cols 9-10). Pictures and trains as in round 1.
rows 1-3   the U-SHAPED BAR, its west arm `counter-arm` at col 5, its east arm `counter-arm` at col 8 (each 1 wide, 3 deep).
           The bartender's clear place is the 2 x 2 inside the U at cols 6-7, rows 2-3 (SHOP_BIRDIE_BARTENDER_SPOT = { col: 6, row: 2 }).
           The seed vat stands at (6,1), against the back wall, beside him.
row 4      the bottom run `counter`, cols 5-8 (4 x 1), with its feeders on top. Its arms' feeders on their tops, too.
row 5      STOOLS on the outside of the bottom run: (5,5), (6,5), (7,5), (8,5). Birds on some of them.
col 4      STOOLS on the outside of the west arm: (4,1), (4,2), (4,3). Birds on some of them.
col 9      STOOLS on the outside of the east arm: (9,1), (9,2), (9,3). Birds on some of them.
           (Round 1 had no stools on the east arm's outside; now it does.)
rows 6-8   THE CHALLENGE SPOT, centered in the open floor: a small square white-top table with two feeders on its top and two on the
           floor beside it, one challenge stool on its left and one on its right, facing each other. Keep it one square clear of the
           bar's stools.
rows 8-10  THE RAILROAD CROSSING, in the front-left corner: a gravel road strip 2 squares wide with the rails and ties across it. Gates
           kitty-corner: one `crossing-post` on the west side, before the tracks from the door; one on the east side, after them.
           Nothing else on the crossing.
           The airport seats stay on the west side of the room, clear of the bar's stools and of the crossing.
row 10     the front floor: a yellow safety line one square in from the side walls and along the front (`floor-edge-*`).
row 11     the front: `hem` at cols 1-3 and cols 6-10 (charcoal, a yellow edge), and the way out at cols 4-5 (`entrance`, 2 x 1, `exit: true`,
           glass doors onto the street, the day bright through them). `floor-door` at (4,10) and (5,10).
cols 0, 11 the side walls: one surface each (SHOP_BIRDIE_WALL_H tall), solid blanks in the layout.
```
Floor tiles: `floor-a` and `floor-b` checker the whole floor. A `floor-door` at the way in.

## Rules you must keep
- **The bartender's place is clear:** the 2 x 2 at cols 6-7, rows 2-3 holds nothing (no piece, no feeder, no lamp, no plant). He stands at
  (6,2), facing south over the bottom run. Export `SHOP_BIRDIE_BARTENDER_SPOT = { col: 6, row: 2 }`.
- **Every bar stool sits on the outside of a bar run;** none stands in the middle of the floor except the two challenge stools.
- **The challenge table has exactly two stools,** one on each side. Nothing else touches it.
- **The crossing is clear:** no stool, chair, table, feeder or sign is on the road or its tracks; the posts stand on the road's edge squares
  and never on the table or a stool.
- **The board shows pictures only,** no letters or numbers.
- **The way from the door to the table and to the bar is clear.**

## The pieces (sizes in squares; 1 square = 37 px)
- **Floor (`floor-a`, `floor-b`, `floor-edge`, `floor-edge-corner`, `floor-door`):** as in round 1: terrazzo, cream and warm stone flecks,
  flat, 37 x 37, grout on all four sides so turned tiles meet with no seams.
- **The back wall (`wall`, `wall-pilaster`, `wall-none`) and the arches (`arch`, `arch-east`):** as in round 1.
- **Shelves (`shelves`, 2 x 1, new):** warm wood, two or three shelves high, filled with seed jars (glass, with a little seed in each),
  burlap sacks and tins. Pictures only: no letters or labels.
- **The split-flap board (`board`, 4 x 1):** as in round 1, pictures only. Export `SHOP_BIRDIE_BOARD_BOX`.
- **Airport seats (`seats`, 3 x 1):** as in round 1.
- **The U-shaped bar (`counter`, 4 x 1; `counter-arm`, 1 x 3):** a warm-wood top with a cream edge, a charcoal front with a red stripe, a
  brass service bell, **little bird feeders on the top in place of drinks** (each a small wood-and-glass feeder with a little seed in it and
  a tiny perch). **At most about 32 px tall** so the stools read beside it.
- **The seed vat (`vat`, 1 x 1, new):** a big round tub, warm wood or galvanized metal with a rolled rim, **heaped high with birdseed** (a
  mound of millet, sunflower and cracked corn: yellow, cream, brown, red specks), a scoop standing in the top. Its heap reads from the room.
- **Bird feeders (`feeder`, small; on the counter, on the table and on the floor beside the table):** a little hopper feeder on a stand or
  hung by a short chain: a clear-ish glass tube or a wood box, a few seeds showing, a tiny perch. About one square's width (the one on the
  floor a bit smaller). Keep them readable at phone size: a feeder is a few warm colors and a perch, not a detailed object.
- **Stools (`stool`, 1 x 1):** tall round stools, a warm-wood seat with a yellow cushion, a charcoal post, a ring footrest.
- **Birds on the stools (idle life, part of the stool pieces' idle):** small doves (gray-blue, a pale collar) and sparrows (brown, a little
  black bib), sitting on the seat, a head bob, a sip, a wing tuck. Two or three birds per run, no more than a few pixels tall each, so the
  stools still read as stools.
- **The challenge table (`match-table`, or your smaller square):** a plain square table, warm-wood base and a **white top**.
- **The railroad crossing (floor road + `crossing-post` x 2):** a gravel-colored road strip with two steel rails and wooden ties (the
  rails crossing the strip), a yellow and black edge, a red-and-white crossbuck at each end. Each `crossing-post` is a 1 x 1 upright (about 84
  px tall) with a red light and a striped barrier arm raised out of the way.
- **Shrubs (`shrub`, `shrub-b`), plants (`plant`) and the standing lamp (`lamp`):** as in round 1.
- **The front:** `hem` (about 24 px, charcoal, a yellow edge) and `entrance` (2 x 1, about 74 x 110, glass doors in warm-wood frames
  standing open, the bright day beyond; `exit: true`). It must clearly read as the way out.

## The colors (as round 1: Birdie's train, not a boss's)
Train **yellow** about `#f4c430`, deeper `#d9a21b`, pale `#ffe27a`; **charcoal** `#2b2d31`, `#3a3d44`, `#54575f`; train **red** `#c8372d`
with a deeper `#8e1f1a`; **warm wood** `#a86a3c`, `#7a4a26`, `#c99866`; cream `#f3f1ec`, white; greens for the shrubs and plants
(`#4f7a3a`, `#6f9a4f`, `#2f4f25`), a warm terracotta pot `#b5643a`. Seed colors: yellow `#e8c15a`, cream `#f2e3b8`, brown `#8a5a2e`, red
`#b5452e`. Outline `k` near-black warm brown (about `#1a1714`). Warm light `#ffe2a0` / `#ffb85c`. Bright and welcoming.

## Lights and pools
`SHOP_BIRDIE_LIGHTS` (each with its piece): the standing lamps, the sconces, the bar's bell (soft), the entrance's daylight, the arches'
glow (soft), the red crossing-post lights. `SHOP_BIRDIE_POOLS`: warm pools under the lamps, over the bartender's place, over the challenge
table, and at the entrance.

## Exports
`SHOP_BIRDIE_N = 12`, `SHOP_BIRDIE_LAYOUT`, `SHOP_BIRDIE_PIECES`, `SHOP_BIRDIE_SIDE_WALL_GRID`, `SHOP_BIRDIE_WALL_H`, `SHOP_BIRDIE_BOARD_BOX`
(the flap grid's x, y, w, h in the board's pixels), `SHOP_BIRDIE_COUNTER_SIGN`, `SHOP_BIRDIE_BARTENDER_SPOT` (`{ col: 6, row: 2 }`),
`SHOP_BIRDIE_LIGHTS`, `SHOP_BIRDIE_POOLS`, `SHOP_BIRDIE_CAM` (the fixed camera: the whole 12 x 12 room seen as round 1's camera does), and
**`SHOP_BIRDIE_INTERIOR_3`** (id `shop-birdie-interior-3`): the whole room as one Character with its own `idle` (about 8 frames at about
500 ms: the board's rows flipping in turn, a train passing on one track now and then, the birds on the stools bobbing a little, the gate
lights blinking in turn; the rest still), and one viewing animation per piece (`review-<name>`) for the render tool.

Define `ShopPlace` in your file (`{ piece, col, row, w?, d?, rot?, exit?, solid? }`), as round 1 does. The piece names the game reads must
match the ones the layout uses. The game wires this room later; keep the export names the same as round 1's.

## Looks
Render each new piece at 3x or 4x: the U-shaped bar's corner and an arm (the stools, their birds and the feeders on the counter), the seed
vat, the shelves, the challenge table with its two stools and its feeders, the crossing road and both gates, the board's flap grid (one row
mid-flip), and two floor tiles side by side. Then the room's idle at scale 1, **a few frames only** (a many-image request can't take a
picture over 3,000 px). Check: the bar reads as three sides, stools on all three outer sides with birds on several; feeders on the counter
in place of drinks; the seed vat is inside the U, beside the bartender's clear place; shelves of seed behind the bar; the challenge table is
small, square and white-topped, with a stool each side and feeders on its top and beside it; the two gates sit on different rows and sides;
no stool, chair, table or feeder is on the crossing; the crossing reads as a gravel railroad crossing, not a dashed road; the board's flaps
show pictures and no letters or numbers; the room is still 12 x 12.

Call done with notes: your choices (where you moved any piece from the suggested layout, and why; the table's size and why it is that size;
whether the feeders on the floor are 1 or 2), each piece's size in pixels and squares, the side wall's picture size, and the exports.

## How to write it
**Never write the whole drawing in one call.** The first run died when it tried to copy round 1's 691-line file in a single write and
ran out of output room (a turn's 48,000-token ceiling). Build the file in parts instead: each `write_drawing` or `edit_drawing` call adds
**at most about 250 lines**. Read round 1's file in line ranges (`read_file` with `from` and `to`), and write its pieces across several turns:
the palette and helpers first, then the back wall, then the bar, the table, the crossing, the vat and the shelves, then the exports and the
idle. Render once as it is, so you see round 1 before you change it, then render as you go.
