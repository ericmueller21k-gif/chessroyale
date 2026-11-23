# Boss art (rider views): birdie-train-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.67** of the $3 cap (18 input, 49,342 cache-write, 235,342 cache-read, 18,772 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png, scripts/boss-art/out/birdie-train-ride/preview/front-idle.png, scripts/boss-art/out/birdie-train-ride/preview/front-move.png, scripts/boss-art/out/birdie-train-ride/preview/back-idle.png, scripts/boss-art/out/birdie-train-ride/preview/back-move.png, scripts/boss-art/out/birdie-train-ride/preview/views.png. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

I've added the front and back views to Birdie's Train. The side view is untouched: all the new code comes after it, plus a `views` field. Both views have the side's 12 idle frames (150 ms each) and 10 move frames (65 ms each), the same pawn height (pawnY −3, cut 70) and pawnX about 0. In the move, dx stays 0. I checked them at 4x and at town size, with white and black pawns and in every color.

**Back view (walking up):**
- The cab's rounded back wall, painted in the item's color (Region name "body", the same as on the side).
- The red stripe across it, a red tail lamp in each corner and a grey buffer plate at the bottom.
- The dark roof edge with its highlight line. Above it, the roof's top runs away from us with the open hatch in it, as the camera looks down.
- The pawn from behind sits in the hatch, visible down to the near rim. Behind it, the windshield's back edge shows round its shoulders.
- The exhaust stack is on the roof's back corner on our right. Two grey end-on wheels sit under a grey truck beam.

**Front view (walking down):**
- The rounded nose, painted in the item's color (Region "body"), with a highlight along its top.
- Two round headlights with lenses and glows. The red stripe sweeps down across the front in a curve, like a smile, and a few grille slats sit under it.
- The dark roof front, and the sloped windshield standing on it.
- The pawn sits behind the windshield: its head and collar are fully above the glass, and its body shows faintly through it.
- Over the pawn's shoulders you can see the back half of the roof and the hatch. The stack peeks up at the far corner, on our left (the mirror of the back view's right).

**Idle (both views):** the side's gentle rock on the springs, seen end-on as a small sideways roll with a slight bob. The headlights (front) and tail-lamp glows (back) slowly brighten and dim in the side's rhythm. In frames 6–11, a puff rises from the stack and fades.

**Move (both views):**
- The body sways side to side (±1.2°) and lifts a touch twice per square.
- The ground shadow shrinks and fades a little as it rises.
- The wheels turn: tread marks run down the tyre faces in the front view and up in the back view. They follow the side's ease-in/ease-out wheel angle, moving three marks' spacing per square, so the last frame leads straight into the first.
- The lamps brighten as it gets going and dim as it stops.
- In frames 0–4, a puff from the stack as it sets off. It travels with the train, so nothing is left behind.

**Choices you might want to change:**
- The stack is on one back corner, not centered, so it doesn't cover the pawn from behind.
- In the front view the pawn's body is seen faintly through the glass, so the pawn reads clearly but shows a little less than on the side.
- The tread marks are small, so at town size the wheel motion reads mostly as the sway and bounce.
- On the Red color, the red stripe merges into the body, as it does on the side.
- A leftover duplicate buffer path is drawn under the back wall, where it's hidden; deleting it won't change the picture.
