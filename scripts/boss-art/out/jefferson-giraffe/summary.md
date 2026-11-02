# Boss art (rider): jefferson-giraffe

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 4 renders.
- Spend: **$0.97** of the $6 cap (24 input, 52,332 cache-write, 289,736 cache-read, 32,521 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/jefferson-giraffe/jefferson-giraffe.tsx.
- Previews: scripts/boss-art/out/jefferson-giraffe/preview/idle.png, scripts/boss-art/out/jefferson-giraffe/preview/move.png, scripts/boss-art/out/jefferson-giraffe/preview/look.png. Each look it took: scripts/boss-art/out/jefferson-giraffe/looks/.

## Its notes

Giraffe Gallop (mythic, id "jefferson-giraffe") is finished. A young giraffe seen from the side, facing right: golden coat with rust spots, long legs with brown hooves, a short neck with a row of flame tufts for a mane, and a big head with a cheeky smile, a big shiny eye, a pink cheek and a cream muzzle. Both ossicones have a flame on top, and the tail ends in a flame too. The pawn sits in a saddle at the base of the neck, hidden below the seat line (cut 66, pawn lifted 20). The highest point is the horn flames at about y -41, so the ride is roughly 40 units above the square.

**Painted part:** the saddle takes the item's color. The blanket under it is a lighter shade of the same color, with a band of the full color along its bottom edge. Both are Regions, so blotches and shine apply to both. Fixed parts: the coat, spots, hooves, horns, all the flames, a brown girth strap and small gold studs. I checked all 9 colors; Midnight gives a near-black saddle over a grey-blue blanket, and it still reads.

**Idle** (8 frames × 170 ms):
- The flames on the horns, mane and tail flicker the whole time, each out of step with the others.
- The neck sways slowly.
- The tail swishes.
- The ear flicks back on frame 2 and forward on frame 3.
- The jaw chews on every other frame.
- It blinks on frame 5.

**Move** (8 frames × 65 ms, dx goes 0 → 87.5 in even steps, so the next move's first frame at 100 follows on):
- Frame 0: stretched out in the air, front legs reaching forward, back legs out behind.
- Frames 1–3: the front legs land and sweep back, and the nose dips. The pawn tilts with the body and lifts a little off the seat.
- Frames 4–7: the back legs come under the belly while the front knees fold, and the nose comes up.
- The neck pumps forward and back about 7°.
- The horn and mane flames and the tail lean back throughout.
- The body's height is worked out each frame so a hoof touches the ground, except in the airborne beat, where it rises 3 units.

**Choices you might want to change:**
- The saddle could be the only colored part, with a fixed-color blanket.
- The mane flames are small, spiky triangles; you could make them larger tufts.
- The legs are fairly short for a giraffe, so the pawn stays low and the whole ride reads at town size.
- The move timing (520 ms total) may need matching to the town's real walk speed.
- The legs bunch up under the belly in frames 5–6, which is a real gallop pose but looks a little tangled at 4x.
