# Boss art: token-birdie

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 9 renders.
- Spend: **$0.69** of the $1.5 cap (32 input, 39,370 cache-write, 317,490 cache-read, 21,338 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-birdie/token-birdie.ts.
- Previews: scripts/boss-art/out/token-birdie/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-birdie/looks/.

## Its notes

The Birdie token is finished: a 40 × 40 frame on a transparent background, meant for 2x. I checked it at 4x and 8–10x on both dark and light backgrounds, and at phone size, and I looked at every frame.

**One thing to check first:** I wasn't allowed to read `token-blitz.ts` or `token-ginger.ts`. So the coin is not copied from Blitz's file. I rebuilt it from the Chess Town crest's own code (`arena-town-badge.ts`), which I could read: the same rim with its top-left shading, the eight rivets, the dark inner ring, the gold palette, the faint gold halo and the same glint. The only change from the crest is that the inside is plain navy (`N`), with no cobbles or lighter lower band. It looks the same as the approved Blitz and Ginger pictures, but if Blitz's coin code has any small tweaks, paste his `disc` and `glint` over mine. The face layers stand on their own.

**The face** fills the navy middle and is cut off by the inner ring: head and shoulders only.
- **Head:** a grey-brown dove head, narrower at the chin, lit from the top left, with a pale pinkish-buff throat and staggered scallop feathers on the cheeks and shoulders.
- **Eyes:** two big dark eyes in pale rings, each with a white catchlight, so he looks friendly rather than sad.
- **Beak:** a narrow dark beak pointing down between the eyes. My first, wider version read like a cat's nose.
- **Cap:** a navy conductor's cap, worn tilted (the band rises toward the right), with a lighter blue top edge so it doesn't merge with the coin's navy. It has a gold band, a dark visor and a plain gold shield badge in the rim's gold colours, with no lettering.
- **Tie:** a small burgundy bow tie at the neck.

**`idle` animation** (6 frames, 2270 ms, loops):
1. Frames 1–4, 180 ms each: the glint sits at the top left, top right, bottom right, then bottom left of the rim.
2. Frame 5, 1400 ms: a rest with no glint.
3. Frame 6, 150 ms: a blink. Both eyes close into happy downward curves.

Nothing else moves.

**Choices you might change:**
- **Front view:** I drew Birdie facing forward, like Ginger and Blitz. A front-on bird can look a little owl-like. A three-quarter view facing left, like his idle sprite, would show his dove beak better but wouldn't match the series' pose.
- **Bow tie:** I used a bow tie instead of the hanging necktie from his idle sprite. A hanging tie under the beak read as a tongue.
- **Cap tilt:** the tilt is set by `capBottom` and `capTop`.
- **Badge:** a 3 × 3 shield sitting just above the band.
- **Colours:** the dove ramp is `A`/`B`/`C`/`D`, the throat is `P`/`p` and the cap is `q`/`Q`/`V`/`v`. All are easy to retune in the palette.
