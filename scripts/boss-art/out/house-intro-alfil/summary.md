# Boss art: house-intro-alfil

- Model claude-opus-5-5, effort high, adaptive thinking. 40 turns, 25 renders.
- Spend: **$3.47** of the $8 cap (84 input, 172,494 cache-write, 4,370,967 cache-read, 86,813 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-intro-alfil/house-intro-alfil.ts.
- Previews: scripts/boss-art/out/house-intro-alfil/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-intro-alfil/looks/.

## Its notes

I've drawn all three intro pieces in one file and checked every animation frame by frame on both backgrounds. The review sheet renders in one frame at scale 1. Three things to look at first:

- The board colors might be in the wrong export. I couldn't open render.ts. In park.ts, TABLE_INK looks like the pieces' colors (cream and charcoal, each with a shade and an outline), and the squares look like they come from the palette keys L/D. I followed the brief, so INTRO_ALFIL_TABLE_INK holds the squares: pale sand #ecc98c and blue #3768c4. I also put the same two colors as L/D in INTRO_ALFIL_TABLE_PALETTE, so it works whichever way the renderer reads them. If TABLE_INK really is for pieces, keep the town's TABLE_INK for the pieces.
- I used his ordinary blue, not his deep blue, for the dark squares. Charcoal pieces disappear on the deep blue #1d3d8c. The review board shows cream and charcoal pieces reading clearly on both square colors.
- The file has three imports beyond the two named: kit.ts (paint, grain, groundShadow), park.ts (TABLE_PIECES) and feel.ts (TOWN_FEEL.sitSeat, for the stool height). The brief asked for kit.ts, and Alfil's shop file does the same.

1. INTRO_ALFIL_PYRAMID: 111 x 116, foot [55, 106]. That's the table's foot ([55, 44] in its 50-tall picture) moved down 62, so code draws it straight over the table with no offset.
- rise: 8 x 90 ms, cue "rumble" on frame 1.
  - Frame 1: a low sand mound swells out of the floor.
  - Frames 2-7: it grows taller and changes from round to pointed, while the ridge and the shaded right face appear. Streaks of sand slide down lines fanning from the top, grains run down both edges, and dust puffs roll out at the base. Clods fly in frames 1-4.
  - Frame 8: the whole pyramid.
- idle: 2 x 420 ms, loops. The whole pyramid with a grain trickling down each edge. The tip glints on frame 2.
- crack: 6 frames (140, 140, 140, 120, 120, 120 ms), cue "crack" on frame 1.
  - Frames 1-2: dark cracks start at the top and run down.
  - Frame 3: they glow gold and branch.
  - Frame 4: a gold glow appears around them.
  - Frames 5-6: the cracks turn white-hot with a yellow glow. The tip flares and frame 6 shakes slightly.
  - Sand spills from the cracks the whole time.
- crumble: 8 frames (110, 110, then 90 ms), cues "crumble" on frame 1 and "table" on frame 3.
  - Frame 1: still whole, every crack blazing.
  - Frame 2: it bursts apart along the cracks, with white light in the gaps. The lower middle starts slumping into the floor.
  - Frames 3-7: pieces are thrown outward, fall and wear away from their edges. Sand heaps build up at the sides, dust puffs roll out at the sides, and grains fly.
  - Frame 8: only a low drift of sand around the foot, with small heaps at the stools' feet. Code can keep it or fade it.
- The table appears on crumble frame 3 (index 2). From that frame on, the middle (x 25-85, y 60-109) is completely empty. The pyramid's own shadow stops there too, so the table's shadow takes over. The sheet's crumble-over-table animation shows the table behind the falling sand.

2. INTRO_ALFIL_TABLE: 111 x 50, foot [55, 44], with PARK_TABLE's geometry (TOP_Y 17, the same leg and stool boxes and shadows).
- The leg is a short sandstone column with a gold band, on a stepped base.
- The stools are sandstone drums with a red band over a blue one, edged in gold.
- INTRO_ALFIL_TABLE_PALETTE:
  - "1" #ffd75e: the gold top edge
  - "2" #dcb77c: the sandstone top
  - "3" #c49a5e: mid sandstone
  - "4" #a87e48: the front face
  - "5" #7d5c33: deepest shade
- The sheet shows a mock slab (my guess at the shape) and an 8 x 8 board with the town's pieces on it.

3. The sandstorm: 6 frames x 70 ms each, looping. All frames are opaque except the front's dust edge.
- INTRO_ALFIL_STORM: 128 x 128, tiles both ways. It has three layers moving right:
  - a slow haze of ragged ochre bands, moving 5, 5, 6, 5, 5, 6 px a frame (one 32 px repeat per loop);
  - dark gusts, sand swirls and pale dust wisps, moving 21, 22, 21, 22, 21, 21 px (one 128 px repeat);
  - bright pale and gold streaks and grains, moving 21, 21, 22, 21, 21, 22 px (one 128 px repeat).
  Each layer moves exactly one repeat per loop, so the loop closes with no jump.
- INTRO_ALFIL_FRONT: 48 x 128, tiles top to bottom. Its left edge carries on from a storm tile's right edge (I checked the 3 x 2 seam view: no seams). Billows with lit tops and shaded undersides churn once around per loop, then see-through dust wisps and flying grains thin out to clear by about x 44.
- How code should play it (both tiles scaled 3x, nearest-neighbour, all on the same frame index):
  - In: sweep a column of FRONT tiles from the left edge to past the right in about 0.6 s, with tiled STORM filling everything behind it.
  - Covered: hold full STORM for a beat.
  - Out: slide everything off to the right, using FRONT mirrored as the trailing edge.

Review sheet HOUSE_INTRO_ALFIL: 662 x 260. idle shows the pyramid, the table with its mock slab, the bare table, the board, and the storm 3 x 2 with the front column on its right. One extra animation per piece animation: pyramid-rise, pyramid-idle, pyramid-crack, pyramid-crumble, table, storm, crumble-over-table. The edge warnings in the renders come from the storm tiles, which are meant to touch the frame edges.

Choices you might want to change:
- In crumble frames 3-5, pieces are cut off with slightly ragged straight edges where they cross the clear middle.
- The final sand drift slightly covers the stools' feet.
- The mock board on the slab is only a placeholder.
- Cue names "rumble", "crack", "crumble", "table" and "storm" are suggestions.
- A DEV switch near the end of the file shows one piece on its own when set; it's null, which gives the sheet.
