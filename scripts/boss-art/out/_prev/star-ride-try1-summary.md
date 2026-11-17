# Boss art (rider): star-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 13 turns, 8 renders.
- Spend: **$1.04** of the $20 cap (28 input, 60,184 cache-write, 461,959 cache-read, 32,389 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

**Moon's Ride** (id "star-ride", mythic, one color): a thick, puffy five-pointed star with rounded points. It floats flat and level under the pawn, and the pawn sits upright in the middle of its top face. Description: "A whole star to sit on. Wishes not included; parking is a nightmare."

**Size:** the star is about 96 units wide. With the sparks during the move it's about 117 (x −16 to 101), under the 125 limit. The pawn's head reaches y −6 at rest and about −8.5 at the top of the idle bob, inside the −9 limit.

**The shape:** The top face is drawn as seen from slightly above. Below it is an 11-unit rounded side, built from stacked layers so it bulges out a little like a pillow and tucks in underneath. One bold outline goes round the whole shape, and a thin darker line marks where the top face meets the side.

**Shading:** all of it is the item's color, light to dark:
- The top face is lighter, with a slightly darker rim at its edge, a soft white highlight in front of the pawn and two small glints.
- The side runs from a light top edge to a dark underside.
- The side is darkest under the far points.

Pearl shows its shape through the darker sides and Midnight through its lighter top. It reads in every color.

**Turned 12°:** I turned the star 12° from "one point dead ahead". The front point still points right, just slightly toward the camera. One point now points straight back-left (the sparks come from there), one points down toward us, and the two far points peek out on either side of the pawn. Without the turn, the pawn hid the far point and the star read as a blob.

**Shadow:** a soft dark ellipse on the ground at y 100, about 8 units below the star. It stays put and shrinks a little as the star rises.

**Idle** (12 frames × 140 ms, 1.68 s): a slow bob up 2.5 units and back down. The pawn moves with the star and the shadow stays still. No sparks.

**Move** (8 frames × 70 ms, 560 ms, dx 0 to 100 in even steps, so each move leads straight into the next):
- The star glides across the square, tilted 3° forward, with the pawn tilted to match.
- It bobs 2 units once per square.
- A small pale-gold glow sits at the back point. Each frame a new pale-gold or white spark pops out of it, drifts out about 18 units and shrinks and fades over 3 frames. The sparks move with the star, so nothing is left behind.

**Things you might want to change:**
- The star is seen from about 33° above (vertical squash 0.55). Seeing more of the top face would push the pawn's head past the −9 limit.
- The pawn's base sits 4 units in front of the star's center, and nothing of the pawn is hidden (cut 92).
- The shadow sits at y 100, at the bottom edge of the pawn's square.
- The 12° turn above.

There's no trail mark and no front or back view yet.
