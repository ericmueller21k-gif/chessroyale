# Boss art: token-smudgy

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 5 renders.
- Spend: **$0.47** of the $1 cap (22 input, 28,207 cache-write, 152,926 cache-read, 14,986 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-smudgy/token-smudgy.ts.
- Previews: scripts/boss-art/out/token-smudgy/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-smudgy/looks/.

## Its notes

The Smudgy token is done: scripts/boss-art/out/token-smudgy/token-smudgy.ts, exported as TOKEN_SMUDGY ("Smudgy token"). The frame is 40 x 40 with a transparent background, meant to be shown at 2x. I rendered it at 4x on dark, and at 6x on dark and light; the render also showed it small at 1x and 2x beside the tiger, and it reads at both sizes.

**The coin:** copied unchanged from the Blitz token: the gold rim shaded from the top left, the rivets, the dark inner ring, the navy middle, the halo and the glint code, with the crest's colors. Only the face layers are new.

**The face** (Smudgy's own colors from smudgy.ts, outlined in the coin's k, light from the top left), back to front:
- **Shoulders:** lime green with an orange then teal stripe at each arm, and the cream apron bib on brown straps with a red paint splat and a small yellow dab.
- **Casque:** the dome behind his head, in orange and teal stripes. I left green out of the stripes because green-striped bands blended into his head.
- **Head:** wide and lime green, with two small nostrils, a long mouth that turns up on our right into a friendly smirk, and a yellow-green throat.
- **Eyes:** two big amber eyes, each in a green turret of skin, with a black pupil and a white glint at the top left.
- **Beret:** deep plum, tipped down to our right on top of the casque.

**idle** (6 frames, about 2.27 s, loops), as Blitz's:
1. The glint at the top left of the rim, 180 ms.
2. The glint at the top right, 180 ms.
3. The glint at the right, 180 ms.
4. The glint at the bottom right, 180 ms.
5. A rest, 1400 ms.
6. A blink, 150 ms: green lids close over both eyes with a dark lash line. Nothing else moves.

**Choices you might change:**
- **Front view, two eyes:** I drew him from the front with both eye turrets, because it reads more clearly in a coin. The brief said "his big amber eye" (one); his reference is three-quarter view.
- **No brush:** there was no room for the brush with its yellow tip beside the wide head and eye turrets without crowding the face. The yellow dab on the apron stands in for it. A brush tip could be squeezed in at the lower left if you want it.
- **Casque mostly hidden:** you only see the casque between and above the eyes, since the beret covers its right side. If he should read more by his stripes, the beret could be made smaller or moved further right.
