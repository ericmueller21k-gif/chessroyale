# Trail: The Log Roller (`log-roller`)

Give **The Log Roller** (`log-roller`), the finished ride in `scripts/boss-art/out/log-roller/log-roller.tsx`, its **trail
mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white droplets. It's
drawn only while it runs, never while it stands.

- **The mark:** a few **wood chips and bark bits**: three or four little pale wood chips and a dark curl of bark,
  scattered loosely. About 22 x 14 units (at most 40 x 30; a square is 69).
- **Its color:** fixed: pale wood (light tan) chips and dark brown bark, with a dark outline so they read on both squares.
- **How it fades:** 3 to 4 frames, about 600 ms: landed, settling, fading, gone. One on every square it leaves.
- **Which way:** the same every way (a scatter); vary it a little by n so the squares don't look stamped.
- **Take out of its frames:** anything left behind on the ground in any view's move (a bark-dust puff that goes along
  with the log stays). Keep everything else it does now.
- Change nothing else about the ride.
- Cap: $0.60, effort medium.
