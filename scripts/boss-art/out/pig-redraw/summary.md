# Boss art: pig-redraw

- Model claude-opus-5-5, effort high, adaptive thinking. 26 turns, 18 renders.
- Spend: **$1.51** of the $8 cap (56 input, 101,788 cache-write, 1,779,591 cache-read, 32,351 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/pig-redraw/pig-redraw.ts.
- Previews: scripts/boss-art/out/pig-redraw/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/pig-redraw/looks/.

## Its notes

Wrangler now looks at whatever he ropes, and he pulls by leaning back away from it with both hands on the rope. I checked every changed animation at 4x on dark and light backgrounds and at phone size. `idle`, `taunt`, `leap`, `ready`, `introThrow` and `introYank` are untouched, and the palette, frame size, constants, part drawings and loop paths are all as they were.

THE `look: "right"` FIELD
- How it places the head: it draws his own head and hat parts mirrored, turned around x 37.5, the middle of his skull. So the head layer goes at x = 75 - (18 + 44) = 13 and the hat at 75 - (its left edge + its width). Lean and headDx still move the head as before.
- Result: the skull and neck sit exactly where they did. The snout, pupils and hat brim point to our right, and the near ear sticks out on our left. The band and star read fine at 4x.
- Light: on the mirrored head the light comes from the top right instead of the top left. That's the cost of reusing his own parts.

THE `hold` FIELD (new, not in the brief)
This is a second field I added: both hands on one rope. The rope to the loop runs straight from his front fist. A short piece of rope joins the two fists, and the end hangs from his back fist.

LASSO
- f8-f14 (throw, flight, catch, smug): look right, eyes on the loop.
- Throw arm (outside the brief): I moved the shared throw arm forward, fist at (43,46) instead of (37,44). This affects f10-f14. In the landed frames the rope now leaves from his front instead of draping across his chest.
- f15 (tug): coil put away (coil: null). His coil-arm fist is in front at his hip (pose 64,51), his lasso fist behind it close to his body. He leans -1.
- f16-f18 (hauls): the same grip, leaning -3, head tilted back 1 px, boots where they were. The rope runs straight from the front fist to the loop as it drags.
- f19 (flick): still looking right, fist snapped up beside his head, the line going behind his head to the loop.
- f20 on: his head turns back as the loop comes home over him.

WINDUP
- f28-f32 (throw to catch): look right. The lasso fist casts forward to (43,46), so both ropes leave from in front of him.
- f33-f35 (yank): looking right, lean -3, both fists in front on our right, one rope per fist. Pose points are (47,51) and (64,52).
- f36: still looking right, lasso fist up by his head. From f37 his head turns back.

HAUL
- He keeps his left-facing head, leans to our right (lean 3 on the heaves, 1 between) and digs his heels in (feet l -3, r +1). Both fists are low on our left: the lasso fist in front, the coil-arm fist behind it.
- The fists stay fixed in every frame (the pose subtracts lean and bob).
- HAUL_FISTS = [[17,53],[27,55]] (frame pixels): drawing points (14,50) and (24,52) plus OX/OY.
- Dust (outside the brief): I moved the dust from (30,70) to (24,70), his dug-in left heel. Frames, ms, cues and shakes are as before.

INTROREEL (new; loops, 4 frames at 120 ms)
- The pose: look right, lean -3 on the heaves and -1 between, heels dug in (feet l -1, r +3), both fists low on our right. The short rope between his fists and the hanging end are part of his drawing.
- Cues and shakes: `yank` on f0 and f2, as in introYank. I mirrored the shakes to [-1,0] to match his lean; if you meant them identical, flip them back to [1,0].
- Dust: off his right toe at (72,70) and his left heel at (18,70).
- The rope: the game should draw it from his front fist, the coil arm's (right-hand) fist, the one on our right. Grip points, 2 px above the fist, in frame pixels:
  f0, f1: fist centre (66,55), grip (66,53)
  f2, f3: fist centre (68,54), grip (68,52)

WORTH A LOOK
- His pupils are drawn turned in toward the snout, so the mirrored "wild" eyes (f10-f13) look a bit cross-eyed. That's his original eye drawing, mirrored.
- In the tugs, his lasso arm reaches across the side of his belly to grip behind the front fist. It's stretched, but no more than his existing introYank arm.
- The PREVIEW_ROPE and PREVIEW_HAUL switches are left in the file, set to false. Set one to true to draw a stand-in for the game's ropes when checking the poses.
