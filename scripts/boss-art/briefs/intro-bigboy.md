# Big Boy's battle intro: the toy-block table and the lollipop swirl

## The plan (short)
Eric's design for Big Boy (Nov 2, his words): "His board appears is 6 toy blocks drop down and stack to form a 3,2,1
pyramid formation, and the board then plops on top. Then 2 more blocks drop for the chairs. The screen shroud effect when
the fight starts is a bunch of rainbow swirly lollipops."

The code comes later from another helper; you draw only the art, in one file. Follow Alfil's intro:
`scripts/boss-art/out/house-intro-alfil/house-intro-alfil.ts`, its brief `scripts/boss-art/briefs/intro-alfil.md`, and
its summary `scripts/boss-art/out/intro-alfil-nov2.md`. Make the same kinds of pieces, so the code that plays Alfil's
intro plays this one with the fewest changes:
1. **The block table (`INTRO_BIGBOY_BLOCKS`)**: the six blocks drop and stack into a 3-2-1 pyramid that is the table, the
   board plops on top, and two more blocks drop as the stools.
2. **The table's colors**: the palette for the board's slab and squares, as Alfil's had.
3. **The lollipop swirl**: a full-screen transition from two small looping tiles that code slides across any screen,
   exactly like Alfil's sandstorm. Code reuse beats a new effect (Eric's rule: simple beats flashy).

## Read first
- Alfil's intro (above), and `packages/app/src/town/houses/park.ts`: `PARK_TABLE`, `TABLE_BOARD`, and its `PALETTE`
  keys `"1"`-`"5"`, `L`, `D`.
- The renderer draws the slab and board: `paintBoard` in `packages/app/src/town/render.ts`. It uses the palette's `"4"`
  for the front face, `"2"` for the top and `"1"` for the top edge, and `L`/`D` for the squares; the town's `TABLE_INK`
  colors the pieces.
- Big Boy: `packages/app/src/characters/bigboy.ts` (`BIGBOY_PALETTE`: his toy rainbow; how his toy block and his swirly
  lollipop are drawn). His shop: `scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts`.

## 1. `INTRO_BIGBOY_BLOCKS` (the same picture size and foot as `PARK_TABLE`, or taller with the same foot offset)
- **The table:** six toy blocks (cubes with a letter or a shape on their faces, in his rainbow, lit from the top left)
  stack into a 3-2-1 pyramid centered on the table's foot:
  - three on the bottom, two on them, one on top;
  - the top of the top block must be at the height where the renderer lays the board's slab (`TABLE_BOARD.top` over the
    foot, about 26 px, as `PARK_TABLE`'s top);
  - so the blocks are small, about 12 to 14 px.
  - The board lies on the top block, wider than it, balanced: that's the joke.
- **The stools:** two more blocks, one where each of `PARK_TABLE`'s stools stands, at its seat height.
- **Animations:**
  - `build`, about 16 to 20 frames at about 70 ms. The six table blocks drop in one by one from above the picture: the
    bottom row left to right, then the middle two, then the top. Each lands with a little squash and bounce and a puff.
    Make the picture tall enough for the drop.
  - `plop`, about 4 to 6 frames: a puff of dust and a few stars round the top block, as the board lands. The board itself
    is drawn and dropped by the code.
  - `chairs`, about 6 to 8 frames: the two stool blocks drop in, with a bounce and a puff.
  - `idle`: the finished table and stools, still.
- **Cues:** say in your notes which frame each block lands on (for sounds), and when the board should drop.

## 2. The table's colors
- **`INTRO_BIGBOY_TABLE_PALETTE`:**
  - `"1"`-`"5"` for the slab's faces, a soft toy-like slab (a padded play mat edge, or a block's colors);
  - `L` and `D` for the board's squares, in his colors but **easy to read**: strong contrast, with cream and charcoal
    pieces showing clearly on both. Show it in the review sheet: a small 8 x 8 board with a few of `TABLE_PIECES`' shapes.

## 3. The lollipop swirl: `INTRO_BIGBOY_SWIRL` and `INTRO_BIGBOY_SWIRL_FRONT`
Code builds the transition from two small pictures scaled 3x with no smoothing, as it does Alfil's sandstorm:
- **`INTRO_BIGBOY_SWIRL`** (128 x 128, **tiles seamlessly both ways**): a crowd of rainbow swirly lollipops, big and
  small, overlapping on every side so nothing shows behind.
  - Their candy disks are rainbow spirals in his colors, with white sticks, a shine on each, and a few sparkles. Fully
    opaque.
  - `idle`: 6 frames at about 70 ms, looping. Each lollipop's spiral turns, so the whole field spins and swirls.
  - Each spiral turns a whole step per frame, so the loop closes with no jump.
  - Draw two or three spiral sizes, and avoid an obvious grid, so a phone screen doesn't show the repeat.
- **`INTRO_BIGBOY_SWIRL_FRONT`** (48 x 128, **tiles top to bottom**): the leading edge. Its left side matches the swirl
  tile, fully opaque. Its right side is ragged lollipops, half in, tumbling in with sparkles flying ahead.
  - `idle`: 6 frames, looping.
- **How code uses them:**
  - In: a column of fronts sweeps from left to right with the tiled swirl behind it.
  - Covered: a beat of full swirl.
  - Out: it slides off to the right with the front mirrored.

## The file
- Id `house-intro-bigboy`, one file.
- Exports: `INTRO_BIGBOY_BLOCKS`, `INTRO_BIGBOY_TABLE_PALETTE`, `INTRO_BIGBOY_SWIRL`, `INTRO_BIGBOY_SWIRL_FRONT`, and
  `HOUSE_INTRO_BIGBOY`, a review sheet whose `idle` shows the pieces side by side. It has one extra animation per piece
  animation, plus a 3 x 2 tiling of the swirl with its front on the right to check the seams.

## Looks
- Render each animation frame by frame at 2x or 3x on both backgrounds.
- Render the review sheet at scale 1, **one frame only**: a many-image request can't take a picture over 3,000 px.
- Check that:
  - the blocks stack into a clean 3-2-1 pyramid with the top at the slab's height;
  - the stools sit where the park table's stools do;
  - the board's colors read clearly;
  - the swirl tiles have no seams and loop with no jump.

Call done with notes: each piece's size and foot, its frames beat by beat, the landing frames, and when the board drops.

## How to write it
Build the file in steps (the palette, the blocks and the sheet first, then the animations, then the swirl), rendering
as you go. Keep each turn's writing under about 600 lines.
