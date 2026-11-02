# Boss art: token-moo

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 4 renders.
- Spend: **$0.52** of the $1 cap (24 input, 31,815 cache-write, 194,397 cache-read, 16,343 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-moo/token-moo.ts.
- Previews: scripts/boss-art/out/token-moo/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-moo/looks/.

## Its notes

The token-moo drawing is finished: a 40 × 40 coin on a transparent background, meant to be shown at 2x. I rendered every frame on dark (all six at 4x) and the rest frame on light at 6x, and looked at it at phone size beside the tiger.

**The coin:** the rim, rivets, dark inner ring, navy middle, halo and glint code are copied unchanged from token-blitz. The only new part is the face layer.

**The face:**
- Moo faces front, filling the middle and moved one pixel right to leave room for the moon.
- He has a cream face shaded from the top left and a dark-brown patch over his eye on our right.
- He has a big pink snout with two nostrils and big brown eyes, each with a white glint.
- His floppy brown ear on our right has a pink inside; the left ear only peeks out behind the moon.
- Small tan horns sit on top with a cream tuft between them.
- His cream shoulders carry a brown patch, and the inner ring cuts them off.
- The crescent moon rises on our left, cheek to cheek with him: soft yellow with a darker orange rim, closed happy eyes, a small smile and pink cheeks.
- I used Moo's colours from moo.ts. Three of the moon's yellows go under new keys (G, H, I) because the coin already uses M, N and O.

**Idle, beat by beat:**
1. The glint moves round the rim a quarter turn per frame, four frames of 180 ms each.
2. A 1400 ms rest.
3. Moo blinks for 150 ms (a dark lash line, with the patch colour over his patched eye).

The moon doesn't blink because its eyes are already closed. Nothing else moves.

**Choices you might want to change:**
- The moon reads more as a plump teardrop or crescent than a thin sickle. Its eyes and smile need room, and the head covers its inner curve.
- Moo faces front rather than three-quarters as in his sprite, so the coin reads at a glance.
- His left ear is almost hidden behind the moon.
- The patch is over the eye on our right.
