# Boss art (rider): ginger-sled

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 4 renders.
- Spend: **$0.54** of the $6 cap (22 input, 34,081 cache-write, 157,318 cache-read, 16,718 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/ginger-sled/ginger-sled.tsx.
- Previews: scripts/boss-art/out/ginger-sled/preview/idle.png, scripts/boss-art/out/ginger-sled/preview/move.png, scripts/boss-art/out/ginger-sled/preview/look.png. Each look it took: scripts/boss-art/out/ginger-sled/looks/.

## Its notes

I've drawn the Candy Cane Sled and checked it in renders. The idle and the move work at 4x and at town size, in every color scheme, with a white or a black pawn.

**What it is:** a small gingerbread sled seen from the side, facing right. It has a low, rounded backrest at the rear and a rounded nose at the front. Wavy white icing runs along the top rail, the bottom edge and around the backrest, with three icing dots on the side. Three gumdrops (red, green, red) sit along the rail. The runners are candy canes laid flat, red-and-white striped, each curling up into a hook at the front. A second runner, drawn darker, shows behind the near one. The pawn sits low in it and is hidden below the rail (cut 66, raised 4 units, moved 3 units forward).

**Painted part:** the gingerbread side panel and the two short legs under it take the item's color, with a faint light band near the top and a slight shadow near the bottom. The icing, gumdrops, candy-cane runners, snow and frost stay fixed.

**Idle** (12 frames × 220 ms, about 2.6 s):
- The whole sled sinks half a unit on its runners and the pawn settles a beat later, then both come back to rest.
- On frames 3–4 a frost sparkle flashes on the rail icing, and on frames 7–8 another flashes on the icing at the top of the backrest.
- One snowflake drifts down the right side, turning as it falls, and lands small on the sled's nose at the end of the loop.

**Move** (12 frames, about 1 s; dx 0, 4, 12, 24, 38, 54, 69, 82, 92, 98, 101, 100):
- **Start:** a quick push off, with the pawn leaning back up to 7°.
- **Middle:** a fast slide. On frames 2–10 white snow puffs are kicked up behind the runners; each stays where it landed for a few frames, so it trails behind.
- **Stop:** the sled eases in, slightly overshoots to 101 and settles back to 100. The pawn lurches forward to about 9°, and a small spray of snow flies off the front curl.
- **Hand-off:** the last frame (dx 100, lean 3°) leads straight into the next move's first frame.

**Choices you might want to change:**
- With the red color, the panel sits close to the cane's red stripes. Only the dark outlines separate them at the nose; the other colors show the candy cane clearly.
- The forward lurch is modest. Raise MOVE_TILT if you want a bigger bump at the stop.
- The cane stripes are straight bands across the cane, not the usual diagonal twist, so they stay crisp at town size.
- The sled is long and low, about 90 units, roughly the width of the square. You could scale it up if rides should look bigger.
- The tile frame is [0, 10, 106, 90].
