# Rides wade in Chandy's Swamp too (Nov 16)

Eric: "when you're on a ride in the town, it doesn't show the splashing in the swamp ... don't do each one individually. Just make it
like a fixed kind of depth for all of them ... it just covers up a little bit of the bottom of every ride, and then it just does the
same splash." Done: `drawRiding` uses the walk's `wadeIn`/`unwade`/`splashFrom` at the room's one `wade.depth`, no shadow in the water,
dry once lifted onto his platform. The test hook `__shopRide()` gains `wading`; check in `e2e/chandy-home.spec.ts`.
