# Boss art: token-ginger

- Model claude-opus-5-5, effort medium, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.22** of the $1 cap (16 input, 16,405 cache-write, 62,178 cache-read, 6,244 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-ginger/token-ginger.ts.
- Previews: scripts/boss-art/out/token-ginger/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-ginger/looks/.

## Its notes

The Ginger token is finished: `token-ginger` (TOKEN_GINGER, "Ginger token"). The frame is 40×40 with a transparent background, meant to be shown at 2x. I checked it at 4x and 8x on the dark background, and on the light background with all frames at 4x, plus at phone size.

**How it's built:** the coin is the crest's code copied over: the same gold rim with its 8 rivets, lit from the top left, the dark `k` inner ring, the navy middle with a lighter `n` band at the bottom, the same `k` outline and the same faint gold halo. The rim and the face are separate pieces, so another boss's token only needs a new face (`head`, `body`, `bow`); the disc and the glint code carry over unchanged. I wrote a small paint helper inside the file rather than importing the crest's helper from town/houses/kit.ts, so the file only imports sprite.ts.

**The face:** Ginger's round cookie head in three shades of brown, lit from the top left. He has his angry white icing eyebrows, red eyes with a pink highlight, an icing frown, a dashed icing trim round the top of his head, his green bow tie under the chin, and his shoulders with one icing button, cut off by the inner ring. He's recognizable at phone size.

**Idle, 6 frames, 1.2 s, looping:**
1. Rest (300 ms).
2–5. A four-point white and gold glint travels from the left side of the rim over the top to the right, 150 ms per step.
6. Rest with a blink (300 ms): the eyes become a dark line.

**Things you might want to change:**
- He frowns, as in the idle reference. If the token should be friendlier, the mouth can be flipped to the smile from the victory picture.
- The glint only covers the top arc of the rim; it could go all the way round instead.
- The blink falls on every loop; it could be made rarer.
- The icing button is partly hidden by the inner ring.
