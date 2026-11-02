# Trail: Riding Chirp (`riding-chirp`)

Give **Riding Chirp** (`riding-chirp`), the finished ride in `scripts/boss-art/out/riding-chirp/riding-chirp.tsx`, its **trail
mark**: what it leaves on the squares behind it as it runs around the town, in place of the town's white droplets. It's
drawn only while it runs, never while it stands.

- **The mark:** tiny grasshopper footprints: a small pair of prints (each a little three-toed mark), left and right in turn on each square, pointing the way it hopped. About about 18 x 12 units (at most 40 x 30; a square is 69).
- **Its color:** fixed: a dark green-brown, like damp soil.
- **How it fades:** 3 to 4 frames, about 600 ms: pressed dark, lighter, faint, gone. One on every square it leaves.
- **Which way:** the prints point the way it ran; left and right prints take turns (use n).
- **Take out of its frames:** none known (check every view's move). Keep everything it does now.
- Change nothing else about the ride.
- Cap: $1.50, effort medium.
