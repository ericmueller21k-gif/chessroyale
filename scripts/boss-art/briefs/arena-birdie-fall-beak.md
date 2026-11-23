# Birdie's happy fall, beak fix: an open beak you can see through, not a red mouth

**Your drawing already exists:** `scripts/boss-art/out/arena-birdie-fall-beak/arena-birdie-fall-beak.ts` is the approved happy fall
(`arena-birdie-fall-fun`), copied as your starting file. Read it first, in line ranges. Change **only his beak** in `fall` (all 5 frames)
and `approach` (all 9 frames). Everything else stays exactly as it is: his body, wings, eye, tie, feet, cap, the sky, lines, track, train,
the frame counts and timings, the ids, the cues, the palette, the canvas. Write in parts of at most about 250 lines per call.

**Reference pictures** (this run's refs folder): `fall-fun-now.png` (the current `fall` frame 0 at 3x, the beak to fix) and
`birdie-beak.png` (his boss sprite's head at 4x with its beak open, from his `victory` or `capture` pose: how his open beak looks).

## What Eric said (Nov 23, his words)
"His mouth is all [messed up] in the free fall, leave it open but shouldn't be red like that, should be able to see through it like a
normal open beak."

## The beak
- Still **open** (a happy whoop), but drawn as **a normal bird's open beak**: two beak halves, upper and lower, in his beak's own dark
  grey-brown (the colors his beak uses now, and as in `birdie-beak.png`), with a **gap between them where the sky behind shows through**
  (the background colors of that spot, not a filled mouth).
- **No red or pink mouth interior**, no tongue, no filled dark hole. A one-pixel outline (`k`) round each half, as the rest of him.
- The same size and place on his head as now, pointing the same way.
- The same beak in every frame of `fall` and `approach` (it may open a pixel wider or narrower across the loop, never closed).

## Rules you must keep
- Draw only the beak new. Never letters or numbers. Nothing real.
- The ids `arena-birdie-fall-beak`, the animations `fall` (loop, 5 x 120 ms) and `approach` (once, 9 x 390 ms, holds).

## Looks, then done
Render `fall` (all 5) and a close-up of his head in `fall` frame 0. **Before calling done, check** at 1x and 2x: the beak reads as an open
bird's beak with sky between its halves, no red; nothing else changed (compare with `fall-fun-now.png`). Notes: what you changed, the
beak's pixels and colors.
