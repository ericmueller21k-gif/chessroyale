# Boss art: dash-lie

- Model claude-opus-5-5, effort high, adaptive thinking. 23 turns, 13 renders.
- Spend: **$2.37** of the $6 cap (50 input, 153,657 cache-write, 2,323,633 cache-read, 56,616 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/dash-lie/dash-lie.ts.
- Previews: scripts/boss-art/out/dash-lie/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/dash-lie/looks/.

## Its notes

Dash lying down with his clock is drawn and every animation has been looked at: idle, lieDown and getUp, every frame at 4x or larger on dark and light grounds, plus the phone-size view. At 1x he still reads as Dash lying down with a clock. File: scripts/boss-art/out/dash-lie/dash-lie.ts, export DASH_LIE, id "dash-lie", 128 x 60, foot [64, 57]. Nothing touches the frame's edge; the only warning left is the expected one about the boss's other animations not being drawn.

**The palette is not exactly his yet.** packages/app/src/characters/boss-blitz.ts isn't anywhere I can read, so his colors are picked by eye from the three reference pictures, under palette keys I chose myself. Before this ships, copy his real PALETTE over mine and rename my keys to match his. His outline and proportions are matched by eye the same way.

**idle** (loops, 8 frames x 100 ms = 800 ms)
1. Paw lifted 3 px.
2. Tap (cue "tap"): the claw hits the right button, which goes down while the left one pops up, the flag nudges, and little amber tap lines appear.
3. Paw half up.
4. Paw lifted.
5. Paw lifted.
6. Second tap (cue "tap"), same as frame 2.
7. Paw half up.
8. Paw lifted, back to frame 1.
All through, his eyes stay half-lidded with a sly grin, the tail tip flicks lazily, the top sneaker bobs twice per cycle and his head stays propped in his near paw. The loop is seamless, with exactly two tap cues.

**lieDown** (6 frames, 540 ms; its last frame is idle's first)
1. 70 ms, cue "zip": he zips in from the right as a smear (cap, face, teal jacket) with the clock out front and speed lines.
2. 70 ms: the smear stretches across the frame, the clock in front, speed lines behind.
3. 90 ms: he drops onto his side, 3 px up, eyes wide, clock held up, a skid of dust.
4. 90 ms: he thuds down with dust; the clock is still coming down.
5. 100 ms: the clock is plunked down with dust at its base, and his head settles onto his paw.
6. 120 ms: idle frame 1.

**getUp** (6 frames, 430 ms)
1. 70 ms, cue "zip": he springs 4 px up, eyes wide, clock grabbed and lifted, dust under him.
2. 70 ms: he becomes a smear heading right with the clock, speed lines and dust left behind.
3. 70 ms: the smear exits at the right edge with the clock.
4. 80 ms: speed lines only.
5. 80 ms: fewer, fading lines.
6. 60 ms: empty.

**Where things are** (frame pixels, floor at y 57)
- **The clock**, at rest in every idle frame: body x 4-31, y 40-55; buttons at x 8-12 and x 20-24, rising to y 36 or 37. With its outline, the whole box is x 3-32, y 35-56; use this to line it up beside the player's clock. He taps the right button (x 20-24); the red flag is at about x 12-14, y 41-42.
- **His face**: head about x 34-58, y 13-36, with the cap up to y 9 and the brim out to x 69. Eyes at y 21-23 (x 35-39 and 45-49), nose and mouth around x 40-47, y 25-30. His near paw props his cheek at about x 51-59, y 33-38.
- **His body**: jacket x 54-84, shorts x 85-97, legs and sneakers out to x 121; the tail curls up to about x 121, y 15.

**Calls you might want to change**
- Both zips show him as a banded smear of his colors rather than his full figure, because sliding the figure in would push it past the frame's edge.
- He looks more cheerful than the brief's "bored": a clear grin reads better at phone size.
- At 1x he is much smaller than the tiger, because he keeps his own pixel scale as the brief asked.
- The crossed sneakers read more as stacked than crossed at small sizes.
- There's a faint floor shadow under him.
- On a light ground, every third speed line is grey so they still show.
