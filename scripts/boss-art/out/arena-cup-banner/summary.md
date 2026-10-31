# Boss art: arena-cup-banner

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 3 renders.
- Spend: **$0.36** of the $3 cap (12 input, 24,746 cache-write, 56,947 cache-read, 11,255 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-cup-banner/arena-cup-banner.ts.
- Previews: scripts/boss-art/out/arena-cup-banner/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-cup-banner/looks/.

## Its notes

I've drawn arena-cup-banner (exported as ARENA_CUP_BANNER, name "Cup banner") and checked the idle at 4x on dark and 6x on light. It is one piece and doesn't tile, so I didn't run a tile check.

- **Frame:** 112 x 36. The anchor (`foot`) is (56, 1), the top centre: the top of the finials sits at y=1 and their outline at y=0.
- **Layout, back to front:**
  - **Tails:** two navy ribbon tails behind the banner, at y 20–33, with gold top and bottom edges and a swallowtail cut on their outer ends. Their inner ends are darker where they tuck under the front cloth.
  - **Front cloth:** 96 x 24 at (8, 3). It has a two-pixel gold border (lighter on the top and left, darker on the bottom and right), a dark inner line and a lighter navy line along the top and left.
  - **Emblems:** a small gold trophy inside laurel leaves at each end, in its own panel set off by a fold line at x=16 and x=79 in cloth pixels (frame x 24 and 87).
  - **Plain field:** about 62 x 18, at frame x 25–86 and y 6–23, for the words.
  - **Rod:** a gold rod (y 2–3) with a collar and round finial at each end.
- **Idle, 6 frames at 220 ms each, looping:**
  - Frames 1–6: the tails sway up and down by up to a pixel at their cut ends, the left and right tails moving opposite to each other.
  - At the same time, a white glint moves left to right along the rod, about 19 px per frame.
- **Exported points:** none.
- **Things you might want to change:**
  - Both emblems face the same way rather than mirroring, so the light stays from the top left.
  - The plain field is 62 wide, two short of the brief's 64, because of the emblem panels.
  - I didn't import kit.ts because nothing in it was needed. The palette uses the brief's coliseum keys plus one extra, `b` `#4a5f8f`, a lighter navy for the lit side of the cloth.
  - The halo is `#fbf0d833`.
