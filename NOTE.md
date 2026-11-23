# Birdie's ultimate cutscene: stills (round 3, Nov 23)

Two full-screen pictures, drawn by the paid art runner (arena mode, the Moo format: 200 x 260, shown 3x on a computer and 2x on a phone).

## Spend (API, Claude)
- Scene A, the fall (`arena-birdie-fall`): $2.64 of the $8 cap (21 turns, 12 renders).
- Scene B, Armored Birdie (`arena-birdie-armored`): $1.81 of the $8 cap (19 turns, 14 renders).
- Total: $4.45 of the $16 Eric approved. Plan usage: none.

## Files
- `birdie-cutscene.gif`: the whole cutscene in order at phone size (2x), about 6.8 s: fall (one loop, 0.6 s), approach (3.5 s), a white frame (0.25 s, the game draws the flash), reveal (1.2 s), hold (1.2 s).
- `arena-birdie-fall-sheet.png`: every frame of `fall` and `approach` (the frame sheet).
- `arena-birdie-fall-fall.gif`, `arena-birdie-fall-approach.gif`: each animation.
- `arena-birdie-armored-sheet.png`: every frame of `reveal` and `hold`.
- `arena-birdie-armored-reveal.gif`, `arena-birdie-armored-hold.gif`: each animation.

## Runner notes
- Both pictures finished with `done`. The render tool could only show frame strips at 1x, so both runs judged detail with a temporary extra frame at 2x (removed before finishing).
- The runner's automatic preview failed for both: the preview script needs an `idle` animation, and these pictures have none. The GIFs and sheets here were made from a scratch copy in which `idle` points at the first animation (`fall` for the fall, `reveal` for Armored). The drawings are untouched. Those scratch `idle` outputs are left out of this branch.
- Fall: Birdie sinks only to about y 112 (the brief said about y 140): at 140 he overlapped the cab and looked like he was riding the train. The runner notes its camera height and speed-line tuning as easy changes.
- Fall: 44 palette keys, more than the brief's 24 to 30, because the two palettes it used already come to about 37.
- Armored: about 50 keys, more than the brief's 30: his full face, cap and tie colors plus the night and steam colors. The runner notes a shorter or cut tail, a bigger head (10 to 15%) and brighter sparks as options.
- Headlights: keys `W` (near) and `V` (far), both `#fff3b8`, drawn as separate round shapes so the game can add its light glow.
- The drawings, summaries and logs are on `claude/boss-art` (commit b6d604fe7).
