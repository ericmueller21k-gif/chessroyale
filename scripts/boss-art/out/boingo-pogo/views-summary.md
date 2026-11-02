# Boss art (rider views): boingo-pogo

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.52** of the $3 cap (16 input, 43,100 cache-write, 178,463 cache-read, 13,433 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boingo-pogo/boingo-pogo.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/boingo-pogo/preview/idle.png, scripts/boss-art/out/boingo-pogo/preview/move.png, scripts/boss-art/out/boingo-pogo/preview/look.png, scripts/boss-art/out/boingo-pogo/preview/front-idle.png, scripts/boss-art/out/boingo-pogo/preview/front-move.png, scripts/boss-art/out/boingo-pogo/preview/back-idle.png, scripts/boss-art/out/boingo-pogo/preview/back-move.png, scripts/boss-art/out/boingo-pogo/preview/views.png. Each look it took: scripts/boss-art/out/boingo-pogo/looks/.

## Its notes

I added front and back views to Boingo's Pogo. The side view's code is unchanged. The only edits outside the new code are one added type import and the new `views` field. I looked at both views at 4x, at town size and in every color, with both pawn colors. No warnings came up.

**Front (walking down):** the same round drum seat as the side, at the same size and height: harlequin diamonds on the "seat" region, a white scalloped ruffle with pleats, and the "cushion" top behind the pawn. Below are the "pole" with its diamonds, wider silver pegs, the silver spring and the red rubber foot. The handlebar is closest to the camera, so it's in front: a thin silver stem rises from the pole at peg height up the middle of the drum to a silver crossbar at the ruffle rim (y 39). Each end has a purple grip and a yellow pom-pom. The pawn sits centered and fully visible from the collar up. The crossbar crosses only its lowest edge.

**Back (walking up):** the same drum, ruffle, cushion, pole, pegs, spring and foot, seen from behind. The handlebar is on the far side, so its crossbar (y 33.5) sits behind the cushion and the pawn. Only the purple grips and pom-poms stick out left and right, which reads as the handlebar seen end-on. The stem is hidden behind the drum and pole. The pawn is seen from behind, centered.

**Both views:** the same pawn height and cut as the side (lifted 25, cut 66), and pawnX 0 at rest. They also share the side's colors, the same three painted regions with the same names, the darker diamonds (lighter on Midnight), and the ground shadow drawn by the ride.

**Idle (8 frames, 960 ms):** the side's idle beat for beat. The spring squashes about 3 units and stretches about 2, the foot stays planted, the pawn follows the seat a little late, and both pom-poms jiggle against the bounce.

**Move (12 frames, 880 ms, the side's timings, dx always 0):**
- **Load (0–2):** the spring squashes hard, with a slight roll.
- **Launch (3):** the spring stretches, it springs straight up, and the pawn sinks into the seat for a moment.
- **Arc (4–7):** it rises to 36 units at frame 6 while the shadow shrinks and fades. It rolls side to side up to about 2.5° instead of the side's lean.
- **Reach (8):** the spring stretches toward the ground.
- **Land (9–11):** it squashes on landing, makes a small 3-unit rebound and settles, which leads back into frame 0.

All the way through, the pom-poms bob and spread a little apart. The roll tips one end of the bar up and the other down.

**Choices you might want to change:**
- **Front stem:** it runs down the middle of the drum's face and covers the center diamonds on the seat and pole. Hiding it would be wrong for where the handlebar sits, but the stem could be thinner or dropped if you want the face clean.
- **Crossbar width and heights:** the poms reach x of about 4 and 96, wider than the side's drum. The bars sit at y 39 on the front and 33.5 on the back.
- **The wobble:** its size (up to 2.5°), and the idle has no roll.
- **Same table on both ends:** front and back share one move and idle table, so the roll leans the same way on screen in both views.
- **Ground shadow:** drawn by the ride, as on the side.
