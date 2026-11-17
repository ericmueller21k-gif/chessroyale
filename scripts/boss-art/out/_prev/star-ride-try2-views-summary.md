# Boss art (rider views): star-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.54** of the $3 cap (16 input, 40,483 cache-write, 182,736 cache-read, 14,869 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png, scripts/boss-art/out/star-ride/preview/front-idle.png, scripts/boss-art/out/star-ride/preview/front-move.png, scripts/boss-art/out/star-ride/preview/back-idle.png, scripts/boss-art/out/star-ride/preview/back-move.png, scripts/boss-art/out/star-ride/preview/views.png. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

Moon's Ride now has front and back views. They use the side's star code turned to -90°, so one point faces straight at the camera and the shape is symmetric about x 50. Everything else is the side's: the 0.7 squash, the 14-unit puffy side that darkens underneath, the domed top, the highlight, the white glint on the back-left shoulder (lit from the same screen direction), the soft dip under the pawn and the ground shadow. The Region names are the same, "star-side" and "star-top", so the whole star stays one painted color. The pawn has the same pawnY and cut, with pawnX 0 and no tilt. The side view is untouched: the new code only adds a type import, the new functions placed before the RiderDraft, and the views field.

**Back view (walking up):** the point nearest us sits low in the middle. Two side points stick out left and right of the pawn, and the two far points show beside its shoulders.
- Idle (12 × 170 ms): the side's slow 2.5-unit bob, with the shadow shrinking as the star rises. No sparks.
- Move (8 × 70 ms): the side's 2-unit bob, once per square. The star dips toward the way it goes: it pitches about 3° round the pawn's seat, so the far side drops (the squash goes to 0.66) and the pawn doesn't move. A small sparkler fizz comes from the near point. It pops one spark per frame, with the same spark colors and timing as the side's, and each spark flies a few units toward us and fades over 3 frames. A hot spot at the point flickers. Nothing is left behind.

**Front view (walking down):** the same star. Its near point faces us below the pawn, and the far points show beside the pawn's shoulders.
- Idle: the same bob, no sparks.
- Move: the same bob and timing. This time the near side dips (the squash goes to 0.745). The fizz comes from behind the pawn: the two far points take turns, one new spark per frame, each flying up and outward beside the pawn's shoulders. They're drawn behind the pawn, so it can hide part of them.

Choices you might want to change:
- **Front and back look the same at rest.** Both have a point facing us, as the brief asked, and the star is symmetric. Only the pawn (front or back) and the fizz tell them apart. If you want them to differ at rest, the front could turn a far point to face away instead (a ROT of +90).
- **The front's fizz comes from both far points, taking turns.** With this turn there isn't one single far point. It could come from just one far point instead.
- **The sparks are smaller than the side's** (1.9–2.0× the spark size against the side's 2.4×). They show at town size but they're subtle.
- **The dip is subtle.** It's a squash change of about ±0.04. It could be made stronger.
