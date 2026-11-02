# Boss art: house-intro-bigboy

- Model claude-opus-5-5, effort high, adaptive thinking. 23 turns, 16 renders.
- Spend: **$2.29** of the $8 cap (48 input, 142,312 cache-write, 2,022,672 cache-read, 58,917 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-intro-bigboy/house-intro-bigboy.ts.
- Previews: scripts/boss-art/out/house-intro-bigboy/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-intro-bigboy/looks/.

## Its notes

I drew all three pieces and the review sheet in house-intro-bigboy.ts. I looked at every animation at 2–3x, on both backgrounds for the block drops and the front, and at the sheet at scale 1, one frame. The file imports only sprite.ts and paint.ts. TABLE_PIECES and kit's `grain` are copied in. I measured the park stools' seat height (TOWN_FEEL.sitSeat × 37 = 10 px) once with a test render, and it's written into the file as a number.

**1. INTRO_BIGBOY_BLOCKS**: 111 × 100, foot [55, 94]. That's PARK_TABLE's width and foot offset (6 px over the bottom), just taller to leave room for the drop.
- **Table blocks:** six toy blocks, each 9 px wide with a 3-row top face and a 7-row front face (10 tall plus the outline). Faces are in his rainbow, lit from the top left, with a white glint and a letter that has its own drop shadow. In drop order they spell his name:
  - bottom row B I G (red, orange, yellow), centered at x 45 / 55 / 65;
  - middle row B O (green, blue), at 50 / 60;
  - top block Y (purple), at 55.
- **Height:** rows stack 8 px apart. The top block's top row is exactly 26 px over the foot (TABLE_BOARD.top); a check in the code throws an error if that changes. The renderer's 3-px slab front covers that top face, so the 30-px slab sits balanced on one 9-px block, as the joke wants.
- **Stools:** two bigger blocks, 11 wide with a 4-row top and an 8-row front: a teal one with a star (x 18) and a pink one with a heart (x 92). Those are PARK_TABLE's stool spots, and the middle of each stool's top face is at the 10-px seat height.
- **`build`** (21 frames, 70 ms, last held 240 ms): each block starts 3 frames after the one before.
  - Frames 0–2 of a block's drop: it falls from above the picture, with speed lines in later frames, and a small ground shadow appears under the bottom row.
  - Frame 3: it lands squashed, with a puff each side. The puffs are behind the blocks, so they show round them.
  - Frame 4: a stretched bounce, 2 px up. Frame 5: at rest as the puff thins.
  - **Landing frames (cues):** 3, 6, 9, 12, 15 (`block`) and 18 (`block-top`: the top block, with stars springing off it). Frame 20 is the finished pyramid.
- **`plop`** (5 frames, 90 then 80 ms, cue `plop` on frame 0): dust clouds burst out from under the slab's ends, and stars arc out and drop.
  - **When the board drops:** after `build` ends. Time the board's fall so it touches down right as `plop` frame 0 shows.
- **`chairs`** (8 frames, 70 ms, last 200): the left stool lands on frame 3 and the right on frame 4 (cue `stool`), each with a squash, a bounce and a puff.
- **`idle`:** the finished table and stools, with shadows.

**2. INTRO_BIGBOY_TABLE_PALETTE**
- The slab is a teal foam play mat in his shirt's teal: `1` #8ae8dc (edge), `2` #3fc2bb (top), `3` #23a8a8, `4` #178589 (front), `5` #0f5c63.
- The squares are `L` #fff3c4 (pale butter) and `D` #dc5f8e (bubblegum pink).
- In the sheet's 8 × 8 test board, the cream and charcoal pieces both read clearly on both squares.
- I also exported INTRO_BIGBOY_TABLE_INK, in TABLE_INK's shape, as Alfil's file did.

**3. The swirl**
- **INTRO_BIGBOY_SWIRL** (128 × 128, tiles both ways, fully opaque; 6 frames at 70 ms, cue `swirl` on frame 0):
  - Seven big lollipops placed by hand, off any grid, then the biggest gap filled again and again from three candy sizes (radius 7, 11, 16), overlapping in a shuffled order. A deep candy shadow fills any pinholes left between them.
  - Each candy is a six-arm rainbow spiral (thin white ribbons on the big ones), its rim lit and shaded, with a fixed shine and an outline. Sticks are white and lit on their upper-left side.
  - Each spiral turns exactly one color band a frame, some clockwise and some counter-clockwise, so frame 6 is frame 0 and the loop closes with no jump. 14 sparkles twinkle on their own beats.
- **INTRO_BIGBOY_SWIRL_FRONT** (48 × 128, tiles top to bottom, 6 frames):
  - Its first two columns are the tile's own, and it keeps the tile's lollipops whose middles lie within 20 px of the left, so the edge is ragged along whole candies with sticks poking out.
  - Eight lollipops tumble in half outside the edge: they spin, and their sticks wheel a sixth of a turn a frame. Sparkles fly ahead 3 px a frame (an 18-px loop).
  - Code plays both exactly as Alfil's storm: fronts sweep in, a beat of full swirl, then out with the front mirrored.
- In the sheet's 3 × 2 tiling with the front column on the right, I saw no seams.

**HOUSE_INTRO_BIGBOY** (the review sheet, 672 × 260):
- `idle` shows the blocks, the blocks with a mock slab and board, the 8 × 8 board with pieces, and the swirl seam check.
- `blocks-build`, `blocks-plop`, `blocks-chairs` and `blocks-idle` play each block animation; `swirl` plays the 6-frame seam check.

**Choices you might want to change:**
- **Block size:** the blocks are 9 px, not the 12–14 px the brief suggests. Three rows of 12-px blocks would stand about 36 px tall, so they couldn't top out at 26 px.
- **`build` length:** 21 frames, one over the 16–20 asked, so each block gets a full fall, landing and bounce. It's easy to tighten.
- **Colors:** the stool colors (teal and pink) and the slab color (teal) were my picks.
- **Busy swirl:** the swirl is very busy on purpose, to cover the screen; dropping the smallest candy size would calm it.
- **Seat height:** the 10-px seat height is measured from the current TOWN_FEEL.sitSeat, written into the file as a number. If that setting changes, the stools won't follow it.
