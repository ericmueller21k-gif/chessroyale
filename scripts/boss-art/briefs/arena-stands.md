# The Colosseum's inside: one piece of the arena

You are drawing **scenery, not a boss**: one piece of the inside of the Colosseum in HunChess's town, where a weekly
chess tournament is watched from the stands. The game builds the arena (a ring of tiered stands round a sandy floor with
a giant chessboard on it, seen from a seat high in the stands) out of many such pieces, placed and repeated by code. So
draw **this one piece**, cleanly, on a transparent background; never a whole scene.

## The style
- Eric's mockup sets it (view_reference: `a-mockup.jpg` whole, and the close-ups `b-…` to `e-…`): pixel art, warm
  sandstone, navy banners with a gold crown, torches on stone pillars, tiered stands packed with a crowd, a giant board on
  the floor with big white and black pieces trimmed in gold. Take shapes and feel from it, never its pixels; ours is
  cleaner, chunkier pixel art.
- Match the town: read `packages/app/src/town/houses/coliseum.ts` (its PALETTE and how it shades stone; the Colosseum's
  outside) and `packages/app/src/town/houses/kit.ts` (`paint`, `grain`). Light from the **top left**, an outline in `k`
  (`#2a1c14`) where the shape meets the background, banded shading (lit, mid, shade; never smooth gradients), and
  the coliseum's colors: travertine stone `1`..`6` (`#fbf0d8` `#ecd9b2` `#d8bf93` `#bb9e70` `#93784f` `#6a5539`), the dark
  of an opening `x` `#2e2018` / `z` `#150e0a`, navy `N` `#1f2a44` / `n` `#34466e`, gold `Y` `#f4b740` / `y` `#ffe08a` /
  `O` `#b97c10`, marble `M` `#f7f4ee` / `m` `#d9d3c7` / `o` `#a39b8d`. Use these same keys and values (add more keys
  only where needed), so every arena piece sits together.
- Read only what you need (packages/app/src/characters/sprite.ts for the format, kit.ts, coliseum.ts's palette and a
  part or two of it); skip the bosses. Earlier arena pieces, if any, are readable under `scripts/boss-art/out/arena-*/`:
  match them.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts` and
  `../../../../packages/app/src/town/houses/kit.ts`. Export the Character as a named const (upper case of the id, e.g.
  `ARENA_WALL`) with the id below and a short `name`.
- Never draw letters or numbers. Never draw anyone real, and nothing from the town's bronze statue.

## How to check
Render your animations (`render`, `scale` 4, both `bg`s) and, for a piece that repeats, `tile: "x"` (or `"xy"`) to see
the seams: a repeat must join with no visible edge. `anim: "*"` shows a set of stills side by side. Pace yourself: you
are at effort medium on a small cap; a clean, readable piece in a few renders beats a long polish. Call `done` with
notes: the frame size, where its foot/anchor is, how it repeats, and any exported points.

## This piece: `arena-stands`

A **slice of the tiered stone stands**, made to repeat side by side round the ring (the game bends the ring; you draw it
straight, seen from the front and a little above, as the far side of the ring looks from your seat).
- Frame **64 wide x 88 tall**; the slice's left and right edges must join seamlessly when tiled (`tile: "x"`).
- **4 rows** of stone benches stepping up and back (lowest row at the bottom; making higher rows smaller is not
  needed: keep the rows the same size, about 20 px apart). Each row: a lit bench top (a ledge) and its riser (the step's
  front face, in shade), with stone block joints. A narrow stair down the slice is not needed (the game adds aisles).
- **Seats:** 4 seats per row, every 16 px (x = 8, 24, 40, 56). Export `ARENA_STANDS_SEATS: [number, number][]`: for each
  seat, the point where a seated pawn's **foot** goes (bottom center of a pawn about 16 x 20 px). The game draws a pawn
  there and then draws the **next lower row's stone over it**, so the pawn's lower half is hidden behind the row in
  front: put each seat point a few pixels below the top of the next lower row's bench-front so that works, and make the
  part (or layer) order such that rows are separate parts in the idle frame, back row first.
- Also export `ARENA_STANDS_ROWS: { top: number; bottom: number }[]`, each row's band of pixels (back row first), so the
  game can draw row by row between the crowd. Leave the seats empty (no pawns drawn).
- The bottom of the slice is the first (lowest) row's front, which sits on top of `arena-wall`.
- Animation: `idle`, one frame.
