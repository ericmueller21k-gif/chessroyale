# Boss art (item): babur-balloon

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 3 renders.
- Spend: **$0.22** of the $3 cap (12 input, 18,733 cache-write, 42,206 cache-read, 5,778 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/babur-balloon/babur-balloon.tsx.
- Previews: scripts/boss-art/out/babur-balloon/preview/frames.png, scripts/boss-art/out/babur-balloon/preview/look.png. Each look it took: scripts/boss-art/out/babur-balloon/looks/.

## Its notes

Babur's Balloon is done: a rare weapon, id "babur-balloon". It's a puffy balloon shaped like a knight's head, so I didn't fall back to the round balloon with a knight on it. The head faces left toward the pawn and has a small ear, a long rounded snout, a black eye and nostril, and faint scalloped lines for a mane. A small knot sits at its base. The balloon is the painted part, with a white gloss streak across the forehead, a glint on the snout and a soft white patch on the cheek. The string is a thin dark line (lw 1.3) with a little curl near the hand, ending in a small cream grip dot at (76, 61). At rest the balloon floats beside the pawn's head, up to about y -7.7, under the y -9 cap. I checked it at phone size and in every color, and the knight shape reads at 60 px.

Motion: 10 frames of 300 ms each, a 3-second loop.
- The balloon swings like a slow pendulum on its string, about ±6° around the hand.
- It tilts about 1.5 times as far as the string swings, so it looks like it's floating.
- It dips a little, at most 1.8 units, twice per loop (at each side of the swing). It only moves down, so it never rises past the cap.
- The string bows away from the swing, lagging behind the balloon.

Things you might want to change:
- **String on dark backgrounds:** the string is near-black (#1d1d1f), the house outline color, so it's faint against a black pawn and dark backgrounds. A light grey or cream string would show more.
- **Wider box:** at the far right of the swing the balloon reaches x≈105, so I widened the frame box to [56, -9, 50, 74]. If the tile should stay inside the square, cut the sway to about ±4°.
- **Constant motion:** it sways the whole time rather than resting now and then, as the brief asked.
- **Description:** "A knight that only moves up. Babur swears it's an L-shaped float."
