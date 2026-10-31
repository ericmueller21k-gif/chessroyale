# Boss art: arena-railing

- Model claude-opus-5-5, effort medium, adaptive thinking. 6 turns, 2 renders.
- Spend: **$0.20** of the $2 cap (14 input, 18,159 cache-write, 53,423 cache-read, 5,136 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-railing/arena-railing.ts.
- Previews: scripts/boss-art/out/arena-railing/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-railing/looks/.

## Its notes

I've drawn `arena-railing` and checked its single `idle` frame on dark and light backgrounds, tiled side by side. The tiled render shows no visible edge where copies meet.

**Size and anchor:** 128 × 32 pixels. The foot is at (64, 32), the middle of the bottom edge. Place the piece so its bottom edge is the bottom of the screen.

**How it repeats:** across. Everything is drawn on a 64 × 16 grid with each cell blown up to 2 × 2 pixels, so it reads chunky and close to the camera. The pattern repeats every 128 pixels, so copies placed side by side join cleanly.

**What's in it, from top to bottom:**
- **Top edge:** a dark `k` outline at y = 2–3. It dips 2 pixels in two places where the stone is worn, and everything above it is transparent.
- **Lit top:** about 10 pixels of travertine. It has a highlight row along the far edge, light grain, three worn patches, three small pits, and stone joints every 32 pixels (a dark groove with a lit edge to its right).
- **Rounded front edge:** two bands of colour (stone shades 3 then 4), with three chips knocked out of it.
- **Shadow line:** a dark band (stone shade 6) where the top overhangs the face.
- **Near face:** in shade, from y = 20 down and out of frame. It's split into blocks every 32 pixels, offset half a block from the top stones' joints, and darkens slightly at the very bottom.

I used only the colour keys from `coliseum.ts`, with no new ones. I added none of the navy, gold or marble from the palette either. The piece is drawn without the automatic per-part outline (`outline: false`), because the outline is painted into the picture by hand along the top edge. That way no outline shows up at the left and right edges, where it would break the repeat.

**Things you might want to change:**
- There's no halo around the outline.
- There are no exported points.
- The two worn dips in the top edge show up as small notches, which you may or may not like.
