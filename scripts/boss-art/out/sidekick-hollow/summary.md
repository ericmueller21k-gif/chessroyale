# Boss art: sidekick-hollow

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 31 turns, 32 renders.
- Spend: **$3.00** of the $20 cap (64 input, 320,758 cache-write, 5,162,134 cache-read, 116,181 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-hollow/sidekick-hollow.ts.
- Previews: scripts/boss-art/out/sidekick-hollow/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-hollow/looks/.

## Its notes

The drawing is at scripts/boss-art/out/sidekick-hollow/sidekick-hollow.ts, exported as `sidekickHollow` with id "sidekick-hollow". The frame is 64x64 with the ground at 61 and feet at (26, 61). The critter is about 62% of Hollow's height at phone size. I looked at every animation at 4-6x, the idle at phone size beside Hollow and the tiger, and the wave on the light background. No frame-edge warnings remain, and I didn't run the game's tests.

**The critter.** It's a round charcoal-fur baby with a big fluffy head, two tiny round ears, a cowlick, big glowing gold eyes (amber rim, white shine, small pupil), blush, a tiny pink nose and a small smile. It has a round body with a lighter tummy, stubby feet and a ball tail. Parts of the fur have a violet rim on the shadow side, and the halo is Hollow's `#6a46c4`, so it never vanishes on the dark ground. It has no seams, void or band of darkness. The fur is a little lighter than Hollow's so the parts read apart.

**The bulb.** One red Christmas bulb hangs on a short grey wire from its near paw, like a lantern. A see-through dithered glow sits behind everything and pulses by changing the palette per frame.

**Required animations**
- **idle (3 s, loops):**
  - It breathes and blinks twice, and flicks an ear and its tail.
  - It glances right near the end.
  - The bulb glow pulses twice and the bulb sways.
  - A tiny violet twinkle drifts by.
- **walk (0.64 s, loops):** a soft hop with the feet alternating, the head bobbing a beat behind, and the bulb swinging opposite.
- **sit (loops):**
  - It sits on a stool facing the board, feet dangling and swinging.
  - The bulb is set on the ground by the stool and glows low.
  - It blinks, then leans in with eyes rolled up and brows raised, thinking, and gets a slow sleepy blink at the end.
- **wave (once, 1.22 s):**
  - It crouches, then pops the bulb up and the glow jumps bright with a sparkle.
  - It waves the bulb left, middle and right, twice, with arc-smile eyes.
  - It settles into the idle pose, so the loop picks up without a jump.

**Other animations (same set as Jefferson's sidekick)**
- **entrance:**
  - Violet darkness gathers, and two gold eyes blink open in it.
  - The critter pops out squashed, hops, and lands with dust.
  - The bulb flickers on, then flares bright as it waves.
- **thinking:** it scratches its head with the free paw, eyes up, a foot tapping, thought dots popping up.
- **move:** a crouch, a hop forward, a flourish of the bulb toward the board, then it settles.
- **capture:** two excited hops with both arms up, the bulb bright and sparkles.
- **hurt:** the fur flashes white and the eyes squeeze shut. The bulb flickers out and sweat flies, then it rattles, blinks and relights with a brave grin.
- **check:** two sharp bulb jabs at the board with bold brows and a bright glow, then a smug settle.
- **smug (loops):** half-lidded eyes, a smirk, one raised brow and a slow nod.
- **rattled (loops):** wide eyes, worried brows and sweat drops, trembling, the bulb flickering.
- **defeat:**
  - A hit flash, then dizzy X eyes, stars and a stagger.
  - It topples over onto its side (the whole drawing turned a quarter), with a puff of dust.
  - The bulb dims to a last ember and the last frame holds.
- **victory (loops):** jumping with both arms up, the bulb waving high and bright, confetti.

**Choices you might change**
- **Bulb color:** red. Gold would echo the eyes and blue would match the violet, but red reads as the classic Christmas bulb and is distinct from the eyes.
- **Defeat:** it topples sideways (a rotated copy of the standing sprite). I chose that over a hand-drawn flop. A flat belly-flop would be a redraw.
- **Glow:** it's dithered rather than smooth, since see-through parts can only sit behind the body. It is hidden where the head or body overlaps it.
- **Silhouette:** the round ears and cowlick make it read slightly cat-like. Say so if you want a less catty shadow critter.
- **Halo:** it's the same strength as Hollow's. Dim it if you want it fainter.
