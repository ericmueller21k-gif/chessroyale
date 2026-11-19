# The Battle Tower's floor room: one room, redrawn for every floor (1 to 99)

You are drawing a **room**, not a boss: the room on each floor of the Battle Tower (a 99-floor skyscraper in Chess Town, slate
and gold Art Deco: its front is `scripts/boss-art/out/house-tower/house-tower.ts` and its lobby
`scripts/boss-art/out/house-shop-tower/house-shop-tower.ts`, if drawn by the time you look). Each floor is one chess game against
one, two or three bosses. The player walks in from the bottom to the table; then the floor's bosses come out of the door at the
top (the elevator) one after another and walk to their places on the far side of the table.

**Eric, Nov 18:** "make it simple just a challenge style room with a center circle like we do, but the room is hunchess color
themed ... the redraw simply adds a number posted on the wall on both sides like a big '4' the chess board and chairs are just
hunchess color themed as well nothing special ... There's an above door and once you walk in and go to the board they will come
out the top door and walk to the board, the room itself can be snug."

So: **snug, plain, handsome**: a center circle, the walls, the big floor number on both side walls, the elevator door at the top,
the way in at the bottom. **Nothing else** (no props, plants, statues or furniture: the table and chairs are drawn by the game).

## Build it as the Walk-up's hall is built (one file, self-contained)
Read first, and follow its structure: `/home/user/main-wt/packages/app/src/town/shops/recluse-stairs-art.ts` (a small box room:
every piece its own `Character` named `shop-<room>-<name>`, floor tiles first in the layout, the back wall's pieces on row 0, the
side walls as **one surface each** drawn by the game from a wall picture, the layout keeping those squares solid with blank
pieces; the front's low hem and the way in; lights and pools per piece; a fixed camera for a small room seen whole). The side-wall
drawer: `/home/user/main-wt/packages/app/src/town/shops/side-walls.ts`. The challenge rooms' circles: Big Boy's shop
`scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts` (its `circle-*` tiles; the game finds the table's place from the box
round the `circle-*` tiles: `/home/user/main-wt/packages/app/src/town/shops/challenge.ts` `marksOf`).
- Import only from `../../../../packages/app/src/characters/sprite.ts` and `../../../../packages/app/src/town/houses/kit.ts`;
  write any helper you need into your file; define `ShopPlace` in your file as Big Boy's shop does.
- Each paint function must not lean on anything that changes after the call (a fixed hash of (x, y) for any scatter).
- **Footing:** 37 px a square, a piece's foot the middle of its square (a wide piece's: the middle of its width, on its row);
  floor tiles flat, top-down, 37 x 37, foot at their middle; uprights stand at their foot.

## The colors: HunChess's own (not a boss's)
Deep slate `#16181d`, `#20232a`, `#2a2e37`, `#343946`, lit slate about `#4a5163`; **gold** `#f4b740`, `#c8860d`, dark gold about
`#8a5c08`; cream `#f3f1ec`, white; the chessboard's squares `#f0d9b5` and `#b58863`. Outline `k` near-black slate (about
`#0e1014`). Warm light `#ffe2a0` / `#ffb85c`. Match the lobby's walls if it's drawn (cream or pale gold over a slate dado, gold
trim), so the tower feels like one building, but a touch more dramatic: this is where the games are played.

## The room: 10 x 10 squares (columns 0-9 west to east, rows 0-9 north to south)
```
row 0      the back wall: wall-none at the corners; the ELEVATOR at columns 4-5 (the top door: the bosses come out of it);
           plain wall either side
rows 2-7   the CENTER CIRCLE: columns 2-7, rows 2-7 (6 x 6 squares, round or octagonal), its middle on the corner between
           columns 4-5 and rows 4-5 (x 5.0, y 5.0): the table stands there; the bosses' places on its north side, yours south
row 9      the front: a low hem, and the way in at columns 4-5 (you come in from the bottom)
cols 0, 9  the side walls: one surface each, the BIG FLOOR NUMBER on each; solid blanks in the layout
```
Keep a clear way from the elevator down to the circle (columns 4-5) and from the way in up to it.

## The pieces
- **Floor (`floor-a`, `floor-b`):** the tower's checkered floor (the lobby's, if drawn: the board's two colors, polished,
  calm), one tile per square; a slim gold inlay one square in from the walls is welcome.
- **The center circle (`circle-*` tiles, flat):** a bold arena floor in HunChess colors, like a game's gym floor: a slate disc
  with a **gold ring** for its edge, a quiet inner ring, and a small gold emblem (a chess-king crown or a sunburst) in the very
  middle, where the table stands (2 x 2 squares round the middle corner). The middle line, if any, runs west to east. **No
  start marks:** the game places everyone. Draw it as floor tiles, as Big Boy's circle (each tile named `circle-<n>`, the
  same tile reused where turned or mirrored copies match).
- **The back wall (`wall`, about 37 x 130, tiling; `wall-pilaster`):** as the lobby's: a slate dado, a gold rail, cream or
  pale-gold plaster above, slim Art Deco pilasters.
- **The elevator (`elevator`, 2 x 1, about 74 x 130, in the back wall):** the lobby's elevator seen from this floor, the door
  the bosses come out of: two brushed-gold sliding doors (closed, a center seam, a sunburst etched across them) in a slate and
  gold frame, a gold floor dial over them (a needle, tick marks, no numbers), a soft light above. In the layout:
  `{ door: "top" }`, not solid.
- **The side walls (`towerFloorWallGrid(west, run, floor)`):** one long surface each, `run` squares long (the game passes
  `run`: the room's 10 squares plus 2, from the back wall's corner forward past the camera), `SHOP_TOWER_FLOOR_WALL_H` (about
  130) tall: the dado, the rail, the plaster, a pilaster every 3 squares, and **the floor number painted big** on it:
  - **digits about 70 to 80 px tall**, gold with a dark gold shadow and a fine dark outline, bold Art Deco numerals (thick
    strokes, clean geometry, reading at a glance from across the room), in a slate panel with a gold frame if it reads better;
  - **one or two digits** (1 to 99): two digits must fit side by side (try "57" and "88"), centered on the same spot;
  - centered about **4 squares from the back corner** along the wall (x about 150 of the picture), so it's in view;
  - **the picture is seen from inside the room:** on the **west** wall the game shows its picture **mirrored left to right**
    (the back corner, x 0, is on the right as you look at it), so write the digits **mirrored in the west wall's grid** (each
    glyph flipped and the order reversed) so they read correctly on screen; the **east** wall's picture shows as drawn. Check
    both with the render (draw a review strip that shows the west picture flipped back, as the screen will).
  - Export the digits too (`TOWER_DIGITS`, 0-9 as pixel grids) and `towerFloorWallGrid` as a function of `floor`.
- **The front:** `hem` (37 x about 24: the front wall's low top, seen from inside) and `entrance` (2 x 1, about 74 x 110): the way
  in from the bottom, a doorway in a gold frame onto the lit landing (the elevator's hall). `{ exit: true }`.

## The table and chairs (drawn by the game, recolored)
The game draws the town's park table (`/home/user/main-wt/packages/app/src/town/houses/park.ts` `PARK_TABLE`: a pedestal leg,
a stool each side; its palette keys "1" to "5" run light to dark) and lays the board on its slab (`shops/intro.ts paintTable`,
keys as `/home/user/main-wt/packages/app/src/town/shops/bigboy-intro-art.ts` `INTRO_BIGBOY_TABLE_PALETTE`). Give it HunChess
colors:
- `SHOP_TOWER_FLOOR_TABLE_PALETTE`: `k`, "1"-"5" (the slab: its gold top edge, slate top, mid, front, deep), `L` and `D` (the
  board's squares: `#f0d9b5` and `#b58863`), `P` and `Q` (the pieces: `#fbfbf6`, `#262321`);
- `SHOP_TOWER_FLOOR_STOOL_PALETTE`: the park table's keys "1"-"5" (the leg and the stools) in slate with a gold seat;
- and for the review only, **`table-mock`**: the table as it will look on the circle (a slate pedestal, its slab with a plain
  8 x 8 board lying flat seen from the room's camera angle, a chair north and south of it in slate and gold), one upright
  piece standing at the circle's middle, so the room still shows the whole floor. Not used by the game.

## Lights
`SHOP_TOWER_FLOOR_LIGHTS` (each with its `piece`): the elevator's light, soft wall sconces on the side walls if drawn there (in the
wall picture), the way in; `SHOP_TOWER_FLOOR_POOLS`: a warm pool over the circle's middle, one in front of the elevator.

## Exports
`SHOP_TOWER_FLOOR_N = 10`, `SHOP_TOWER_FLOOR_LAYOUT`, `SHOP_TOWER_FLOOR_PIECES`, `towerFloorWallGrid(west, run, floor)`,
`TOWER_DIGITS`, `SHOP_TOWER_FLOOR_WALL_H`, `SHOP_TOWER_FLOOR_TABLE_PALETTE`, `SHOP_TOWER_FLOOR_STOOL_PALETTE`,
`SHOP_TOWER_FLOOR_LIGHTS`, `SHOP_TOWER_FLOOR_POOLS`, `SHOP_TOWER_FLOOR_CAM` (the fixed camera's look: the room seen whole), and
**`HOUSE_SHOP_TOWER_FLOOR`** (id `house-shop-tower-floor`): the whole room laid out as one still (the back wall, the floor, the
circle, `table-mock` at its middle, and the two side walls' pictures beside it for floor 4, as the screen shows them), with
viewing animations: `review-<name>` per piece, `review-walls-4` and `review-walls-57` (both walls as seen on screen, floor 4
and floor 57).

## Looks
Render the elevator, the circle (its tiles together) and `review-walls-4` / `review-walls-57` at 2x or 3x, then the room still at
scale 1, **one frame only** (a many-image request can't take a picture over 3,000 px). Check: the numbers read correctly on both
walls (not mirrored) and two digits fit; the circle reads as the battle floor; the elevator reads as the door the bosses come
out of; the floor tiles tile with no seams; nothing else is in the room.

Call done with notes: your choices, each piece's size, the wall picture's size, where the number sits, and the exports.

## How to write it (a first try ran out of room writing the whole file in one turn: don't)
- **Start from the lobby's file**, `scripts/boss-art/out/house-shop-tower/house-shop-tower.ts` (finished): read it once and copy
  what you can (its palette, its helpers, the floor tiles, the back wall, the elevator, the hem, the entrance, the side wall's
  picture, the room still's builder), so the two rooms match and you write less.
- Your **first `write_drawing` is a skeleton of at most about 300 lines**: the palette, the helpers, the floor tiles, the back
  wall, the layout and the room still. Render it.
- Then add the rest **a piece at a time with `edit_drawing`** (the circle; the elevator; the side walls and the digits; the
  front; the table palettes and `table-mock`; the review views), each edit at most about 250 lines, rendering as you go.
- Never write more than about 300 lines in one turn.
