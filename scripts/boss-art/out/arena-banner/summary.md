# Boss art: arena-banner

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 3 renders.
- Spend: **$0.23** of the $2 cap (12 input, 18,985 cache-write, 49,015 cache-read, 6,486 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-banner/arena-banner.ts.
- Previews: scripts/boss-art/out/arena-banner/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-banner/looks/.

## Its notes

I've drawn arena-banner and rendered it on dark and light backgrounds, with no warnings. It's a navy banner with a gold crown, exported as ARENA_BANNER (id "arena-banner", name "Arena banner").

- **Size and anchor:** the frame is 24 x 56 on a transparent background. The anchor (`foot`) is (12, 1), the top of the hanging rod, where the game hangs it on arena-wall.
- **Repeating:** it doesn't tile. It's a single piece that the code places along the wall. There are no exported points.
- **What's drawn:** a bronze rod with 2x4 gold finials and a small gold hook at the top centre. Behind it hangs a 16-wide navy cloth with a gold top sleeve and a gold border, darker on the right because the light comes from the top left. The bottom is a swallowtail with gold edging along the notch, and there's a thin gold stripe just above it. In the middle is a gold crown with three points, a band, a ruby and two pearls. The cloth has two thin folds (a dark line with a lit line beside it) and lit and shaded bands of navy.
- **Palette:** the shared arena keys and values. I added four: `v` #141b2e (deepest navy shadow), `B` / `b` (bronze rod, light and dark) and `r` (ruby).
- **Idle animation:** 6 frames at 220 ms each, looping (1.32 s). The cloth is rippled with its top held fixed. The upper half and the crown never move, and from about the middle down the cloth sways one pixel left, back, then right, and back. The rod stays put.

**Choices you might want to change:**
- **How far it sways:** the bottom moves 1 px. With 2 px, the rows of the crown slid apart from each other mid-sway, which looked broken, so I kept it calm at 1 px.
- **Halo:** a faint gold, #ffe08a at about 15% opacity.
- **Ruby:** the gem in the crown's band is red; you could turn it gold if you'd rather the banner stayed just navy and gold.
