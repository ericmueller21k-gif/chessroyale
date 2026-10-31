# Boss art: arena-wall

- Model claude-opus-5-5, effort medium, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.29** of the $2 cap (18 input, 25,587 cache-write, 126,338 cache-read, 6,660 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-wall/arena-wall.ts.
- Previews: scripts/boss-art/out/arena-wall/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-wall/looks/.

## Its notes

The `arena-wall` piece is finished: a 64 × 64 slice of the podium wall with one arch, in a single-frame `idle`. I checked it at 4× and 6× on both backgrounds and repeated side by side with `tile: "x"`. The repeat joins with no visible seam.

**What's drawn, top to bottom:**
- **Coping (rows 0–5):** an outline row on top, then lit, mid and shadowed bands, with a dark shadow line where it overhangs.
- **Blocks (rows 6–53):** courses 7 px tall with a mortar row, blocks 16 px wide, every other course shifted 8 px. Each block is lit on its top and left edges, shaded on its bottom and right, with sparse grain.
- **Arch:** centred on x = 32. The opening is 20 px wide from rows 28 to 62. With the ring of wedge stones it measures about 30 wide × 39 tall, a little over the brief's 26 × 36. The opening is outlined in `k`: mostly `z`, with an `x` band for the lit right side and the passage floor. Seven wedge stones are split by dark joints, the upper-left ones lit and a pale keystone at the top. A small ledge (lit on the left) sits where the arch springs, at rows 38–39.
- **Plinth (rows 54–62):** a darker base course with a lit top row, joints every 32 px and a shadow row at the bottom. Row 63 is the outline.

**Anchor:** the foot is set at (32, 63), the bottom edge. The seats (`arena-stands`) sit on the top edge, row 0.

**How it repeats:** it's drawn as one part with no outline and no halo, so nothing gets drawn across the left and right edges. It only uses the coliseum palette keys `1`–`6`, `x`, `z` and `k`. The navy, gold and marble keys are in the palette but not used. There are no exported points.

**Choices you might want to change:**
- The arch's outer size is about 30 × 39 rather than 26 × 36, and the opening runs down through the plinth to the floor.
- There are no banners or torches on this piece. They could be added as separate pieces.
