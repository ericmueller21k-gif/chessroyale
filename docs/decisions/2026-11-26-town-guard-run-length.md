# The night town guard records its whole roam (Nov 26)

- **What failed:** `e2e/town-street.spec.ts`'s loading-screen guard (#969), on main's #969 merge run, #973 twice and #974: Done greyed at the first roam's end.
- **Why:** the town caps a frame's step at 0.1 s, so at the 3 to 4 fps of a CI runner drawing two software-WebGL towns at once (the other worker's desktop town tests) the five walks take 2.5 times as long: the roam took 38 to 44 s, the report's 30 s run ended itself, and Done went grey. It passed only when its shard drew faster (about 25 s alone).
- **Fix:** `?report=S` sets the run's length (frame-report.ts `reportMs`, 5 to 300 s; plain `?report` is 30 s as before). The guard asks for 120 s and checks the run is still recording as it presses Done, so every frame of the roam is checked and an overrun says so plainly. No guard loosened, no retry.
