# Trail: Cheetah Shoes (`cheetah-shoes`)

Give **Cheetah Shoes** (`cheetah-shoes`), the finished ride in `scripts/boss-art/out/cheetah-shoes/cheetah-shoes.tsx`, its
**trail mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white
droplets. It's drawn only while it runs, never while it stands.

- **The mark:** little **skid streaks** of dust: two or three short parallel scuffs, like a sneaker skidding off at
  speed, a puff of dust at their back end. About 24 x 10 units (at most 40 x 30; a square is 69).
- **Its color:** fixed: a warm dusty tan (light enough to read on the dark squares, with a darker edge for the light).
- **How it fades:** 3 to 4 frames, about 450 ms (it's a fast ride): sharp, then softer, then puffing apart and gone. One
  on every square it leaves.
- **Which way:** the streaks lie along the way it ran (side: horizontal, mirrored left; up and down: vertical).
- **Take out of its frames:** anything left behind on the ground in any view's move (the speed lines and the dust kick
  go along with it: keep them unless they stay behind). Keep everything else it does now.
- Change nothing else about the ride.
- Cap: $0.60, effort medium.
