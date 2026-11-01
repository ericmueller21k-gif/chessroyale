# Boss art (rider): log-roller

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 5 renders.
- Spend: **$0.60** of the $2 cap (26 input, 42,018 cache-write, 253,987 cache-read, 17,041 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/log-roller/log-roller.tsx.
- Previews: scripts/boss-art/out/log-roller/preview/idle.png, scripts/boss-art/out/log-roller/preview/move.png, scripts/boss-art/out/log-roller/preview/look.png. Each look it took: scripts/boss-art/out/log-roller/looks/.

## Its notes

The Log Roller is finished: the side view, its idle and its move, all checked frame by frame at 4x and at town size, in every color, on white and black pawns. The renders gave no warnings.

What it is: a fat log, 54 units across, seen end-on. It has a bark rim, a cream end face with off-centre rings, a crack from the heart and a branch stub sticking out of the bark. A thin strip of the log's top runs back above the end, and the pawn stands on it, its whole body showing. The item's color is a broad painted stripe across the end, running through the bark on both sides, so it turns with the log. The rings and bark stay wood-brown; I think the stripe reads better than painted rings would.

Idle (10 frames, about 1.6 s, loops):
1. It rests for a beat.
2. The log rocks forward about 7° and shifts a couple of units as it rolls. The pawn lags and leans back about 8°.
3. It recovers through upright.
4. A smaller rock back the other way (about −4°, the pawn leaning about +4°), then it settles.

Move (8 frames × 85 ms, dx 0 → 100):
- The log turns clockwise exactly once per square, 45° a frame, so the stripe, crack and stub visibly roll and each square's move leads straight into the next.
- The pawn takes quick balancing steps: lifts of about 2.5 units on frames 1 and 5, a tilt of ±5° each way and a small shuffle left and right.
- On frames 4 to 6 the log makes a small hop (up to 4 units) over its own branch stub.
- A puff of bark dust stays with the log at its back-bottom edge. Nothing is left on the ground.

Choices you might want to change:
- Height: with the pawn standing on top, its head reaches about y −24, well past the −9 limit for worn items. The render didn't flag it. If the avatar does clip rides at −9, the log needs to shrink (about 36 across).
- Roll speed: a true roll would turn about 212° per square. I used a full turn so the moves join up without a jump.
- The hop over the stub could be dropped for a smoother roll.
- On yellow and pearl the stripe is soft against the pale wood, though its outline keeps it readable.
- Not yet drawn: the front and back views and the trail (none were asked for).
