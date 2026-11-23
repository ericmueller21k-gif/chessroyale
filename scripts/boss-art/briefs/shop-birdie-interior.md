# Inside Birdie's station: its lobby, with airport seats, a café counter and a split-flap board

You are drawing a **room**, not a boss: the lobby inside Birdie's station (its front is `scripts/boss-art/out/house-birdie/house-birdie.ts`,
if it's drawn by the time you look: a one-story station, warm wood and charcoal, train yellow and red trim, a big nest on the
roof). Eric, Nov 23: "a normal, cozy train station ... airport-style seating ... a little sit-down restaurant/bar area, like a
lobby in a way in the airport." Players tap the station, "Go in", and the view fades into this room.

Eric's brief, in full:
- **Shrubbery** filling in spots.
- **Airport-style seating**: rows of seats.
- **A little sit-down café/bar counter** with stools.
- **On the back wall, a big old-school split-flap board**, like an airport's arrivals board. **No letters or numbers**: its
  flaps show little pictures (a little train, a clock face with no numbers, a nest, an arrow, a tiny bird). The flaps flip now and
  then, in turn.
- **Behind, through big windows or open arches at the back: 2 or 3 tracks** running away into the distance in perspective, with a
  yellow toy diesel train (Birdie's train: yellow, dark roof, red stripe) sliding in and out now and then. That background is
  scenery, not walkable, and gives depth.

Nothing else is in the room beyond the walls' own trim, the seats, the counter, the stools, the shrubs and the board.

## Build it as the Battle Tower's lobby is built (one file, self-contained)
Read first, and follow its structure: `scripts/boss-art/out/house-shop-tower/house-shop-tower.ts` (a small room: every piece its
own `Character` named `shop-<room>-<name>`, floor tiles first in the layout, the back wall's pieces on row 0, the side walls as
**one surface each** drawn from a wall picture (`...SIDE_WALL_GRID(west, run)` returning palette-key rows, `run` squares long,
`WALL_H` tall; the layout keeps the side squares solid with blank pieces), the front row's low hem and the way out, lights and
pools per piece, a fixed camera for a small room seen whole). For the counter and the `ShopPlace` type, see
`scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts` (`SHOP_BIGBOY_COUNTER`, `..._COUNTER_SIGN`, its `ShopPlace`), and
`packages/app/src/town/shops/room.ts` (the layout's `ShopPlace` and `Room` types, as the game reads them).
- Your file imports only the types and `paint`-style helpers from `../../../../packages/app/src/characters/sprite.ts` and
  `../../../../packages/app/src/town/houses/kit.ts` (both exist). Write any helper you need (a canvas of keys, `rect`, `hash`)
  into your file. Define `ShopPlace` in your file as Big Boy's shop does.
- Each paint function must not lean on anything that changes after the call (use a fixed hash of (x, y) for scatter).
- **Footing:** 37 px a square, a piece's foot the middle of its square (a wide piece's: the middle of its width, on its row);
  floor tiles flat, top-down, 37 x 37, foot at their middle; uprights stand at their foot, with the town's soft ground shadow.

## The colors: Birdie's train (not a boss's)
Train **yellow** about `#f4c430`, deeper `#d9a21b`, pale `#ffe27a`; **charcoal** `#2b2d31`, `#3a3d44`, `#54575f`; train **red**
`#c8372d` with a deeper `#8e1f1a`; **warm wood** `#a86a3c`, `#7a4a26`, `#c99866`; cream `#f3f1ec`, white; a sprig of green for the
shrubs and plants (`#4f7a3a`, `#6f9a4f`, `#2f4f25`, with a pot in warm terracotta `#b5643a`). Outline `k` near-black warm brown
(about `#1a1714`). Warm light `#ffe2a0` / `#ffb85c`. Make the room **bright and welcoming**, not gloomy: cream walls with a
charcoal dado and a red stripe, a yellow safety line on the floor by the way in, say, rather than dark everywhere.

## The room: 10 x 10 squares (columns 0-9 west to east, rows 0-9 north to south; you come in at the south)
```
row 0      the back wall: wall-none at the corners (0 and 9); an open ARCH at columns 1-2 and another at columns 7-8 (the
           tracks seen through them); the split-flap BOARD across columns 3-6 (4 x 1)
rows 2-3   airport seats: a block of seat rows at columns 1-3, facing north toward the board (row 2 behind, row 3 in front)
row 3      the café COUNTER at columns 6-8 (3 x 1), facing south, with its STOOLS in front of it on row 4 (columns 6, 7, 8)
rows 4-7   the BATTLE CROSSING (`ring-crossing`, a floor piece, 4 x 4 at columns 3-6): the match spot. A railroad crossing on the tiles, with its match table (2 x 1) at columns 4-5 on row 5, and two chairs from the café's own seating, one each side of the table at (4, 4) and (4, 6), facing each other across it
rows 1-8   open floor; a clear way from the door to the café and the board, going round the crossing (the crossing itself is walkable floor)
row 1      a potted PLANT at column 1 and column 8 (corners); a SHRUB at (1, 8) and (8, 8) (the front corners)
row 9      the front: a low hem, and the way out at columns 4-5 (glass doors onto the street, the day bright through them)
cols 0, 9  the side walls: one surface each (SHOP_BIRDIE_WALL_H tall), solid blanks in the layout
```
The lamps: a standing warm lamp at column 4 on row 2 and another at column 5 on row 7 (one-square pieces, lit).

## The pieces (sizes in squares, 1 square = 37 px)
- **Floor (`floor-a`, `floor-b`, and a border):** a station floor of terrazzo, cream and warm stone flecks, one tile per square,
  calm (a few flecks, a soft sheen on the light ones). A **yellow safety line** (`floor-edge-*`, turned with `rot`) runs one square
  in from the side walls and along the front, the platform's edge. A `floor-door` tile at the entrance (a welcome mat in charcoal
  with a yellow edge).
- **The back wall (`wall`, about 37 x 130, tiling):** cream plaster over a charcoal dado to about a third of its height, a red
  stripe rail, slim warm-wood pilasters now and then (`wall-pilaster`). `wall-none` blanks.
- **The arches (`arch`, 2 x 1, about 74 x 130):** open arches in warm wood with a yellow keystone, the opening showing the
  background: a pale sky above, and **2 or 3 tracks** receding in perspective (their rails converging to a point at the arch's
  middle, the ties in steps). Their idle: a yellow toy diesel train slides across one track now and then (in on the left, past,
  out on the right), then the track is empty again. Put the train on the nearest or middle track only, so it reads as moving
  away from the room.
- **The split-flap board (`board`, 4 x 1, about 148 x 130, on the back wall):** a charcoal frame with a yellow rim, a grid of
  flaps (about 3 rows of 7), each flap a small charcoal rectangle with a thin hinge line across its middle, and on each flap a
  little **picture** (a train, a clock face with tick marks and no numbers, a nest, an arrow, a tiny bird). **Never draw letters or
  numbers.** The idle: rows flip **in turn**, one row at a time, now and then: a flap mid-flip is drawn as its top half falling
  (the split-flap look), then it settles on its new picture. Export the flap grid's box (`SHOP_BIRDIE_BOARD_BOX`: x, y, w, h in
  the piece's pixels), so the game can put real text on it later if Eric wants.
- **The side walls (`SHOP_BIRDIE_SIDE_WALL_GRID(west, run)`):** the same wall as one long surface (`run` squares): the dado, the
  rail, the plaster, pilasters every 2 to 3 squares, a warm sconce or two (their glow in the picture; lights below).
- **Airport seats (`seats`, 3 x 1, about 111 x 44, two rows at columns 1-3):** a molded row of three seats, charcoal shells, yellow
  seat cushions, armrests between them, a little wall-mounted sign on the back if it reads. Facing north, toward the board.
- **The café counter (`counter`, 3 x 1, about 111 x 32):** a sit-down bar: a warm-wood top with a cream edge, a charcoal front with a
  red stripe, a little brass service bell and a small coffee urn on the top. **Keep it low, at most about 32 px tall**, so the
  stools read in front of it. Its front faces south.
- **Stools (`stool`, 1 x 1 each, three of them):** tall round stools, a warm-wood seat with a yellow cushion, a charcoal post and a
  ring footrest, their feet on the floor in front of the counter.
- **The board's wall, behind the seats (`wall-sconce`):** one warm wall lamp where it fits (a gold-brass fan lamp in train yellow).
- **Shrubs (`shrub`, 1 x 1, two variants):** a round, leafy hedge in the greens, a few flower dots (a red or yellow pixel here and
  there), on a soft ground shadow.
- **Potted plants (`plant`, 1 x 1):** a leafy potted plant in a terracotta pot, taller than the shrub.
- **Standing lamp (`lamp`, 1 x 1):** a warm-wood pole and a cream shade, a soft pool of light.
- **The battle crossing (`ring-crossing`, 4 x 4 floor, plus its pieces):** the match spot, the lobby's "battle circle". Name it
  with the `ring` prefix so the game draws it on the floor. A railroad crossing painted on the tiles: a charcoal road strip
  crossing two steel rails, the rails in pale grey with the wooden ties, a yellow and black edge, a red-and-white crossbuck sign
  at each corner. At its west and east edges, a lamp post with a red light and a raised striped barrier arm (`crossing-post`,
  1 x 1 upright, the arm up and out of the way). The table `match-table` (2 x 1) is a café table in warm wood with a cream top;
  the two chairs `café-chair` (1 x 1 each, the café's own) face each other across it. Nothing else on the crossing.
- **The front:** `hem` (37 x about 24: the front wall's low top, seen from inside, in charcoal with a yellow edge) and `entrance`
  (2 x 1, about 74 x 110): glass doors in warm-wood frames standing open, the bright day beyond. It must clearly read as the way
  out. `{ exit: true }`.

## Lights
`SHOP_BIRDIE_LIGHTS` (each with its `piece`): the sconces, the standing lamps, the café's bell and urn (soft), the entrance's daylight,
and the arches' glow from the sky (soft); `SHOP_BIRDIE_POOLS`: warm pools under the lamps, in front of the counter, and on the floor
at the entrance.

## Exports
`SHOP_BIRDIE_N = 10`, `SHOP_BIRDIE_LAYOUT`, `SHOP_BIRDIE_PIECES`, `SHOP_BIRDIE_SIDE_WALL_GRID`, `SHOP_BIRDIE_WALL_H`,
`SHOP_BIRDIE_BOARD_BOX` (the flap grid's x, y, w, h in the board's pixels), `SHOP_BIRDIE_COUNTER_SIGN` (if the counter has a sign at
all: a blank plaque, as `signFace` gives), `SHOP_BIRDIE_LIGHTS`, `SHOP_BIRDIE_POOLS`, `SHOP_BIRDIE_CAM` (the fixed camera's look,
as the lobby's: the room seen whole), and **`SHOP_BIRDIE_INTERIOR`** (id `shop-birdie-interior`): the whole room laid out as one
Character, with its own `idle` (about 8 frames, about 500 ms each: the board's rows flipping in turn, and the train passing on
one track every few seconds; the rest still), and one viewing animation per piece (`review-<name>`) for the render tool.

## Looks
Render each piece at 3x or 4x: the board's flap grid (a row mid-flip, and the picture on each flap), the arch's train (a few frames
of the pass), the seats, the counter with its stools, the shrub and plant, and two floor tiles side by side with `tile: "x"`. Then
the room's idle at scale 1, **a few frames only** (a many-image request can't take a picture over 3,000 px). Check: the floor tiles
tile with no seams and stay calm at 4x; the board's flaps read as pictures with no letters or numbers; the train reads as Birdie's
train on a track in perspective; the counter is low enough for the stools to read; the way from the door to the board is clear;
nothing else is in the room.

Call done with notes: your choices, each piece's size in pixels and squares, the side wall's picture size, and the exports.

## How to write it
Write a short skeleton first (the palette, the floor tiles, the back wall with its arches, the layout and the room still) and render
it; then add the pieces a few at a time with `edit_drawing`, rendering as you go. Keep each turn's writing under about 600 lines.
