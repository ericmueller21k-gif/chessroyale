# Boss art: boss-blitz

- Model claude-opus-5-5, effort medium, adaptive thinking. 18 turns, 11 renders.
- Spend: **$1.54** of the $3 cap (40 input, 103,875 cache-write, 1,347,516 cache-read, 37,546 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-blitz/boss-blitz.ts.
- Previews: scripts/boss-art/out/boss-blitz/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-blitz/looks/.

## Its notes

Blitz, the speed-chess cheetah, is a concept, so only `idle` is drawn, as the brief asked. I looked at every frame at large scale and at phone size beside the tiger; he comes out about the tiger's height.

Idle: 32 frames of 110 ms (3.5 s), looping.
- The whole time: he bounces on his toes (up 1 px, up 2 px, up 1 px, down, every 0.44 s). His heels lift and his sneakers tip onto their toes. His tail tip flicks on an 8-frame cycle.
- Frames 4–8, the first slap: his paw lifts, winds up, then slams down. He stops bouncing and dips his knees, and the right clock button clicks down 1 px. White and yellow click sparks fly off it, he flashes an open grin and his eyebrow pops up. The frame where the paw lands carries a `click` sound cue.
- Frames 6–11: the red flag wobbles left and right, then settles.
- Frames 12–17: a cocky open grin with teeth and two quick eyebrow wiggles.
- Frames 20–27: a second slap and flag wobble, the same as the first.
- Frames 29–30: a blink, then back to the smirk.

Choices you might want to change:
- His front arm crosses his chest to reach the clock, which can read a little like folded arms. The other way would be to tuck the clock under his back arm.
- I kept his snout short so his head stays round and cat-like; the face is fairly flat in profile.
- I made his eyes a deeper amber-orange because yellow eyes disappeared into the gold fur. I couldn't see clearly how they read at full size, so they're worth a look.
- The bounce never stops, even during the grin. That's restless, as the brief asks, but it may look busy beside calmer bosses; a slower 8-frame bounce would calm it.
- The cap is the same orange as the jacket. A teal cap with an orange brim would set his head apart from his body more.

The file is scripts/boss-art/out/boss-blitz/boss-blitz.ts, exporting BOSS_BLITZ (id "boss-blitz"). It's built on a pose rig (how high he's lifted, knee bend, tail, slapping paw, flag wobble, eyes, eyebrow, mouth), which should make the full set of animations quicker to add if he's chosen.
