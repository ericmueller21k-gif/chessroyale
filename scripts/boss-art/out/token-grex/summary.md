# Boss art: token-grex

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.39** of the $1 cap (18 input, 25,485 cache-write, 104,308 cache-read, 11,989 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-grex/token-grex.ts.
- Previews: scripts/boss-art/out/token-grex/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-grex/looks/.

## Its notes

The Jefferson token is finished: scripts/boss-art/out/token-grex/token-grex.ts, exported as TOKEN_GREX with id "token-grex" and name "Jefferson token". The frame is 40 x 40 on a transparent background and is meant to be shown at 2x. I looked at it at 6x on both dark and light backgrounds and at phone size, and it reads well at both sizes.

**The coin** is the Blitz coin copied unchanged: the gold rim lit from the top left, the rivets, the dark inner ring, the two navy colours for the middle, the faint gold halo, the `k` outline and the glint code. Only the face is new.

**The face** is Jefferson's head seen from the front, filling the navy middle:
- Two short ossicones with dark knobs, each with a small pointed flame on top.
- Ears sticking out sideways.
- A wide yellow brow with orange-brown spots, shaded lighter on the left.
- Heavy, half-shut lids over dark pupils, each with an orange and yellow "fiery glint".
- A long muzzle ending in a cream nose with two nostrils.
- A lopsided grin that turns up on our right, with one tooth showing.
- The top of the spotted neck, cut off by the inner ring, with one mane flame on each side.

The colours come from GREX_PALETTE. A few keys are renamed so they don't clash with the coin's `y`/`Y`/`O`/`k`: the flame core is `l`, and the flame mid-yellow reuses the coin's `Y`.

**`idle`** (the timings are Blitz's):
1. Four frames of 180 ms: the glint moves round the rim a quarter turn per frame, starting at the top left.
2. A rest of 1400 ms.
3. A 150 ms blink: the lids close over both eyes.

Nothing else moves.

**Choices you might want to change:**
- I drew the head from the front, not three-quarters like his boss sprite, so it sits symmetrically like Ginger and Blitz. This shortens his long muzzle, so the face could read a little like a cow; the ossicones, spots and flames are what say "giraffe".
- The mane flames rise on both sides of the neck, like fiery sideburns. His sprite has them on one side only.
- The ossicone flames are only 3 pixels tall, because the inner ring cuts off anything higher.
- The flames don't flicker. The brief says only the glint and the blink move.
