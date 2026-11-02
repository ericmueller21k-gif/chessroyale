# Trail: Hollow's Bulb (`hollow-bulb`)

Give **Hollow's Bulb** (`hollow-bulb`), the finished ride in `scripts/boss-art/out/hollow-bulb/hollow-bulb.tsx`, its **trail
mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white droplets. It's
drawn only while it runs, never while it stands.

- **The mark:** a dark, smoky smudge with a soft edge, like a shadow left behind, with a faint glint of the glow's color in the middle. About about 26 x 14 units (at most 40 x 30; a square is 69).
- **Its color:** fixed smoky violet-black, the glint in p2 (the item's second color, the glow's color).
- **How it fades:** 4 frames, about 700 ms: dark and full, softer, breaking into wisps, gone. One on every square it leaves.
- **Which way:** the same every way.
- **Take out of its frames:** none known (check every view). Keep the ground glow and violet shadow under the bulb (they stay with it).
- Change nothing else about the ride.
- Cap: $1.50, effort medium.
