# Boss art: arena-pieces

- Model claude-opus-5-5, effort medium, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.49** of the $4 cap (18 input, 34,393 cache-write, 159,404 cache-read, 14,324 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-pieces/arena-pieces.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/arena-pieces/looks/.

## Its notes

The twelve chess pieces are drawn in `ARENA_PIECES` (id "arena-pieces"), exported from scripts/boss-art/out/arena-pieces/arena-pieces.ts. I checked all twelve side by side on both the dark and light backgrounds.

- **Frame and foot:** each piece is 32 x 56 with its foot at (16, 55). The bottom row of the base is at y 54 and the outline sits at y 55. Every piece is centred on x 16, except the knight's muzzle, which reaches out to the left.
- **Animations:** twelve, one frame each: `wk wq wr wb wn wp bk bq br bb bn bp`. None of them repeat as tiles, and there are no exported points.
- **Heights, base to top:** king 52, queen 46, bishop 40, knight 36, rook 32, pawn 26. All share a base 22 px wide.
- **How it's built:**
  - Each piece is a function that builds a mask: a shared base, then rings, tapers and balls for the rest of the shape. The knight's head is a hand-drawn grid.
  - One colouring function shades every mask in bands: lit on the left and top edges, shade on the right and undersides.
  - White and black use exactly the same masks and differ only in colour. White is marble (`M m o`, with `q` for dark details). Black is slate (`c #666d8a` lit, `b #3d4152` mid, `a #2b2d3a` shade, `v` for details).
  - Gold (`y Y O`) is on the base ring and the collar of every piece. The king and queen have a second gold ring, and gold also covers the king's cross, the queen's crown band and points with their ball, the bishop's knob and the band near the rook's top.
  - The palette also includes the Colosseum's stone, opening and navy keys, so all the arena pieces share their colours.
- **Shapes:** the king has a cross on a small dome, the queen a crown of five points with a ball on top, and the rook three battlements. The bishop has a mitre with a diagonal slit and a gold knob. The knight's head faces left with ears, an eye, a nostril and a dark groove marking the mane. The pawn has a ball on a collar.

**Choices you might want to change:**
- The top of the base is a lit band meant to suggest the ellipse seen from a little above. It reads only faintly.
- The knight's mane is a dark groove, not gold.
- There's no halo.
- On the black bishop the slit is quite subtle.
