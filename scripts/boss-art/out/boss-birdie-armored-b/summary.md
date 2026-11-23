# Boss art: boss-birdie-armored-b

- Model: the art model, effort high, adaptive thinking. 12 turns, 5 renders.
- Spend: **$1.18** of the $4 cap (26 input, 79,716 cache-write, 643,104 cache-read, 32,508 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-birdie-armored-b/boss-birdie-armored-b.ts.
- Previews: scripts/boss-art/out/boss-birdie-armored-b/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-birdie-armored-b/looks/.

## Its notes

I've drawn Armored Birdie's idle (variant B, chunky) and checked every frame at 4x on dark and light, and at phone size beside the tiger. He's 74 x 90 with his feet at (37, 87), a bit taller than the tiger. At phone size he reads as Birdie: the eye, beak and cap come through. The other ten animations aren't drawn, as the brief said, so the render warns that they're still missing.

Idle (16 frames, about 5.3 s, loops):
1. He stands still (0.5 s), breathes in (the body rises 1 px), settles, then blinks once.
2. Another breath, then he glances 1 px to our left, toward the board.
3. The headlights glint one after the other: the near (right) one as a small star, then a bigger one, then the far one the same way (4 short frames).
4. A last breath and blink, then a longer rest (0.7 s) before the loop starts again.
The legs and boots never move; everything above the hips rises with the breath.

What he looks like:
- Head: Birdie's own head paint, made bigger. The round grey-brown head, buff face, grey beak and dark eye in its pale ring with a glint are all there. The navy cap keeps its gold band and now has a gold visor. The burgundy tie sits at his collar.
- Chest: a wide yellow chest plate with a seam, the red stripe down the middle under the tie, a charcoal belt with a gold buckle, and yellow hip plates striped in red.
- Shoulders: big domed plates with the roof's charcoal on top, yellow below, the thin red stripe and a round headlight on each.
- Wings: they hang like arms. Scalloped yellow plates cover the coverts, his dark brown flight feathers fan out behind, and each wing ends in a heavy claw: a charcoal cuff with a red stripe, a yellow knuckle block and three thick talons with silver tips.
- Legs: charcoal thighs and yellow knee plates. The heavy yellow boots have a charcoal cuff, a red stripe and the toe pointing to our left. A big train wheel sits under each heel, with a dark rim, a silver face and a hub.
- Colors: I added only one new color, a darker red for the stripe's shadow. The silver for the lamp rims and wheels comes from Birdie's train.

Choices you might want to change:
- Bigger head: I scaled the head up about 1.25x (the eye is 6 px instead of 5). At his old size the head looked like a pinhead on the wide armor. Shrinking it back is one number, HR, plus the eye grids.
- No tail: a dove's tail behind his legs read as a strange beige stub, so I took it out. The code for it is still in the file, unused, if you want to try it again.
- Only the head turns: the armored body faces straight out like a classic robot-boss stance; only the head looks to our left.
- Wheel soles: the boots sit on one big round wheel each rather than a flattened sole.
- Faint glint on light backgrounds: the white glint is weak against the pale yellow, though it reads clearly on the dark ground.

The file is scripts/boss-art/out/boss-birdie-armored-b/boss-birdie-armored-b.ts, exported as BOSS_BIRDIE_ARMORED with id boss-birdie-armored-b.
