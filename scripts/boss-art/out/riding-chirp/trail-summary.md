# Boss art (rider trail): riding-chirp

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 2 renders.
- Spend: **$0.30** of the $1.5 cap (10 input, 42,291 cache-write, 101,091 cache-read, 3,267 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/riding-chirp/riding-chirp.tsx.
- The trail: its mark {"frames":4,"lifeMs":600,"every":1,"w":24,"h":22,"drawn":"23 x 21 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/riding-chirp/preview/idle.png, scripts/boss-art/out/riding-chirp/preview/move.png, scripts/boss-art/out/riding-chirp/preview/look.png, scripts/boss-art/out/riding-chirp/preview/front-idle.png, scripts/boss-art/out/riding-chirp/preview/front-move.png, scripts/boss-art/out/riding-chirp/preview/back-idle.png, scripts/boss-art/out/riding-chirp/preview/back-move.png, scripts/boss-art/out/riding-chirp/preview/views.png, scripts/boss-art/out/riding-chirp/preview/trail.png, scripts/boss-art/out/riding-chirp/preview/ride.gif. Each look it took: scripts/boss-art/out/riding-chirp/looks/.

## Its notes

I added Riding Chirp's trail mark. I didn't change anything in the ride itself: no view's idle or move leaves anything behind, so there was nothing to take out.

**The mark:** a pair of small three-toed grasshopper prints, one on every square it leaves. Each print is a round heel pad with three toes fanning forward. They're in a fixed dark green-brown like damp soil (#3b3a1a), with a thin muddy-olive rim (#8c8a52) so they still show on the dark brown squares. They don't take the item's color. The box is 24 × 22 units, the mark is about 18 × 14, and it's flattened to 0.9 depth like the town's floor.

**Direction:** the toes point the way it ran: right for the side view (the town mirrors it for left), up for the back view and down for the front view. The marks take turns using n. On even marks the pair sits a bit to one side of the path with the other foot slightly ahead, and odd marks swap both, so a run looks like a left/right hopping track.

**Fade** (4 frames, 600 ms): 160 ms pressed dark (opacity 0.95), 150 ms lighter (0.68), 150 ms faint (0.4), 140 ms nearly gone (0.16). The prints also shrink a little as they fade, from 1.2× down to 1.06×.

**Choices you might want to change:**
- The light rim could go if you want purely dark prints. They'd still be readable on the light squares, but weaker on the dark ones.
- The prints could be larger, since they're small at town size.
- The mark could appear every 2 squares instead of every one, for a sparser track.
