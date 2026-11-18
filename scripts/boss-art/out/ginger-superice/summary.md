# Boss art: ginger-superice

- Model claude-opus-5-5, effort high, adaptive thinking. 22 turns, 15 renders.
- Spend: **$1.75** of the $6 cap (48 input, 96,924 cache-write, 1,468,435 cache-read, 48,384 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/ginger-superice/ginger-superice.ts.
- Previews: scripts/boss-art/out/ginger-superice/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/ginger-superice/looks/.

## Its notes

`SUPER_ICE` (id "ginger-superice", w 96, h 96, foot [48, 95]) is drawn: `grow`, `hold`, `settle` and `idle`. I rendered all three main animations on dark and light backgrounds, mostly at 3x to fit five frames in a picture (grow's end and first frames at 4x). At phone size it reads as one big block of cracked ice. I couldn't put real pieces under it, so how well a piece reads through is judged from the alpha values, not seen.

The full block's outline sits at x and y 2..93. The ice body uses the see-through `a` / `A` / `q` and a new `B`, all at alpha 0.35 to 0.45. Rims, cracks and frost are opaque.

**`grow`** (19 frames, 1520 ms):
1. Frame 0, 80 ms: a white and pale-blue starburst on the middle square, sparkles flying out. `cue: "burst"`, `shake: [0, 1]`.
2. Frames 1–2, 70 + 70 ms: the burst flies further out while frost creeps in from the middle square's edges.
3. Frame 3, 80 ms: the middle block closes, still pale. The middle square is whole here (220 ms).
4. Frame 4, 80 ms: its rims flash white, two sparkles.
5. Frames 5–7, 70 ms each: the four side squares grow together from the middle square's edges, each front a white rim with frost ahead of it.
6. Frame 8, 90 ms: the side squares are whole (590 ms). The joins flash white as they fuse and the first cracks star out from the middle. `cue: "crackle"`.
7. Frame 9, 80 ms: fused, no seams left.
8. Frames 10–13, 70 ms each: the four corners spread diagonally from their inner corners.
9. Frame 14, 90 ms: the corners are whole (1040 ms). A white grid flashes along the joins, frost crystals appear in the four corners, the corners twinkle. `cue: "crackle"`, `shake: [0, 1]`.
10. Frame 15, 80 ms: the cracks run out from the middle to the edges, glinting.
11. Frame 16, 80 ms: a white flash over the whole block.
12. Frame 17, 90 ms: the flash half gone.
13. Frame 18, 140 ms: settled. The same frame as `hold`'s first.

**`hold`** (loops, 8 frames, 1500 ms, no cue): two frames at rest (220 ms each, the second with two corner twinkles), a glint running out along the cracks (200 ms), a white glint sweeping corner to corner over four frames (160 ms each, twinkles at the end), then rest (220 ms).

**`settle`** (6 frames, 440 ms): the lines between the squares flash white (60 ms); the block breaks into nine rounded blocks and sparks fly where the lines meet (70 ms); the nine blocks fade to 75%, 50% and 22% (80 + 80 + 90 ms); empty (60 ms).

**`idle`**: one frame, `hold`'s first.

**`SUPER_ICE_STEPS`** = `[1040, 590, 1040, 590, 220, 590, 1040, 590, 1040]`, worked out from the same frame-length list `grow` uses, so they can't drift apart.

**Palette:** a copy of `ICE_PALETTE` plus two keys:
- `B` `#4a9de466`: a deeper see-through blue for facets (alpha 0.4).
- `C` `#174a7e`: the dark core of the main cracks. Where a crack crosses the middle of a square it's drawn in the normal `c` instead.

**Choices you might want to change:**
- The four side squares grow at once, not one after another.
- In the first growth frame the side ice is narrower than the middle square, so the ice looks briefly round before it becomes a plus shape.
- Pieces on the darker shards (right side, bottom) sit under alpha 0.4–0.45 ice rather than 0.35.
- There's no faint fault line between squares once the block is whole.
- `settle` has no cue. A "crackle" on its first frame would suit the breaking if you want a sound there.
- The nine pieces in `settle` sit 3 px inside each square, where today's one-piece ice sits 2 px in, so there's a 1 px jump when the game's small ice takes over.
