# Boss art (rider): sawyer-dozer

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.56** of the $6 cap (18 input, 33,867 cache-write, 137,979 cache-read, 17,997 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sawyer-dozer/sawyer-dozer.tsx.
- Previews: scripts/boss-art/out/sawyer-dozer/preview/idle.png, scripts/boss-art/out/sawyer-dozer/preview/move.png, scripts/boss-art/out/sawyer-dozer/preview/look.png. Each look it took: scripts/boss-art/out/sawyer-dozer/looks/.

## Its notes

Sawyer's Dozer is finished: a chunky little bulldozer with no cab, seen from the side and facing right. Your pawn sits in the driver's seat at the back, with a dark seat back behind it. The body hides its lower part (cut 68; the pawn is lifted 14 and moved 12 toward the back). I rendered and checked it with white and black pawns, in every color, at 4x and at town size. Both read clearly.

**What it has:**
- A tall front hood with vent slats.
- A headlight inside a black "bandit mask" band, as the raccoon nod.
- A short exhaust stack.
- A black-and-yellow hazard stripe and a red tail-light.
- A big curved blade on a push arm, with a steel cutting edge.
- Two tracks with five wheels and toothed treads.
- A whip antenna with a ringed gray raccoon-tail flag streaming backward.

**Painted (the item's color):** the body, the hood and the blade. It looks like construction yellow in Yellow and swaps cleanly to the other colors.

**Fixed:** the dark tracks, steel wheels and arm, the steel blade edge, the hazard stripe, the dark stack, the white exhaust puffs, the raccoon-tail flag, the headlight and tail-light, and the seat.

**Idle (6 frames × 150 ms):** the engine idles with a small rumble-shake (the group and the pawn jiggle by under one unit). One cloud puff pops out of the stack, rises and drifts away, with a smaller one behind it. The tail flag waves the whole time.

**Move (8 frames × 100 ms, dx 0 to 87.5 in 12.5 steps):**
- The treads roll forward and the wheel bolts turn. Both loop cleanly back to frame 0.
- The blade dips about 2.5° on the first half and lifts about 4.5° on the second.
- Puffs stream backward off the stack.
- Dirt crumbs kick up in front of the blade and behind the rear track.
- The pawn rocks gently, about ±2°.
- Frame 7 leads straight into the next move's frame 0.

**Things you might want to change:**
- The tail flag reaches a little past the square's left edge (to about x −12).
- The blade tip reaches about x 102 and the crumbs about x 110.
- The tile frame is [-12, -8, 124, 108].
- In the default yellow, the hazard stripe's yellow matches the body. It's still outlined and readable; you could make the stripe orange if you'd like more contrast.
- The blade is painted along with the body. Fix it to steel if you want only the body and hood colored.
