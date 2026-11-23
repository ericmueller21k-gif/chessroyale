# Birdie's cutscene: the train and the track redrawn (second pass, Nov 23)

Eric's notes on the first pass (round 3): the train was too short (it looked like a limo, not a train), and the track's scale and perspective were off. The sky, the rain, the wind lines, Birdie's tumble and the timing stay as they were. This pass changes only the train and the track in `approach`.

Drawn by the paid art runner (arena mode, the Moo format: 200 x 260, shown 3x on a computer and 2x on a phone). Opus 5.5, effort high.

## Spend (API, Claude)
- This pass (`arena-birdie-fall`, second run): $2.68 of the $6 cap (16 turns, 10 renders). The run finished with `done`.
- Armored Birdie was not redrawn; the reveal and hold are the drawings already on `claude/boss-art`.
- Total for this pass: $2.68 of the $6 Eric approved. Plan usage: none for the drawing. The stills and checks ran locally, with no API calls.

## Files
- `arena-birdie-fall-approach-sheet.png`: every frame of `approach` (9 frames at 390 ms, 200 x 260 each, 1x). Row 1 is frames 0 to 4, row 2 is frames 5 to 8.
- `arena-birdie-fall-approach.gif`: `approach` on its own, at 2x (400 x 520).
- `birdie-cutscene.gif`: the whole cutscene in order at 2x, about 6.5 s: fall (one loop, 5 x 120 ms), approach (9 x 390 ms), a white frame (250 ms, the game draws the flash), reveal (6 x 200 ms), hold (3 x 300 ms). The reveal and hold timings are the Armored drawing's own (the round-3 note said about 1.2 s for the hold; its drawing has 3 frames at 300 ms, which is 0.9 s).

## Checks
- `fall` is pixel-identical to the first pass: all 5 frames, zero differing pixels (rendered and compared).
- Approach frame 0 differs from the first pass only in the bottom band (y 218 to 259), where the track and the far train are. The sky and Birdie match above it.
- Headlights: keys `W` (near) and `V` (far), both `#fff3b8`, as round shapes, so the game can add its glow over them. They grow brighter each frame.
- The last frame's train: a raised cab with a windscreen, a long hood with side vents and handrails, the dark roof, the red stripe along the whole length, a pilot, and wheel trucks on the rails. The rails converge to the horizon and the sleepers shrink with distance.

## Runner notes
- The runner's automatic preview failed again (the preview script needs an `idle` animation; this drawing has none, by design). The sheet and GIFs were rendered from `fall` and `approach` directly (`renderFrame` in `packages/app/src/characters/sprite.ts`). The drawing is untouched.
- Its own notes (in `summary.md`, on `claude/boss-art`) name the camera height, how far Birdie sinks, the speed-line speed and the hood length as the easy things to change.
- The drawing is committed on `claude/boss-art` (commit `07b1d04`).
