# Birdie's fall, fourth pass: a happy free fall, not a scared tumble

**Your drawing already exists:** `scripts/boss-art/out/arena-birdie-fall-fun/arena-birdie-fall-fun.ts` is the approved third pass of Birdie's
fall (Eric: "looks good now"), copied as your starting file. Read it first, in line ranges. Change **only Birdie himself** (his body, wings,
tie, face, and his cap) in the two animations `fall` and `approach`. Keep everything else exactly as it is: the sky, the clouds, the speed
lines and wind streaks, the track, the train and its headlights, the frame counts and timings, the ids, the cues, the palette, the canvas
size (200 x 260, every pixel filled), and the last frame of `approach` where the train's nose is on him with the lamps flaring (the hit stays
the same). Write in parts of at most about 250 lines per call.

**Reference pictures** (this run's refs folder): `fall-now.png` and `approach-now.png` (the third pass's frames: what to keep), and
`birdie-joy.png` (his `victory` pose in the game: his happy eye, his wings up; match his look).

## What Eric said (Nov 23, his words)
"We need to change the birdie falling animation, I guess it's too morbid that he gets 'hit' by it. Instead have his tumble from his train be
a hop out of it and then him free falling but looking like he's having fun instead of dead. The getting hit effect can be the same tho."

## Birdie's new pose (both animations)
- **Free falling for fun, like a happy skydiver:** belly toward us or three-quarter, **wings spread wide** (not flung up in panic), his
  feet tucked or kicked out playfully, his **tie streaming up** behind him in the wind.
- **His face happy:** the eye a **happy curve** (his `joy` lid, as in `birdie-joy.png`), the beak open in a grin or a whoop, never wide-eyed
  or scared. No sweat drops, no dizzy marks.
- **His cap:** he holds it on with one wing tip, or it flies just above him and he's reaching for it with a grin (your call, recorded).
- A little life across the `fall` loop: a slight bob or a wing tilt (a glide), so it reads as enjoying it. Keep the loop seamless (frame 0
  of `approach` still matches frame 0 of `fall`).
- In `approach` he keeps the happy pose as the train comes up under him; in its last frame the nose is on him as before.
- Same outline (`k`), same colors as his body now (his brown, buff breast, his tie), same size on the canvas.

## Rules you must keep
- Draw only Birdie and his cap new. Never letters or numbers. Nothing real.
- The ids `arena-birdie-fall-fun`, the animations `fall` (loop, 5 x 120 ms) and `approach` (once, 9 x 390 ms, holds).

## Looks, then done
Render `fall` (all 5) and `approach` (all 9), and a 3x close-up of his face and wings in `fall` frame 0. **Before calling done, check:** his
face reads happy at 1x, his wings spread, nothing else in the picture changed (compare with `fall-now.png` and `approach-now.png`). Notes:
what you changed, your cap call, and each frame's pose in one line.
