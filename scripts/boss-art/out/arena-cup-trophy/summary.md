# Boss art: arena-cup-trophy

- Model claude-opus-5-5, effort medium, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.32** of the $3 cap (18 input, 22,265 cache-write, 93,339 cache-read, 9,314 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-cup-trophy/arena-cup-trophy.ts.
- Previews: scripts/boss-art/out/arena-cup-trophy/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-cup-trophy/looks/.

## Its notes

The Colosseum Cup is drawn and I've rendered all three animations on both dark and light backgrounds; they read cleanly at 4x and at phone size. It's a standalone piece, so I didn't check tiling, and it has no letters, numbers or exported points.

- **Frame and anchor:** 40 x 48, with the foot (bottom center of the base) at (20, 47).
- **Build:** two parts. The cup itself is one part. The small gold king on the lid (cross, crown, body) is a second part with its own outline, so it stands clear of the lid. At phone size the crown's points blur together.
- **The cup:** loop handles with see-through holes, and a bowl shaded lit-left to shade-right with a bright `y` lip. A gold laurel band runs round the middle with a small navy medallion at the front. Below that: a stem with a knot, a gold collar, a navy block with a small gold crown, a gold trim band and a navy plinth.
- **Colors:** the coliseum keys `k`, `z`, `N`, `n`, `Y`, `y`, `O`. I added two keys: `D` `#7a4f08` for the darkest gold shade and `W` `#fffbe8` for the glint and sparkle. The halo is `#fff4d630`.

**Animations:**
1. **`idle`** (4 frames, 250 ms each, loops): a white diagonal glint moves left to right across the bowl, skipping the laurel band. A sparkle near the top of the left handle, at about (3, 11), shows small in frame 2, big in frame 3 and small again in frame 4; frame 1 has none.
2. **`silver`** (one frame): the gold keys swapped to cool greys, with a white highlight.
3. **`bronze`** (one frame): the gold keys swapped to warm brown-orange.

Both stills swap only the gold colors, so the navy base stays the same on all three cups.

**Things you might want to change:**
- The laurel is gold on gold, so it's quiet at phone size. Green leaves would make it stand out.
- The silver highlight is pure white, which is very bright on a light background.
- There's only one sparkle, and it stays by the left handle.
