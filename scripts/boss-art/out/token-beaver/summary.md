# Boss art: token-beaver

- Model claude-opus-5-5, effort high, adaptive thinking. 18 turns, 10 renders.
- Spend: **$0.68** of the $1 cap (40 input, 38,875 cache-write, 408,420 cache-read, 20,051 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-beaver/token-beaver.ts.
- Previews: scripts/boss-art/out/token-beaver/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-beaver/looks/.

## Its notes

token-beaver: a 40 x 40 frame with a transparent background, meant for 2x. Checked on dark and light backgrounds and at 1x and 2x.

Coin: copied unchanged from token-blitz.ts (gold rim, 8 rivets, dark inner ring, navy middle, faint gold halo, glint code).

Face: orange hard hat with a lit ridge and wide brim; round brown head, tan muzzle, wide dark nose, two big cream buck teeth split by a dark line; black eyes with a white catch-light; pale whiskers on the cheeks. Ends of two wooden planks poke up on each side of the head, lit on the outer edge. At the bottom: tan fur chest, orange vest with a pale reflective stripe, yellow harness straps, cut off by the inner ring.

idle, beat by beat: frames 1-4 (180 ms each) the glint moves a quarter turn round the rim, top left to bottom right; frame 5 (1400 ms) rest; frame 6 (150 ms) blink, both eyes become one dark line. Nothing else moves.

Choices the owner might change:
- The ears barely show; they sit under the hat brim behind the plank ends.
- Whiskers are pale lines on the cheeks, not lines past the face as in his full drawing, so they don't run into the planks.
- Only a narrow band of shoulders shows, so the harness straps read as yellow marks more than straps.
- Wood and vest colors were picked by eye from the reference pictures, not from his drawing's palette.

Possible bug, not fixed: the planks didn't show when their palette keys were l / L / D, and appeared after renaming them j / J / G. The cause wasn't found, so another part could hit the same thing.
