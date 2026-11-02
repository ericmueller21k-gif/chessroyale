# Alfil's battle intro: the sand pyramid, his table and the sandstorm

## The plan (short)
Eric's design for every boss (Nov 2): "when you challenge a boss in town, they walk into their store with you and you each
walk to the middle area… he says a line out loud… each boss also has a unique animation for a chess board appearing, so
for elephant a sand pyramid forms between you, risen from the ground, then it starts cracking and inside the chess board
emerges on a table (for now the same table the town uses, but in a color more representative of the boss)… Then it does
a special load like a Pokémon battle screen flash, but each boss has their own. For Alfil, it's a sandstorm that blows
across and covers the screen, then you're right into the game."

The code comes later from another helper. You draw only the art, in one file, as three pieces that code can play simply:
1. **The pyramid.** A sand pyramid rises out of the floor in the middle of Alfil's battle circle, cracks, and falls away,
   leaving the table standing where it was.
2. **His table.** The town's chess table (`PARK_TABLE` in `packages/app/src/town/houses/park.ts`), in his colors.
3. **The sandstorm.** A full-screen transition, built as two small looping pictures that code slides and tiles. That
   way it fits any screen size, with very little code and no lag.

Simple beats flashy (Eric's rule): short frame loops, small pictures, nothing that needs new rendering tricks.

## Read first
- `packages/app/src/town/houses/park.ts`: `PARK_TABLE` (the leg and the two stools; the renderer draws the slab, board
  and pieces), its `PALETTE` keys `"1"`-`"5"`, `TABLE_BOARD`, `TABLE_INK`. Then `packages/app/src/town/render.ts`,
  `paintBoard`: the slab's faces take the table's palette keys `"4"` (front), `"2"` (top) and `"1"` (top edge).
- Alfil: `packages/app/src/characters/alfil.ts` (`ALFIL_PALETTE`); his pyramid outside, `packages/app/src/town/houses/alfil.ts`;
  his shop inside, `scripts/boss-art/out/house-shop-alfil/house-shop-alfil.ts` (its sand, sandstone, gold, red and blue,
  and how the sand fountain's sand is drawn). Use those colors, value for value where you can.
- `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`).

Import from the repo with paths relative to your file (`../../../../packages/app/src/...`).

## The file and its exports (id `house-intro-alfil`)
One file. Each piece is its own `Character`:
- `INTRO_ALFIL_PYRAMID`
- `INTRO_ALFIL_TABLE`
- `INTRO_ALFIL_STORM`
- `INTRO_ALFIL_FRONT`

Also export `HOUSE_INTRO_ALFIL` (id `house-intro-alfil`): a review sheet whose `idle` shows the pieces side by side, with
one extra animation per piece animation so each can be rendered on its own.

### 1. `INTRO_ALFIL_PYRAMID` (stands on the table's square, the same foot as the table)
- **Size:** 3 squares wide like the table (111 px, 37 px a square) and about 110 px tall. Its foot is exactly the
  table's foot (`[55, 44]` in a 111-wide picture, or the same offset if you make it taller), so code draws it right over
  the table.
- **Look:** a smooth sand pyramid, with sand streaming down its sides. It's built of his desert sand (the shop's sand
  colors), lit from the top left, with a soft ground shadow.
- **Animations** (each plays once, except `idle`):
  - `rise`, 8 frames at about 90 ms: a mound of sand swells up out of the floor and grows into a pyramid. Sand pours down
    its sides as it climbs, and dust puffs out at the base. The last frame is the whole pyramid.
  - `idle`, 1 to 2 frames: the whole pyramid, a grain or two trickling. It holds while the boss says his line.
  - `crack`, 6 frames: cracks run down from the apex. Gold light shines out through them, brighter each frame, and sand
    spills from the cracks.
  - `crumble`, 8 frames: the pyramid breaks and falls away outward and down in chunks and sliding sand, with a puff of
    dust. **From frame 3 on, leave the middle clear** where the table stands (about 60 x 50 px over the foot), so code can
    draw the table behind the falling sand. The last frame is only a low ring of drifted sand round the foot, which the
    game can keep or fade.
- The game draws the table (and its board) behind the pyramid from `crumble` frame 3. Say in your notes exactly which
  frame the table should appear on.

### 2. `INTRO_ALFIL_TABLE`: the town's table in his colors
- **Same shapes and sizes as `PARK_TABLE`:** the leg and the two stools, the same width, height, foot and `TOP_Y`, so the
  renderer's slab and board land in the same place. Copy its geometry. Only the colors and small details change:
  - the leg becomes a short sandstone column with a gold band;
  - the stools become little sandstone drums with a red and blue band.
- **Export `INTRO_ALFIL_TABLE_PALETTE`:** its keys `"1"` to `"5"` (lightest to darkest: sandstone and gold) drive the
  slab the renderer draws. The top `"2"`, its edge `"1"` and the front `"4"` must read clearly as warm sandstone with a
  gold edge.
- **Export `INTRO_ALFIL_TABLE_INK`:** the board's light and dark squares in his colors, with the same keys as `TABLE_INK`
  (`light`, `lightShade`, `lightLine`, `dark`, `darkShade`, `darkLine`). For example, pale sand and his deep blue. **The
  board must stay easy to read:** strong contrast between the light and dark squares, and the cream and charcoal pieces
  must show clearly on both. Show this in a render: paint a small 8 x 8 board with a few of `TABLE_PIECES`' shapes on it,
  in the review sheet.

### 3. The sandstorm: `INTRO_ALFIL_STORM` and `INTRO_ALFIL_FRONT`
Code builds the full-screen transition from two small pictures, scaled up 3x with no smoothing (nearest-neighbor):
- **`INTRO_ALFIL_STORM`** (128 x 128, **tiles seamlessly both ways**): a thick wall of blowing sand that fills the screen.
  - Streaks and swirls of grains rush left to right in layers: pale sand, gold and darker ochre, with a hint of dust
    haze.
  - It's mostly opaque (it must hide the scene behind it), with darker gusts and bright grains.
  - `idle`: 6 frames at about 70 ms, looping. The sand races right across the tile: each layer shifts by a whole number
    of pixels a frame, and the loop closes with no jump (each layer's shift over 6 frames is a multiple of its pattern's
    width).
- **`INTRO_ALFIL_FRONT`** (48 x 128, **tiles seamlessly top to bottom**): the storm's leading edge. Its left side is the
  storm (it matches `INTRO_ALFIL_STORM` where they meet, fully opaque at the left edge) and its right side is a ragged,
  billowing edge thinning to clear, with grains and dust flying ahead.
  - `idle`: 6 frames at about 70 ms, looping. The billows churn.
- **How code uses them (so you draw the right thing):**
  - **In:** a column of `FRONT` tiles sweeps from the left edge to past the right edge in about 0.6 s, with tiled `STORM`
    filling everything behind it.
  - **Covered:** a beat of full `STORM`.
  - **Out:** the scene is the game now; the storm slides off to the right the same way, its trailing edge being `FRONT`
    mirrored.
- Show it in the review sheet: a 3 x 2 tiling of `STORM` with the `FRONT` column at its right, so the seams can be
  checked.

## Looks
- Render each animation frame by frame (at 2x or 3x), on both backgrounds.
- Then render the review sheet at scale 1, **one frame only**. A many-image request can't take a picture over 3,000 px,
  and the renderer now shows only the frames that fit.
- Check that:
  - the pyramid rises, cracks and crumbles cleanly, and its foot matches the table's;
  - the table's palette and board ink read clearly, with the pieces visible on both squares;
  - the storm tile and the front tile with no seams and loop with no jump.

Call done with notes: each piece's size and foot, each animation's frames beat by beat, the frame on which the table
appears, and how code should play the storm.

## How to write it
Build the file in steps:
1. `write_drawing` the palette, the table and the review sheet, and render them.
2. Then add the pyramid's animations, then the storm, with `edit_drawing`, rendering as you go.
3. Keep each turn's writing under about 600 lines.
