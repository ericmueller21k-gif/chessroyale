# Birdie's cutscene: the locomotive's nose and the head-on hit (third pass, Nov 23)

Eric's notes on the second pass: "The front of the train is too blocky now. It doesn't even look like a real head of how a train looks. And it also should be actually looking like it hits him. It's to the side of him."

This pass changes only the train's front and the way it meets Birdie in `approach`. The sky, the rain and wind lines, Birdie's tumble, the cap, the frame counts and timings, the train's length and colors, the ids and the export are kept as drawn.

Drawn by the paid art runner (arena mode, the Moo format: 200 x 260). Opus 5.5, effort high. Brief: `scripts/boss-art/briefs/arena-birdie-fall-3.md` on `claude/boss-art`.

## What changed
- **The nose:** a rounded, sloping front with the cab's two-pane windscreen set back up high and the headlights `W` and `V` (round, `#fff3b8`) in the nose, with a pilot at the bottom. The red stripe sweeps round the nose.
- **The hit:** the camera looks straight down the track. The rails run up the middle of the frame to a vanishing point at the center. The train comes straight at the camera along them, centered. Birdie falls straight down into its path, and in the last frame the nose meets him dead center, right in front of the headlights.

## Spend (API, Claude)
- This pass: **$1.76 of the $6 cap** (25 turns, 15 renders). The run finished with `done`.
- A first launch failed before any API call (the `tsx` tool wasn't installed in the checkout; `npm install` added the declared packages). That attempt cost $0.
- Total for this pass: $1.76 of the $6 Eric approved. Plan usage: none for the drawing.

## Files
- `arena-birdie-fall-approach-sheet.png`: every frame of `approach` (9 frames at 390 ms, 200 x 260 each, 1x). Row 1 is frames 0 to 4, row 2 is frames 5 to 8.
- `arena-birdie-fall-approach.gif`: `approach` on its own, at 2x (400 x 520).
- `birdie-cutscene.gif`: the whole cutscene in order at 2x, about 6.5 s: fall (one loop, 5 x 120 ms), approach (9 x 390 ms), a white frame (250 ms, the game draws the flash), reveal (6 x 200 ms), hold (3 x 300 ms). Same name and content as the `stills/birdie-5` cutscene, redrawn with this pass.

## Checks
- Looked at the approach sheet: the train is centered on the rails from the first far frames, and in frame 8 the nose sits under Birdie's center (his x and the nose's x are both about 100).
- The runner's own preview step failed (the same `preview-characters.ts` error as the second pass; an arena piece has no `idle` animation by design). The sheet and GIFs were rendered locally from `renderFrame` (`packages/app/src/characters/sprite.ts`) by a one-off script that isn't committed. The drawing itself is untouched by it.
- `npx tsc -p scripts/boss-art --noEmit` reports three errors, all in `smudgy-stills.ts` (missing `smudgy` modules), none in the Birdie drawing.
- Not checked at scale 4: the runner couldn't render at other scales in its run, so the headlights and the rivets are checked from the 2x GIF only.

## For Eric to look at
- The nose reads as a rounded front with headlights and a pilot. It's closer to a rounded capsule than a classic bulldog nose. If it still looks too simple on a phone, the nose's size and the windscreen's height are the two numbers to change.
- In frame 7 the right headlight is hidden behind Birdie's tail. The lamp's position (`LAMP_X`, `LAMP_Y`) is one number to change.
- How close the train gets (`Z_NEAR`), the camera's height (`CH`) and the vanishing point's place (`OX`) are the other easy numbers.
