# A shine stays inside its own shapes (Nov 15, 2026)

Eric (Nov 15, the locker's Ride tab, a computer): "whats this bug, this shit is sliding across the pawn": a shiny Boingo's Pogo's
shine slid across the preview as a whole rectangle. The cause: a Region's clip id was `${p.id}-${name}`, the same namespace as every
other id made from the paint's id. The pogo's "seat" region got `it5-seat`, the id `RideLayers` gives its rider cut (a big rectangle,
drawn first), so the seat's shine was clipped to that rectangle. The fix: Region clips get their own namespace, `regionClip(p, name)` =
`${p.id}-clip-${name}`, which no other id uses, so no region name can collide. The hollow bulb uses `regionClip` for its glass. Rides
re-measured: hashes only. Guard: `e2e/profile.spec.ts`, "a shiny ride's shine stays inside its own shapes". Targeted lane.
