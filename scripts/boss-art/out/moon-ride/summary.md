# Boss art (rider): moon-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 14 turns, 7 renders.
- Spend: **$0.73** of the $6 cap (32 input, 42,048 cache-write, 375,605 cache-read, 22,145 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/moon-ride/moon-ride.tsx.
- Previews: scripts/boss-art/out/moon-ride/preview/idle.png, scripts/boss-art/out/moon-ride/preview/move.png, scripts/boss-art/out/moon-ride/preview/look.png. Each look it took: scripts/boss-art/out/moon-ride/looks/.

## Its notes

Moon's Ride (id moon-ride, mythic): a flat crescent moon lying level like a flying board, floating over a soft ground shadow. I drew the side view only; the brief didn't ask for front or back. I checked idle and move at 4x and at town size, with white and black pawns, in every color.

Shape: the top is a nearly straight deck with a thin lighter band where the camera sees the top surface. The underside is the moon's outer curve, a shallow belly about 15 units thick at the middle. Both tips are thin, level points with no upturn, so it never reads as a bowl or a boat. The painted part (Regions "deck" and "moon") is the whole moon, with a pale rim highlight under the deck edge, a darker belly shade and a few faint craters.

Face: on the thick edge toward the front tip, in fixed colors: a calm half-lid eye with a tiny highlight, a small smile and a pink blush. On dark colors (midnight, cobalt) it gets a pale cream edge.

Pawn: upright on the deck, pawnY −18, cut 88 (nothing hidden). Its base rests on the deck line and the moon's edge is drawn in front of it, so it reads as riding on the board.

Width: the tips run from x −10 to 110, about 123 units with the outline. The idle stars stay within x −10.5 to 111.6. In the move, the sparkle trail reaches back to about x −30, roughly 20 units behind the tail.

Idle (8 frames × 260 ms, 2.1 s loop): the moon and pawn float up about 2.6 units and settle back, and the shadow shrinks a little as it rises. Five four-point stars around it twinkle on offset phases: each grows, glows and fades out.

Move (6 frames × 100 ms, dx 0 to 83.3 evenly spaced, so the next square's frame 0 at dx 100 follows on): a steady glide. The nose dips, leaning from 1° to 4.5° in frame 2, then levels to 1.4° by frame 5, with a tiny dip in height; the pawn tilts with the deck. Behind the tail, three sparkle stars drift back, shrink and fade, with two short pale streaks and a couple of tiny dots.

Choices you might want to change:
- The 600 ms per square was my guess; I didn't check the town's walking speed.
- On midnight the moon's body is dark on the dark background. The face and stars still read, but the board's silhouette is weaker than on light colors.
- I tried a soft yellow glow behind the moon and took it out, because it showed as a gray haze at town size.
- The description text can be reworded freely.
