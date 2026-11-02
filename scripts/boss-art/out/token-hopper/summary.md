# Boss art: token-hopper

- Model claude-opus-5-5, effort high, adaptive thinking. 9 turns, 3 renders.
- Spend: **$0.52** of the $1 cap (22 input, 31,352 cache-write, 149,261 cache-read, 16,776 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-hopper/token-hopper.ts.
- Previews: scripts/boss-art/out/token-hopper/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-hopper/looks/.

## Its notes

token-hopper ("Chub & Chirp token", exported as TOKEN_HOPPER) is a 40 x 40 frame with a transparent background, meant to be shown at 2x. The rim, rivets, dark inner ring, navy middle, halo, glint and coin colors are copied unchanged from the Blitz token. I rendered it at 4x and 6x on dark, at 6x on light, and at phone size, and it reads at every size.

Faces: Chub (the rabbit) is in front and bigger, one pixel left of center, seen from the front. He has grey-brown fur lit from the top left, long ears leaning right that the inner ring cuts off, black eyes with glints, a pink nose and cheeks, a cream muzzle with a small smile, his green scarf with a gold clasp, and a cream chest. Chirp (the grasshopper) is behind him on the right: a tall green head, one big black eye with a glint, yellow-green mouth parts, a bit of green body, and two antennae curving up and to the right until the ring clips them. Every part has its own k outline, and all colors come from hopper.ts.

Idle, beat by beat: the glint moves a quarter turn per frame from the top left (4 frames of 180 ms), then a 1400 ms rest, then Chub blinks for 150 ms. Nothing else moves.

Choices you might change: Chirp doesn't blink (a grasshopper has no lids). The scarf tail and clasp sit on Chub's left side, not the middle. The antenna tips are clipped by the ring, which makes them look long. Chirp's head just touches the ring on the right.
