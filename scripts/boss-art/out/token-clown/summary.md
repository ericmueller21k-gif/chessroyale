# Boss art: token-clown

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.33** of the $1 cap (16 input, 21,566 cache-write, 80,074 cache-read, 10,130 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-clown/token-clown.ts.
- Previews: scripts/boss-art/out/token-clown/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-clown/looks/.

## Its notes

The Boingo the Clown token is drawn in `token-clown.ts` as `TOKEN_CLOWN` (id "token-clown", name "Boingo token"). I rendered it at 4x and 6x on both dark and light backgrounds, looked at it at phone size, and checked it beside the clown boss himself. It reads clearly at a glance.

**Size:** a 40 x 40 frame with a transparent background, meant to be shown at 2x.

**The coin:** I copied it from the Blitz token without changing anything: the same gold rim shaded from the top left, rivets, dark inner ring, navy middle, faint gold halo, outline and glint code. Only the face layers are new.

**The face**, filling the navy middle like the Ginger and Blitz faces, head and shoulders cut off by the inner ring. It uses Boingo's own colours from his palette in `clown.ts`:
- **Head:** white face paint, slanted dark brows, red eyes with a pale glint at the top left, a round red nose, and a wide red-lipped grin with a row of white teeth.
- **Hair and hat:** spiky red hair tufts out to each side, and a small cone hat in red and purple stripes with a gold pompom on top.
- **Shoulders:** a pleated white ruff with a scalloped edge, gold pompoms at the shoulders, and his red and purple harlequin diamonds below.

**The idle animation, beat by beat (the same as Blitz):**
1. Four frames of 180 ms each: the glint travels round the rim a quarter turn per frame, starting at the top left.
2. A 1400 ms rest.
3. A 150 ms blink: the eyes close to white lids over a dark lash line.

Nothing else moves.

**Choices you might want to change:**
- **Expression:** I made the brows slant down towards the middle so he looks a bit wicked, as in the reference. If you'd rather he looks friendly, drop the brows or flatten them.
- **Hat:** it's small and straight, as in his idle pose, because the inner ring leaves little room above the head.
- **Suit:** the ruff takes the upper part of the shoulders, so only about five rows of diamonds show below it. A shorter ruff would show more of the suit.
