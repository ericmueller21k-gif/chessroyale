# Boss art (rider): smudgy-brush

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 5 renders.
- Spend: **$0.97** of the $6 cap (24 input, 53,143 cache-write, 286,855 cache-read, 32,429 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/smudgy-brush/smudgy-brush.tsx.
- Previews: scripts/boss-art/out/smudgy-brush/preview/idle.png, scripts/boss-art/out/smudgy-brush/preview/move.png, scripts/boss-art/out/smudgy-brush/preview/look.png. Each look it took: scripts/boss-art/out/smudgy-brush/looks/.

## Its notes

Brush Ride (smudgy-brush) is finished. It's a mythic ride: a giant paintbrush flown like a broom.

**What it is:** a long wooden handle with a highlight stripe and a hang-hole at the end, a silver ferrule with crimp lines, and fat straw bristles behind it on the left. The bristles are dipped in a big goopy blob of paint with a drip hanging off. The pawn sits a little right of centre on a stuffed painter's-rag cushion. The cushion is cream with red, blue and yellow dabs, a nod to Smudgy's apron, and it's tied to the handle with plum cords, a nod to his beret. A small wooden palette with four paint dabs hangs from plum cords near the handle's end as the step. A soft shadow sits on the ground underneath. The pawn is lifted 8 and hidden below line 68 of its square (`cut` 68), so its bottom edge tucks behind the cushion.

**Painted part (the item's color):** the paint on the bristles and their fixed drip, the drip that swells and falls, the drop and splat, the drop flung off in the move, and the paint stroke left in the air. The handle, ferrule, cushion, ties and palette keep fixed colors. The paint reads in all nine color schemes, though Midnight paint is dark on dark.

**Idle** (12 frames × 180 ms, about 2.2 s):
- The ride bobs up 3 units and back with a 1° rocking sway, and the palette swings gently.
- A drip under the paint swells over frames 0 to 6, stretching long.
- On frame 7 it lets go as a drop.
- On frame 8 it splats on the ground; on frame 9 the splat fades.
- A fresh stub of drip starts growing again.

**Move** (8 frames × 70 ms, dx 0 to 100 in steps of 12.5):
- Each square is a swoop: it dips down 7 and comes back up. The ride and pawn tilt nose-down 3.5° on the way down and nose-up on the way out.
- The bristles leave a tapered ribbon of paint behind them. It's worked out from where the bristle tips were over the last few frames, so it stays put in the air. The far half fades to 45%.
- On frame 1 the drip stretches back, then flies off as a drop that arcs down behind (frames 2 to 4). It splats on frame 5 and fades on frame 6.
- The last frame leads straight into the next square's first, and the stroke carries over between squares.

**Choices you might want to change:**
- **The swoop's seam:** the tilt snaps from nose-up back to nose-down at each new square, so a long walk looks like a row of bouncy skips rather than one smooth glide.
- **Size:** it spans about x -34 to 108 (its box is [-34, 8, 144, 92]), so the bristles reach well left of the pawn's square.
- **Fixed colors:** the cushion is cream canvas rather than plum, to keep the ride light under a white pawn. Plum only shows on the ties and cords.
- **Timing:** the move is 560 ms per square. If the town's step is a different length, change the frame lengths.
- **Drip timing:** the idle drip falls once per loop, about every 2.2 s. That may be more often than "now and then".
