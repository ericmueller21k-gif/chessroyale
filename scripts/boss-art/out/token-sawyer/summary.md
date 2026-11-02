# Boss art: token-sawyer

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.30** of the $1 cap (18 input, 20,232 cache-write, 78,227 cache-read, 9,381 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-sawyer/token-sawyer.ts.
- Previews: scripts/boss-art/out/token-sawyer/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-sawyer/looks/.

## Its notes

token-sawyer (TOKEN_SAWYER, name "Sawyer token"): a 40 x 40 frame with a transparent background, meant for 2x. I rendered all 6 idle frames at 4x or larger on both the dark and light backgrounds, and at phone size beside the tiger. The render gave no warnings.

The coin is copied unchanged from token-blitz: the rim, rivets, dark inner ring, navy middle, gold halo, outline and glint code. Only the face layers are new, using Sawyer's own colors from sawyer.ts. Head and shoulders are cut off by the inner ring, the same size as on the Ginger and Blitz tokens. The face has:
- a yellow hard hat (dome, raised ridge, wide brim) lit from the top left;
- round ears with pale rims peeking out beside the hat;
- pale brows and a dark forehead stripe;
- a bold black mask across the eyes that dips at the outer ends, with white eyes and sly pupils glancing to our right; it reads clearly at 1x and 2x on both backgrounds;
- cream cheeks and muzzle with small gray cheek tufts, a black nose, and a wide toothy grin with the corners up;
- gray-brown shoulders with a cream chest.

Idle (same timing as Blitz):
1. Frames 1 to 4, 180 ms each: the glint goes a quarter turn per frame round the rim, from the top left to the bottom right.
2. Frame 5: a 1400 ms rest.
3. Frame 6: a 150 ms blink. The eyes close inside the mask, leaving a gray lash line.
Nothing else moves.

Choices you might change:
- No white gloves, to keep one clear emblem.
- The mask runs to the edge of the face and meets the outline there, as on the boss.
- The pupils glance sideways rather than straight ahead.
- The grin shows one row of teeth with two faint gaps.
- The hat's ridge is a bright stripe down the middle; it could be toned down.
