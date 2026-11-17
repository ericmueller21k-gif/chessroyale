# Moon's Ride: the star drawn once, behind the pawn (Nov 17, 2026)

Eric, after #768: "Still weird lines on the star, how hard is this to fix Jesus". The cause: the seat was a second, masked copy of the
star drawn over the pawn, and every edge of that copy (its outline, rim light, shading, the mask's edge) landed on the pawn and its items.
Now the star, its seat's lip and the sparkler fizz are drawn once, behind; the ride's front layer draws nothing; the rider (pawn and
items, one group) is clipped by a shape the ride gives per frame (`RiderPose.hide`, new and optional; `Items.tsx`'s `RideLayers` and the
town's `rides.ts` apply it in place of the straight `cut`, which still places the pawn). The clip's edge is the lip's line, drawn behind.
**Call:** the brief said "outside the dip, don't clip", but at the ride's 0.75 size the pawn's base and most skins (suit, coat, chimney,
ninja gi) are wider than the dip below the lip (measured: they reach x 10 to 83 where the dip spans 22.5 to 71.5), so beside the dip the
edge is the fourth pass's curved shoulder, now only a clip: a weapon hanging low beside the pawn (katana, tommy gun) ends there, as before.
The fizz moved behind (its sparks crossed the parrot's tail). Art unchanged; `ride-cells.ts` only its hash.
