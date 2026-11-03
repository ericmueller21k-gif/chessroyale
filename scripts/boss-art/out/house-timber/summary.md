# Boss art: house-timber

- Model claude-opus-5-5, effort high, adaptive thinking. 22 turns, 14 renders.
- Spend: **$1.71** of the $5 cap (48 input, 102,700 cache-write, 1,423,496 cache-read, 45,557 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-timber/house-timber.ts.
- Previews: scripts/boss-art/out/house-timber/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-timber/looks/.

## Its notes

I've drawn Timber's Lumber Lodge with its idle, and checked it at 3x to 7x on both backgrounds and at phone size beside the gardener, tiger and alfil homes. No render warnings remain. I haven't loaded it into the game or the town square itself.

SIZE, FOOT AND FOOTPRINT
- Frame: 144 x 134, the same width as the others and within the 120-150 height range. The extra height over the tiger and gardener (120, 124) is room for the chimney smoke.
- Foot: (70, 128), centred like the tiger's (70) and near the gardener's (72).
- Footprint: a 3 x 3 plot. The ground shadow is centred at x 72 with a 70-pixel half-width, like the tiger's and gardener's.
- Weight: at phone size it looks about as heavy as the tiger and gardener homes. It's much smaller than the alfil pyramid, which is drawn half again as big on purpose.

THE BUILDING
- Walls: a cabin of log courses with dark chinking between them, lit from the top left. The logs' round cut ends stick out at both corners, alternating in and out each course, on a footing of rounded stones.
- Roof: rough wooden shingles in staggered rows, each hanging a slightly different length so the eave is ragged. The side edges are planks and the ridge is a log with cut ends.
- Chimney: stone, on the left slope.
- Beaver touch: a lodge-style heap of crossed sticks on the right side of the roof, some poking out past its edge.
- Door: plank door with iron straps and rivets, a little open, in log posts under a log lintel, with a stone step. Firelight shows through the gap.
- Window: one small window with warm glass and a cross of muntins, on the right.

TIMBER'S COLORS AND THE LUMBER
- His orange hard hat hangs on a peg left of the door.
- A tall stack of sawn planks on two bearers sits on the left, tied with rope in his tool-belt yellow.
- A log pile (three, two, one) sits on the right, with a sawhorse in front of it that the logs show through.
- A chopping stump stands right of the door, with an axe in it whose handle is his hammer's red.
- Shavings and chips lie on the ground.
- The walls and sticks use his fur browns, and the planks use his plank woods.

THE SIGN
A blank rough plank board on two log posts at the front left, made with the kit's signBoard and signPost.

IDLE (6 frames x 220 ms, loops)
1. Smoke: three puffs rise from the chimney, drifting right, swelling and thinning out at the top.
2. Firelight: the door's glow and the window flicker through small color changes each frame.
3. Chips: two wood chips tumble down past the plank stack, a few frames apart.
Nothing else moves.

EXPORTS
- HOUSE_TIMBER (id house-timber, name "Timber's Lumber Lodge").
- HOUSE_TIMBER_SIGN, from signFace with the board at (6, 102), 50 x 22.
- HOUSE_TIMBER_LIGHTS: the door's inside (flickering, strength 0.8) and the window glass (0.6), both in WARM.
- HOUSE_TIMBER_POOLS: a warm pool in front of the door.

CHOICES YOU MIGHT WANT TO CHANGE
- Sign placement: the sign hides the lower half of the plank stack (only its top and ropes show). To swap sides, the log pile would end up hidden instead.
- Roof color: the shingles use new weathered-wood browns of mine rather than his palette. At big zoom they still look a little like slate tiles.
- Stick heap: it's built from a fixed random pattern, so its outline is lumpy and fairly flat-topped.
- Chips: they're single pixels and very subtle at phone size.
- Smoke: with three puffs over six frames, the pattern visibly repeats every two frames, as a steady, calm rise.
