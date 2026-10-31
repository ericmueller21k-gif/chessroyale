# Boss art: arena-auto-card

- Model claude-opus-5-5, effort medium, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.37** of the $3 cap (16 input, 26,944 cache-write, 111,991 cache-read, 10,501 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-auto-card/arena-auto-card.ts.
- Previews: scripts/boss-art/out/arena-auto-card/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-auto-card/looks/.

## Its notes

The Auto chess card picture is done: a 32 x 32 frame with a transparent background, meant for 2x in the 64 px square. I checked it on both the dark and light backgrounds and at small size. The very last change, making the dust a little darker, wasn't rendered again afterwards.

What's in it (from back to front):
- A rook on the left, carrying a red pennant on a gold pole that leans forward. The pennant streams backwards.
- A pawn in the middle, partly hidden behind the other two (its head and base show).
- A white knight in front, facing right, with two gold stars above it.
- Little dust puffs behind the feet at the lower left.
The pieces use the chess whites M/m/o, light from the top left, with a dark `k` outline and a faint white halo so they show up on the navy panel. There are no letters or numbers.

**Idle animation:** 4 frames at 200 ms each (0.8 s loop).
- Each piece bobs up 1 px for two frames, and the three are offset by one frame each (knight, then pawn, then rook), so they march in place one after another.
- The two stars take turns: one is big and the other small, then they swap, which reads as a twinkle.
- The pennant flaps between two shapes.
- The dust puffs drift left and change size.
- Frames 0 and 2 carry a "step" cue, which you can ignore if sound isn't used here.

**Choices you might change:**
- The pennant is red (`#d24a3c` / `#8e2a26`), a new color that isn't in the game's palette. It could be gold or navy instead, but navy would disappear on the dark panel.
- The pawn is mostly hidden. Spreading the pieces out would show more of it, but they'd have to be drawn smaller.
- The dust colors (`d` / `D`) are new tans and are faint on the light panel.
- The rest of the colors are the game's: gold Y/y/O, the whites M/m/o and the outline `k`.
