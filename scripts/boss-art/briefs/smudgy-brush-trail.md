# Trail: Smudgy's Brush (`smudgy-brush`)

Give **Smudgy's Brush** (`smudgy-brush`), the finished ride in `scripts/boss-art/out/smudgy-brush/smudgy-brush.tsx`, its **trail
mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white droplets. It's
drawn only while it runs, never while it stands.

- **The mark:** dabs of paint: two or three small round dabs and a short swipe, as a brush leaves. About about 26 x 14 units (at most 40 x 30; a square is 69).
- **Its color:** the item's color (p.hex or a Region), with a darker edge so it reads on both floors.
- **How it fades:** 4 frames, about 700 ms: wet and glossy, drying matte, breaking up, gone. One on every square it leaves.
- **Which way:** the swipe follows the way it ran; the dabs the same every way.
- **Take out of its frames:** the color ribbon (the trail with dry-brush streaks) behind the tips in the move frames, every view; and the color wisp that grows up out of the tips in the idle (frames 2 to 6). Keep everything else: the bob, the sway, the painted bristle tips.
- Change nothing else about the ride.
- Cap: $1.50, effort medium.
