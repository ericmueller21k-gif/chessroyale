# Trail: Birdie's Train (`birdie-train-ride`)

Give **Birdie's Train** (`birdie-train-ride`), the finished ride in `scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx`, its **trail
mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white droplets. It's
drawn only while it runs, never while it stands.

- **The mark:** a pair of little rail-tie marks: two short dark bars side by side, like the wooden ties under a track, lying across the way it ran. About 30 x 12 units (at most 40 x 30; a square is 69).
- **Its color:** fixed: a dark brown-grey for the ties, with a lighter edge on each bar.
- **How it fades:** 3 frames, about 450 ms: sharp, lighter and a touch smaller, then gone.
- **One on every square it leaves.**
- **Which way:** the ties lie across the way it ran (so they turn with the view): across the path going right or left, sideways-on going up or down.
- **Take out of its frames:** none known (check every view). Keep everything it does now, including the roof puff that goes along with it.
- Change nothing else about the ride.
- Cap: $1.50, effort medium.
