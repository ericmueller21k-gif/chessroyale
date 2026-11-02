# Boss art: token-blitz

- Model claude-opus-5-5, effort medium, adaptive thinking. 9 turns, 5 renders.
- Spend: **$0.38** of the $1 cap (22 input, 23,249 cache-write, 114,244 cache-read, 11,914 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-blitz/token-blitz.ts.
- Previews: scripts/boss-art/out/token-blitz/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-blitz/looks/.

## Its notes

Blitz token: 40 x 40 pixels, transparent background, meant to be shown at 2x. Exported as TOKEN_BLITZ, id "token-blitz", name "Blitz token". I checked every frame at 4x on dark and light backgrounds, and the idle and blink frames up close.

The coin is the Chess Town crest's coin rebuilt: the same gold rim lit from the top left, 8 rivets, the dark inner ring, the navy middle (a little lighter toward the bottom), the k outline and the faint gold halo. The crest pulls a helper from the town folder, so the token has its own small copy and only imports sprite.ts.

The face sits in separate layers on top of the coin (ears, brim, head, cap, shoulders), so the same coin can take any boss's face:
- tan fur with dark spots and a cream muzzle
- amber eyes with dark pupils and heavy lids for the cocky look
- bold black tear marks from the eyes down to the mouth
- a lopsided grin with one fang showing
- small round ears
- an orange backwards cap: the strap opening shows on his forehead and the teal brim pokes out to the upper right
- teal jacket shoulders with orange side panels and a zip

Idle animation, 6 frames, about 2.3 s per loop:
- Frames 1 to 4 (180 ms each): a star glint goes round the rim from the top left to the bottom right, a quarter turn per frame.
- Frame 5 (1400 ms): rest, no glint.
- Frame 6 (150 ms): a blink.

Things you might want to change:
- The grin is subtle when the token is small. A wider mouth or a bigger fang would make the attitude read more.
- The brim is only a small wedge, because the cap covers most of it from the front.
- The glint goes round the rim, like the crest's. A sweep across the face could replace it.
- The spots are placed by hand (the SPOTS list), so they can be moved one by one.
- For the other bosses, swap the face layers and keep the coin, the glint and the timing.
