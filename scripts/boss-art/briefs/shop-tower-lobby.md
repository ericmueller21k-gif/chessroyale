# Inside the Battle Tower: its lobby, with the clerk's counter and the elevator

You are drawing a **room**, not a boss: the ground-floor lobby of the Battle Tower, a 99-floor skyscraper in Chess Town (its front
is `scripts/boss-art/out/house-tower/house-tower.ts`, if it's drawn by the time you look: slate and gold Art Deco). Eric, Nov 19:
"go into the town and then going into the big building in there, and then you talk to the guy at the front, like, at the
counter ... then you go up and then it begins." The player taps the tower, "Go in", and the view fades into this room. They walk
to the counter, talk to **the clerk** (a penguin bellhop; the game draws him from his own sprite, so **don't draw him**), and
then go up in **the elevator** at the back, to the floors where the chess games are.

**Nothing else is in the room** (Eric's brief): the counter with its clerk, the elevator, the checkered floor, a "Best floors"
board on a wall, the walls and the way out. No plants, sofas, luggage carts or decorations beyond the walls' own Art Deco trim.

## Build it as the Walk-up's hall is built (one file, self-contained)
Read first, and follow its structure: `/home/user/main-wt/packages/app/src/town/shops/recluse-stairs-art.ts` (a small box room:
every piece its own `Character` named `shop-<room>-<name>`, floor tiles first in the layout, the back wall's pieces on row 0, the
side walls as **one surface each** drawn by the game from a wall picture (`...SideWallGrid(west, run)` returning palette-key rows,
`run` squares long, `WALL_H` tall; the layout keeps the side squares solid with blank pieces), the front row's low hem and the
way out, lights and pools per piece, a fixed camera for a small room seen whole). The side-wall drawer is
`/home/user/main-wt/packages/app/src/town/shops/side-walls.ts`. For the counter and the shopkeeper's exports, see Big Boy's shop
`scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts` (`SHOP_BIGBOY_COUNTER`, `..._COUNTER_SIGN`, its `ShopPlace`).
- Your file imports only the types and `paint`-style helpers from `../../../../packages/app/src/characters/sprite.ts` and
  `../../../../packages/app/src/town/houses/kit.ts` (both exist; `shops/paper-kit.ts` doesn't here: write any helper you need, a
  canvas of keys, `rect`, `hash`, into your file). Define `ShopPlace` in your file as Big Boy's shop does.
- Each paint function must not lean on anything that changes after the call (use a fixed hash of (x, y) for scatter).
- **Footing:** 37 px a square, a piece's foot the middle of its square (a wide piece's: the middle of its width, on its row);
  floor tiles flat, top-down, 37 x 37, foot at their middle; uprights stand at their foot, with the town's soft ground shadow.

## The colors: HunChess's own (not a boss's)
Deep slate `#16181d`, `#20232a`, `#2a2e37`, `#343946`, lit slate about `#4a5163`; **gold** `#f4b740`, `#c8860d`, dark gold about
`#8a5c08`; cream `#f3f1ec`, white; the chessboard's squares `#f0d9b5` (light) and `#b58863` (dark). Outline `k` near-black slate
(about `#0e1014`). Warm light `#ffe2a0` / `#ffb85c`. Make the room **bright and welcoming**, not gloomy: cream and pale gold walls
over a slate dado, say, rather than slate everywhere.

## The room: 10 x 10 squares (columns 0-9 west to east, rows 0-9 north to south; you come in at the south)
```
row 0      the back wall: wall-none at the corners (0 and 9); the counter's backdrop behind the counter (columns 1-3);
           the ELEVATOR at columns 4-5 (the way up); the "Best floors" board at columns 7-8; plain wall between
rows 1-2   the clerk stands behind the counter on row 2 (columns 2-3: SHOP_TOWER_KEEPER, SHOP_TOWER_CLERK_AT [2.5, 2.4])
row 3      the COUNTER at columns 1-3 (3 x 1), facing south
rows 4-8   open floor; a clear way from the door straight up to the elevator (columns 4-5) and across to the counter
row 9      the front: a low hem, and the way out at columns 4-5 (glass doors onto the street, the day bright through them)
cols 0, 9  the side walls: one surface each (SHOP_TOWER_WALL_H tall), solid blanks in the layout
```

## The pieces (sizes in squares, 1 square = 37 px)
- **Floor (`floor-a`, `floor-b`, and a border):** the **chess-tile floor**: polished marble squares, one tile per square, in a
  checker of the board's two colors (cream-tan and a warm brown, toned calm so they don't buzz at 4x: a faint vein or two, a
  soft sheen on the light ones), with a slim **gold inlay line** framing the floor one square in from the walls (border tiles
  `floor-edge-*`, turned with `rot` as needed). The floor is on screen most of the time, big: keep it calm. A `floor-door`
  tile at the entrance (a doormat in slate with a gold edge).
- **The back wall (`wall`, about 37 x 130, tiling):** cream or pale-gold plaster over a slate dado to about a third of its
  height, a gold rail, slim Art Deco pilasters (gold lines) now and then (`wall-pilaster`). `wall-none` blanks.
- **The side walls (`SHOP_TOWER_SIDE_WALL_GRID(west, run)`):** the same wall, as one long surface (`run` squares): the dado,
  the rail, the plaster, pilasters every 2 to 3 squares, a sconce or two (their glow in the picture; lights below).
- **The elevator (`elevator`, 2 x 1, about 74 x 130, standing in the back wall):** the tower's way up, and it must read as one
  at a glance: two brushed-gold sliding doors (closed, a center seam, an Art Deco sunburst etched across them), a slate and
  gold frame, **a floor dial over the doors** (a gold half-round dial with a needle; tick marks, no numbers), a lit **up-arrow
  call button** beside it. In the layout: `{ door: "top" }` (the way to the floors) and not solid.
- **The "Best floors" board (`board-best`, 2 x 1, about 74 x 100, on the back wall):** a framed board for the best climbs (PR 10
  fills it): a dark slate panel in a gold frame, a **blank header plate** at its top (cream; the game writes "BEST FLOORS" on it:
  **never draw letters**), and **empty** below (faint ruled lines at most). Export where its header and its body are
  (`SHOP_TOWER_BOARD_HEAD`, `SHOP_TOWER_BOARD_BODY`: x, y, w, h in the piece's pixels).
- **The counter (`counter`, 3 x 1, about 111 x 32):** a front desk of slate with a gold top edge and a gold Art Deco band, a
  **blank brass plaque** on its front (the game writes "CLERK" on it: `SHOP_TOWER_COUNTER_SIGN`, as `signFace` gives), and a
  small brass service bell on its top. **Keep it low, at most about 32 px tall**, so the penguin (about 50 px, his face in his
  top 24 px) shows behind it.
- **The backdrop (`backdrop`, 3 x 1, about 111 x 130, behind the counter):** a pigeonhole key rack of slate and gold (little
  brass keys hanging in rows), the one hotel-lobby touch: plain, not busy.
- **The front:** `hem` (37 x about 24: the front wall's low top, seen from inside) and `entrance` (2 x 1, about 74 x 110): glass
  doors in gold frames standing open, the bright street beyond. It must clearly read as the way out. `{ exit: true }`.

## Lights
`SHOP_TOWER_LIGHTS` (each with its `piece`): the sconces, the elevator's call button and dial (soft), the entrance's daylight;
`SHOP_TOWER_POOLS`: warm pools under the sconces and in front of the elevator.

## Exports
`SHOP_TOWER_N = 10`, `SHOP_TOWER_LAYOUT`, `SHOP_TOWER_PIECES`, `SHOP_TOWER_SIDE_WALL_GRID`, `SHOP_TOWER_WALL_H`,
`SHOP_TOWER_COUNTER_SIGN`, `SHOP_TOWER_KEEPER` (the clerk's squares), `SHOP_TOWER_CLERK_AT`, `SHOP_TOWER_BOARD_HEAD`,
`SHOP_TOWER_BOARD_BODY`, `SHOP_TOWER_LIGHTS`, `SHOP_TOWER_POOLS`, `SHOP_TOWER_CAM` (the fixed camera's look, as the hall's:
the room seen whole), and **`HOUSE_SHOP_TOWER`** (id `house-shop-tower`): the whole room laid out as one still (the back wall,
the side walls as plain strips, the floor and every piece at its place, as Big Boy's room still is), with one viewing
animation per piece (`review-<name>`) for the render tool.

## Looks
Render each piece at 3x or 4x (the elevator, the counter, the board, two floor tiles side by side with `tile: "x"`), then the room
still at scale 1, **one frame only** (a many-image request can't take a picture over 3,000 px). Check: the floor tiles tile with
no seams and stay calm at 4x; the elevator reads as the way up; the counter is low enough for the penguin; the board's header is
blank; the way from the door to the elevator and the counter is clear; nothing else is in the room.

Call done with notes: your choices, each piece's size in pixels and squares, the side wall's picture size, and the exports.

## How to write it
Write a short skeleton first (the palette, the floor tiles, the back wall, the layout and the room still) and render it; then add
the pieces a few at a time with `edit_drawing`, rendering as you go. Keep each turn's writing under about 600 lines.
