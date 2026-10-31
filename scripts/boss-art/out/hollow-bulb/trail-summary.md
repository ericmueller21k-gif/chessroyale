# Boss art (rider trail): hollow-bulb

- Model claude-opus-5-5, effort medium, adaptive thinking. 3 turns, 1 renders.
- Spend: **$0.20** of the $1.5 cap (8 input, 30,285 cache-write, 46,706 cache-read, 1,882 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-bulb/hollow-bulb.tsx.
- The trail: its mark {"frames":4,"lifeMs":700,"every":1,"w":32,"h":18,"drawn":"26 x 12 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/hollow-bulb/preview/idle.png, scripts/boss-art/out/hollow-bulb/preview/move.png, scripts/boss-art/out/hollow-bulb/preview/look.png, scripts/boss-art/out/hollow-bulb/preview/front-idle.png, scripts/boss-art/out/hollow-bulb/preview/front-move.png, scripts/boss-art/out/hollow-bulb/preview/back-idle.png, scripts/boss-art/out/hollow-bulb/preview/back-move.png, scripts/boss-art/out/hollow-bulb/preview/views.png, scripts/boss-art/out/hollow-bulb/preview/trail.png, scripts/boss-art/out/hollow-bulb/preview/ride.gif. Each look it took: scripts/boss-art/out/hollow-bulb/looks/.

## Its notes

Hollow's Bulb now has its trail mark: a dark, smoky violet-black smudge with a faint glint of the glow's color in the middle. It looks the same whichever way the bulb runs. The trail render shows it reading on light and dark squares at town size and in all nine colors. The final before-and-after check of the ride's frames happens in this done step.

**The mark** (32 × 18 box, one on every square left, 4 frames, 700 ms, a bit longer than the droplets' 520 ms):
- **Frame 0 (180 ms):** a dark, full flattened oval (about 26 × 13) with a soft edge. A small glint sits in the middle in a lighter shade of p2 (the glow's color).
- **Frame 1 (180 ms):** softer and a little wider, with the glint dimmer.
- **Frame 2 (180 ms):** it breaks into four small, faint wisps, with only a trace of glint left.
- **Frame 3 (160 ms):** three tiny, very faint wisps and no glint, then it's gone.

**Taken out of the ride's frames:** nothing. I went through the side, front and back views, idle and move. Nothing is left behind: the ground glow and violet shadow move with the bulb, and I kept them as the brief asked. The ride's code is unchanged; I only added the `trail` field, the Mark function after the ride's code, and the `TrailProps` type import.

**Choices you might want to change:**
- **Glint:** in red it comes out pinkish because it's lightened toward white. A darker or smaller glint would make it subtler.
- **Wisps:** the frame 2 and 3 wisps sit in fixed places, so every mark breaks up the same way.
