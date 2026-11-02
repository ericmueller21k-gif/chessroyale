# Boss art (item): jefferson-firework-2

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 3 renders.
- Spend: **$0.21** of the $1.5 cap (12 input, 19,142 cache-write, 44,665 cache-read, 5,413 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/jefferson-firework-2/jefferson-firework-2.tsx.
- Previews: scripts/boss-art/out/jefferson-firework-2/preview/frames.png, scripts/boss-art/out/jefferson-firework-2/preview/look.png. Each look it took: scripts/boss-art/out/jefferson-firework-2/looks/.

## Its notes

Jefferson's Firework is done: an epic weapon, a chunky toy rocket held upright at the pawn's right side, tilted about 9°. I started the shape over and didn't reuse anything from the first try. At 60 px it reads as a rocket, not a pole, beside the candy cane and the cutlass.

**The rocket, top to bottom:**
- **Nose cone:** a pointed ogive in a dark shade of the item's color, with a light highlight streak.
- **Body:** about 22 units wide, in the item's color (one painted region called "body"). It has a cream band under the nose, a cream star in the middle and a gold band near the base. There are no stripes of any kind.
- **Fins:** two side fins flare out wide past the body, and a narrow front fin runs down the middle, all in a darker shade of the body.
- **Fuse:** a small dark nozzle, then a short dark cord curling out of the bottom.

**Motion (8 frames × 150 ms, a 1.2 s loop):** the sparkler at the fuse tip is a small gold four-point star with a white core. It turns about 23° and pulses between full and three-quarter size every other frame. Six tiny sparks spit out from it in staggered turns, each shrinking as it flies and fading from white to yellow, orange, then red (Jefferson's flame colors). It stays small: it never becomes a flame.

**Choices you might want to change:**
- **Very dark colors (Midnight):** a dark nose and fins vanished against the dark body and the black pawn. For those colors only, the nose and fins switch to lighter shades of the body, so Midnight gets a steel-grey nose instead of a dark one.
- **Size:** I scaled the rocket to 94% and moved it slightly left so it stays inside the square. It now fills x 51 to 102, y 10 to 96 (frame [50, 8, 53, 90]), and the render gave no warnings.
- **Star:** the cream star on the body is my own addition and can come out if you want it plainer.
- **Sparks at 60 px:** they're deliberately small, so they show as a flicker of orange at the fuse tip.
