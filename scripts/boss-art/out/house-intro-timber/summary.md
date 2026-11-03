# Boss art: house-intro-timber

- Model claude-opus-5-5, effort high, adaptive thinking. 36 turns, 23 renders.
- Spend: **$3.14** of the $7 cap (74 input, 171,364 cache-write, 3,896,754 cache-read, 75,281 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-intro-timber/house-intro-timber.ts.
- Previews: scripts/boss-art/out/house-intro-timber/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-intro-timber/looks/.

## Its notes

File: scripts/boss-art/out/house-intro-timber/house-intro-timber.ts. All the props are drawn and I've looked at every animation, close up and in the review sheet. Like Alfil's file, it also imports kit.ts (paint, grain, groundShadow), park.ts (TABLE_PIECES) and feel.ts (TOWN_FEEL.sitSeat) as well as sprite.ts. The brief said to use only sprite.ts and paint.ts, but I need park.ts and feel.ts so the table's geometry and the seat height match the park exactly. You can review the storm on its own over the table or the log by setting `DEV = OVER`.

**1. INTRO_TIMBER_LOG** (80 x 70, foot [40, 64] = the log's bottom middle, faint halo)
- `lying` (1 frame): a barked log lying east to west, 64 x 30 (x 8–72, y 34–64). Its left end shows the cut face as a 12 x 30 oval of growth rings. The right end is bark curving away into shade. Two knots and a ground shadow.
- `standing` (1 frame): the same log on end, 32 across and 52 tall (y 12–64). Its top is a 32 x 14 ring oval and the bark furrows run up and down.
- `gnawed` (6 frames, 250 ms each, one cue per frame):
  - f0: a bite out of the left middle. Cue `gnaw`.
  - f1: a bite on the right; the middle starts to narrow. Cue `chomp`, shake.
  - f2: a bite out of the top-left rim and a dug-in bite on the front. Cue `gnaw`.
  - f3: another bite on the left; a band of raw, tooth-marked wood shows round the middle. Cue `chomp`, shake.
  - f4: bites on the right side and the top-right rim. Cue `gnaw`.
  - f5: a full hourglass, bark left at the top and bottom. Cue `chomp`, shake.
  - In every frame chips spray from the newest bite and the pile of chips on the floor grows.

**INTRO_TIMBER_LOG_LOOK** (for the second run):
- Outline: k #1e130d.
- Bark, dark to light: a #3e2415, b #5d361d, c #7d4a27, d #9c6334, e #b97f4a. Plates are mostly c/d, with e on the lit left. About 3–4 furrows show, running along the log: a dark line with a lit lip, plus short dark cracks across the plates.
- Cut face: a 1 px bark rim (d/c), a 1 px pale sapwood ring p #fff0c8, wood h #e0aa5c (H #f6d38e on the upper left), 3 thin rings j #b47b36 at 30%, 56% and 80% of the radius, a heart J #7e5222 and one crack.
- Sizes are as above. The file also exports `INTRO_TIMBER_LOG_GRIDS` (the lying and standing grids, cropped), which the second run can draw directly in his paws.

**2. INTRO_TIMBER_SHAVINGS** (176 x 162, foot [88, 146] = the table's foot)
- The cloud: billowing pale sawdust, outlined and opaque at its peak, about 160 x 150. It has streaks of shavings swirling inside it, tumbling curls of shaving and bark chips.
- `rise` (8 x 110 ms): it boils up from the log's foot, low lumps first, with dust rolling out sideways and curls thrown up. It hides the log by f2. Cue `clatter` on f0, shake on f2.
- `hold` (4 x 120 ms, loops): full and churning; each lump heaves, 16 curls tumble round and the flecks swirl. It covers the table, both stumps and the floor at the foot. Cue `saw` on f0.
- `settle` (10 x 120 ms): f0–4 it slumps into a low wide bank; f5–8 it breaks into thinning motes while the curls fall out; f9 leaves only a ring of shavings (about 116 x 20) round the foot. The ring stays clear of the leg and both stumps, so code can keep it or fade it. Cue `slide` on f0.

**3. INTRO_TIMBER_TABLE** (111 x 50, foot [55, 44], slab top 27 px over the foot; the same as PARK_TABLE)
- The leg is an hourglass pedestal of raw wood covered in rows of tooth marks, with a flat chewed top, and bark and roots left at its foot. There are no stools.
- **INTRO_TIMBER_TABLE_PALETTE** (a varnished slab of his wood): "1" #ffdc9c, "2" #d99f5a, "3" #b97a3a, "4" #935a2a, "5" #653b1a.
- Board squares: L maple #efcf94, D walnut #94603a. The walnut is a mid shade so the charcoal pieces still show on it. P and Q are the town's pieces, unchanged.
- **INTRO_TIMBER_TABLE_INK** holds the shade and line colors.
- The review sheet's 8 x 8 board shows both piece colors reading clearly on both squares.

**4. INTRO_TIMBER_STUMP** (48 x 40, foot [24, 35])
- A barked stump with a ring top and roots. It's 16 wide like the park stools, and its top sits at **INTRO_TIMBER_STUMP_SEAT_H** = round(sitSeat x 37), the stools' seat height. Place one at the table's foot x ± 37 on each side; the review set shows them on the stools' spots.
- `idle`: 1 frame.
- `pop` (6 frames, 70–130 ms): it **springs up out of the floor**:
  - f0: only its top shows, in a puff.
  - f1: half out.
  - f2: hops 4 px into the air.
  - f3: lands. Cue `knock`.
  - f4–5: the puff thins away.
  - Sawdust is thrown up and falls back throughout.

**5. INTRO_TIMBER_STORM** (128 x 128, 6 x 70 ms, loops) and **INTRO_TIMBER_FRONT** (48 x 128, 6 x 70 ms)
- Both use Alfil's method: three layers race right a whole number of pixels per frame, and each comes round exactly once in 6 frames, so the loop has no jump.
- The storm: bands of sawdust, darker gusts, ribbons of shaving curling up, bark chips, curls and grains. Fully opaque. Cue `swoosh` on f0.
- The front: its left side is the storm itself; its right side is ragged billows, thinning dust, and curls, chips and grains flying ahead.
- In the 3 x 2 tiling the seams don't show.

**6. HOUSE_INTRO_TIMBER** (the review sheet, 816 x 262)
- `idle` shows every piece side by side: the lying log, the standing log, the storm, the table with a stand-in slab and both stumps, a stump on its own, the 8 x 8 board, and the 3 x 2 storm tiling with its front.
- One extra animation per piece animation: log-lying, log-standing, log-gnawed, shavings-rise, shavings-hold and shavings-settle (both drawn over the table), table, stump-idle, stump-pop (also popping in the table set) and storm.

**All cues:**
- log `gnawed`: gnaw f0/f2/f4, chomp f1/f3/f5
- shavings: `rise` clatter f0, `hold` saw f0, `settle` slide f0
- stump `pop`: knock f3
- storm: swoosh f0

**Choices you might change:**
- The full storm is a rounded cartoon cloud, not a soft fog; it reads as solid but looks a little lumpy.
- The thinning motes in settle f5–8 look grainy.
- The walnut is lighter than real walnut so the pieces stay easy to read.
- The stumps spring up from below rather than dropping in.
- The ring of shavings is drawn as part of the storm's last frame.
