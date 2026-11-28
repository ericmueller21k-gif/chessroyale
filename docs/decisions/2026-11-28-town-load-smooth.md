# The town's first seconds: fixed at the causes, warmed under the curtain (Nov 28)

Eric (his frame report, Edge on Windows): "I don't want it to lag at all when the town loads." Nov 27: a couple more seconds of loading is fine.
- His 55 "other" uploads were your ride's frames (247×174/175) and trail marks (41×34), each uploaded as it first showed. The loading screen now waits for every rider it knows and keeps their pictures; named "ride frame" / "ride trail" in the report.
- The 44 ms idle callback was the box tops' slice (one box's front can take 20 to 45 ms). Worked out on the loading screen instead, and kept between visits under the pictures' key (`brc.townTops`): 0 ms on a later visit.
- The card lifts after 3 warm-up frames drawn under it, each waited for on the GPU (`settle`), at most 2 s (`loadWarmFrames`, `loadWarmMs`).
- The first-frame budget for the town's load, 12 → 14 reference jobs (that extra ~1.5 s at 4x on a first visit).
