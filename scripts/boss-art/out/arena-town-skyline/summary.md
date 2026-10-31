# Boss art: arena-town-skyline

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 2 renders.
- Spend: **$0.30** of the $3 cap (10 input, 24,149 cache-write, 41,621 cache-read, 8,437 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-town-skyline/arena-town-skyline.ts.
- Previews: scripts/boss-art/out/arena-town-skyline/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-town-skyline/looks/.

## Its notes

I've drawn `arena-town-skyline` (export `ARENA_TOWN_SKYLINE`). It's a 112 x 32 frame on a transparent background, made for 3x on the right side of the Chess Town button, or 2x across it. I rendered it on the dark and light backgrounds at 4x, 3x and phone size, and it reads well on both.

**What's in it, left to right:** a round tree, a cream house with a red-brown roof, and a stone church tower with a teal spire and a plain gold cross. A small red-roofed hall sits behind the tower. In the middle is the tallest building, a stone chess rook with three battlements, brickwork, two windows, a door and a red flag. After it come a teal-roofed house, a navy lamppost with a gold lamp, a small red house with a chimney, and another tree. A cobbled ground strip runs along the bottom. Everything has the dark `k` outline and the light comes from the top left. I used a very faint white halo so it still reads on the navy panel.

**The `idle` animation** has 6 frames at 300 ms each and loops. The flag waves by one pixel each frame. Two windows always stay lit, and the other four groups of windows turn on one by one: frames 1 to 4 light up groups 1, then 2, then 3, then 4. Frames 5 and 6 turn groups 1 and 2 back off, then it starts again. Off windows are a dusky violet (`#3b3550`) and lit ones are the game's gold.

**Things you might want to change:**
- The flag's wave is subtle at 2x.
- The halo is very faint (`#f7f4ee22`).
- The flag is red. It could be gold to match the cross.
- The church tower is plain stone, so the rook is the only crenellated tower and stays the clear focus.
- The windows only go between dark and lit, with no in-between shade.
- The window groups are keyed `1` to `4` in the palette. Each frame's palette override sets them on or off, so the timing is easy to change.
