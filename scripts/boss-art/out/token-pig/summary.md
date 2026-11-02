# Boss art: token-pig

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 4 renders.
- Spend: **$0.57** of the $1 cap (24 input, 31,301 cache-write, 187,398 cache-read, 18,890 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-pig/token-pig.ts.
- Previews: scripts/boss-art/out/token-pig/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-pig/looks/.

## Its notes

The Wrangler token (token-pig) is finished. I rendered it at 4x and 6x on dark and light backgrounds and at phone size, and looked at all 6 idle frames. It renders with no warnings.

Frame and scale: 40 x 40, transparent background, meant for 2x. The coin is copied unchanged from token-blitz: rim, rivets, dark inner ring, navy middle, outline, faint gold halo and the glint code. Only the face layers are new.

The face fills the navy middle, cut off by the inner ring:
- Hat: brown cowboy hat, lit from the top left, with a dented crown whose top the ring cuts off. A dark band, a small gold star on the crown, and the brim curled up at both ends.
- Ears: pointy pink ears with darker insides, sticking out under the brim.
- Brows and eyes: heavy angry brows that dip into the inner corners of narrowed eyes glancing inward.
- Snout: big and pale, with a dark rim, two nostrils and a highlight.
- Grin: a wide, clenched, toothy grin that rides higher on our right.
- Shoulders: pink chest in an open brown vest, with a gold star on the vest on our right.

Idle, beat by beat:
- Frames 1 to 4 (180 ms each): the glint goes round the rim a quarter turn at a time, starting at the top left.
- Frame 5: a 1400 ms rest.
- Frame 6: a 150 ms blink. The eye whites close to a dark line under a pink lid, and the brows stay put.
Nothing else moves.

Choices the owner might change:
- No rope coil. I drew one on his left shoulder, but its brown blurred into the vest, so I took it out of the layers. Its leftover code is still in the file and can be deleted.
- Two small stars. The hat star is only 5 px wide, because the ring cuts the crown, and it's the weakest detail at 2x. With the vest star there are two small stars rather than one emblem; dropping the vest star would leave the hat star as the single emblem.
- Colour keys. The pig's snout-rim colour is renamed "m" because the coin uses "n" for its navy. Both stars use the coin's gold rather than the pig's slightly different gold.
- The scheming look comes from the lopsided grin and the inward glance. Either can be made symmetric.
