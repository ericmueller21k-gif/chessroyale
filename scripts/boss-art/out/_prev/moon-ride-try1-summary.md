# Boss art (rider): moon-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 24 turns, 17 renders.
- Spend: **$1.89** of the $6 cap (50 input, 102,129 cache-write, 1,317,158 cache-read, 55,660 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/moon-ride/moon-ride.tsx.
- Previews: scripts/boss-art/out/moon-ride/preview/idle.png, scripts/boss-art/out/moon-ride/preview/move.png, scripts/boss-art/out/moon-ride/preview/look.png. Each look it took: scripts/boss-art/out/moon-ride/looks/.

## Its notes

Moon's Ride (moon-ride, mythic): "Moo's best friend floats you anywhere, fast asleep. Please don't wake it mid-flight."

What it is: a crescent moon lying flat and level like a flying board, floating with a soft shadow under it. Its tips are thin and pointed, left and right (front tip on our right), and it's thick in the middle. The camera looks down on it a little, so you see its top (a lighter, squashed crescent the pawn sits on) and, under the near edge, its thick front side. The sleepy face is on that side, a little toward the front tip: a closed, curved eye with a lash, a small smile and a pink blush, in fixed dark colours. The moon takes the item's colour: its top is a lighter tint with highlight strokes along the far edge, the underside has a darker band, and it has a few soft craters. The pawn sits upright on top with its whole base showing; only its very bottom is hidden behind the near edge (pawnY -13.5, cut 88).

Width: the moon runs from about x -12 to 112 counting outlines, about 124 units. Idle stars stay between about x -10 and 111.5, so the ride is within the 1.25-square limit. In the move, the trail reaches back to about x -35.

Idle (8 frames × 260 ms, 2.08 s loop): a slow float that rises about 3 units and settles. The shadow stays on the ground and gets smaller and fainter as the moon rises. Six four-point stars around the ride twinkle in turn (each grows, shines and fades), so one or two are bright at any moment.

Move (6 frames × 90 ms, dx 0, 17, 34, 50, 67, 84, so the next square starts at 100): it glides with a small lift. The nose dips about 4° by the middle of the square, then levels out to about 1°, and the pawn tilts with the moon round the same point. A short trail behind it has two light streaks and three small stars that drift back, shrink and fade. The last frame leads into the first.

Choices you might want to change:
- I drew the crescent with its horns pointing a little away from us, so the top shows as a squashed crescent and the pawn sits clearly on it. It does make a gentle bowl shape from the side. In the yellow colour that can look a bit like a banana boat. I tried a flat, saucer-like moon and an arch with the horns pointing down; neither looked like a moon.
- On very dark colours (midnight), the dark face lines get a pale edge so the face still shows.
- I only drew the side view. The brief didn't ask for front or back views.
- The move timing (540 ms per square) and the idle loop (2.08 s) are guesses and easy to change.
