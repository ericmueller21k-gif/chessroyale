# Boss art (rider): moon-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.52** of the $6 cap (18 input, 33,309 cache-write, 142,653 cache-read, 16,478 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/moon-ride/moon-ride.tsx.
- Previews: scripts/boss-art/out/moon-ride/preview/idle.png, scripts/boss-art/out/moon-ride/preview/move.png, scripts/boss-art/out/moon-ride/preview/look.png. Each look it took: scripts/boss-art/out/moon-ride/looks/.

## Its notes

Moon's Ride (id "moon-ride", mythic) is done and rendered in every color. It's a crescent moon lying on its back with its horns pointing up. The moon is the painted part, with a darker band along its outer bottom rim, a lighter highlight along the inner rim and two small craters. The face is fixed: sleepy closed eyes, a small smile and pink blush cheeks, as in the reference. The pawn sits in the hollow (pawnY −14, cut 76). The moon's inner edge hides everything below its shoulders, so it reads clearly as sitting in the moon. The moon never touches the ground; there's a soft shadow at y 96.

**Idle** (8 frames × 230 ms, about 1.8 s loop):
- The moon and pawn float up 3 units and back down on a slow cosine.
- The shadow shrinks a little as they rise.
- Six pale-gold four-point stars sit behind the moon, around its horns and above. Each one grows, peaks and fades over 4 frames, then rests for 4, at staggered times, so two or three are twinkling at any moment.

**Move** (8 frames × 80 ms = 640 ms):
- A smooth glide from dx 0 to 87.5, so the next square's frame 0 follows straight on at dx 100. The same float bob is drawn once per square.
- A new star appears just behind the left horn every frame. Each one stays put in the world as the moon glides away, shrinking and fading over 4 frames, which leaves a sparkle trail up to about 45 units behind.

**Choices you might want to change:**
- The trail reaches past the square's left edge, to about x −45, and the idle stars reach about 6 units past the sides. The tile frame is [-6, -8, 112, 108] to fit them.
- On the midnight color the dark face is hard to see. A light outline round the face for dark colors would fix it.
- The stars are a fixed pale gold (#fff1a8). At town size they're small but visible; they could be made bigger.
- The move timing (80 ms a frame) is a guess at the town's walking pace.
