# Boss art (rider views): balloon-pup

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.86** of the $3 cap (18 input, 57,177 cache-write, 268,899 cache-read, 26,190 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/balloon-pup/balloon-pup.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/balloon-pup/preview/idle.png, scripts/boss-art/out/balloon-pup/preview/move.png, scripts/boss-art/out/balloon-pup/preview/look.png, scripts/boss-art/out/balloon-pup/preview/front-idle.png, scripts/boss-art/out/balloon-pup/preview/front-move.png, scripts/boss-art/out/balloon-pup/preview/back-idle.png, scripts/boss-art/out/balloon-pup/preview/back-move.png, scripts/boss-art/out/balloon-pup/preview/views.png. Each look it took: scripts/boss-art/out/balloon-pup/looks/.

## Its notes

I added front and back views to Balloon Pup. The side view's code wasn't touched: all the new code sits before the export, plus the `views` field and a type import. Both new views reuse the side's beat tables, its squash-from-the-ground and its pawn formula (pawnX 0, the same pawnY and cut 68), so the pawn sits at the same height in all three views. Both have 8 idle frames (1180 ms) and 9 move frames (690 ms), the same timings as the side. I rendered them at 4x and town size and in all the colors, including Midnight with a black pawn.

**Back view:** the round rear bubble (Region "body") with its curved white highlight, centred and about 39 wide. Two hind-leg sausages (legnb, legfb) come out from under it, with knots where they meet it. The two front legs peek outside them, shaded darker (legnf, legff). The short tail sticks up in the middle with its knot and pom (tail, tailknot, pom), in front of the pawn's lower back. The dog's head (head) sits behind the pawn, and only its two ear bubbles (earn, earf) show either side of the pawn's head.

**Front view:** the round head bubble faces us: two dot eyes with white glints, the snout knot ("nose") in the middle and the little smile. The two ears splay up and out. The orange-and-black bow (fixed colours, a bit bigger than on the side) sits on a short neck stub (neck) under the chin. Behind that is the chest bubble ("body") with its highlight, the two front legs with their knots, and the darker hind legs peeking outside. The head is drawn a little lower than on the side (that's the camera's tilt), so the pawn's head and collar stay clear above it.

**Idle, both views:** the same soft bob as the side (a 2% squash and stretch, with the pawn riding the seat). The ears flick about ±3° with the side's head nod, and the head bobs gently. From the back, the tail wags side to side (the side's ±13° swing at 0.8×). On idle frames 4–6 the side's white sparkle glints across the rear bubble from the back, and across the chest from the front.

**Move, both views, in place (dx 0, dy as the side's arc, peaking 23 up at f3):**
- f0: squashes down, legs spread, ears flop out sideways.
- f1: boings up stretched, ears flick up, legs tuck in.
- f2–f5: float. The ground shadow shrinks and fades at the top, then comes back.
- f6: rubbery squash landing, legs splay wide, ears flop flat.
- f7–f8: wobble back up with a small sideways roll of the pawn, then settle. f8 leads straight into f0's squash.

The tail flips from side to side through the jump.

**Choices you might want to change:**
- **Pawn edges at the seat:** the pawn is wider than the bubble there, so small slivers of its base show either side of the rear bubble and the chest just above the cut line.
- **Pom over the pawn:** from the back, the tail pom covers part of the pawn's lower back, as the brief asked for.
- **Front head height:** the head sits lower than on the side so the pawn reads clearly. The ears still overlap the edges of the pawn's collar.
- **Wag instead of swing:** the side's tail swing is shown as a side-to-side wag from the back.
- **Glint on the chest:** from the front you can't see the back end, so the sparkle glints across the chest instead.
- **Midnight with a black pawn:** the pawn blends into the ride a little, the same as on the side view.
