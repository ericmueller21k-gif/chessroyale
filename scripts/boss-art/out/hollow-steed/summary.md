# Boss art (rider): hollow-steed

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 5 renders.
- Spend: **$0.66** of the $6 cap (22 input, 40,707 cache-write, 234,791 cache-read, 20,719 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-steed/hollow-steed.tsx.
- Previews: scripts/boss-art/out/hollow-steed/preview/idle.png, scripts/boss-art/out/hollow-steed/preview/move.png, scripts/boss-art/out/hollow-steed/preview/look.png. Each look it took: scripts/boss-art/out/hollow-steed/looks/.

## Its notes

Hollow's Shade (id hollow-steed, tier mythic) is drawn and checked in every color.

**What it is:** a low, four-legged shadow beast seen from the side, facing right. It has charcoal shaggy fur with a soft violet glow around it, and a big round head with cat-like ears and two gold eyes, after the sidekick, plus a blush and a little gold smile. A wagging shaggy tail and a small violet swirl on its rump nod to Hollow's band of darkness. A strand of Christmas lights runs from its mouth to the front of the saddle blanket as reins, and drapes in two loops along the blanket's hem as trim. The bulbs go red, green, gold and blue on a green wire. The pawn sits on the blanket: it's lifted 13 units and everything below the cut line (66) is hidden behind the beast's back. In the renders the pawn clearly sits on it, white or black.

**The painted part:** only the saddle blanket takes the item's color. It has a lighter band with small dark studs and a shine along its top edge. The fur, eyes, violet glow and bulbs stay fixed. Midnight is the darkest blanket on the black fur, but the light band still lets it read.

**Idle** (8 frames, about 1.6 s):
- The beast breathes: its body, the pawn and its head rise and fall about a unit.
- The fur tufts ripple round the edges and the tail sways.
- One bulb at a time glows brighter with a halo, moving along the strand. There are 7 bulbs and 8 frames, so one frame per loop has no bulb lit, a short pause before the twinkle starts again.
- On frames 5–7 the eyes blink slowly: half shut, closed (drawn as gold curved lines), then opening.

**Move** (8 frames × 90 ms, dx 0 → 87.5 in steps of 12.5, so the next square's first frame follows on):
- It slinks: the body sits about 2 units lower and glides with a gentle bob while the head holds steady.
- The stubby legs pad along in diagonal pairs, two strides per square, with small paw lifts.
- The tail lifts, the bulbs swing about ±22°, and the pawn leans forward 3°.
- Violet smoke puffs are left behind every other frame. They stay put on the ground while the beast moves on, grow and fade, so a wisp trails behind it.

**Choices you might want to change:**
- The beast is about as long as one square and its head pokes a few units past the square's right edge. The tile's frame is [-8, 4, 118, 96].
- The smoke trail reaches about 20 units behind the square.
- The violet glow is my addition, taken from the boss's outline. It keeps the black beast readable on dark ground.
- The reins end at the blanket rather than at the pawn, since the pawn has no hands.
