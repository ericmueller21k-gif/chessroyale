# Boss art: arena-pieces-2

- Model claude-opus-5-5, effort medium, adaptive thinking. 6 turns, 3 renders.
- Spend: **$0.23** of the $3.5 cap (14 input, 16,698 cache-write, 49,419 cache-read, 6,702 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-pieces-2/arena-pieces-2.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/arena-pieces-2/looks/.

## Its notes

I redrew the queen, white and black, so it no longer looks like the rook. Everything else is copied unchanged from arena-pieces: the frame is 32 x 56 with the foot at (16, 55), there are twelve single-frame stills (wk wq wr wb wn wp, bk bq br bb bn bp), the palette and the other five pieces are the same, nothing repeats and there are no exported points. The export is `ARENA_PIECES_2`, with id "arena-pieces-2".

I checked all twelve with `anim: "*"` on the dark background (at 3x and 2x) and on the light one. On the light one I put the queen beside the rook at 4x. The phone-size strip only shows the white king, so I judged the queen at small size from the 2x render, where it is clearly not the rook.

The new queen, from the bottom up:
- **Body:** a slim, waisted body on the shared plinth, then a gold collar and a narrow neck.
- **Crown:** the neck flares into a cup with a gold band, a row of dark inside showing the crown is open, and five tall sharp points that fan outward, gold on their upper half.
- **Top:** a small gold ball in the middle. It is about 46 px tall, roughly 6 px taller than the bishop. There are no flat battlements anywhere.

**Things you might want to change:**
- The gold covers about the top half of each point, and the right-hand tips use the darker gold shade, following the existing shading rule.
- The crown is wider than the plinth's top, about 20 px at the tips, so the queen's silhouette is a little wider than the king's.
