# Boss art: arena-pieces-gba

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 9 renders.
- Spend: **$1.13** of the $5 cap (34 input, 55,818 cache-write, 526,853 cache-read, 37,366 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-pieces-gba/arena-pieces-gba.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.23.4
. Each look it took: scripts/boss-art/out/arena-pieces-gba/looks/.

## Its notes

I've drawn the rook and the knight, White and Black (4 stills), in scripts/boss-art/out/arena-pieces-gba/arena-pieces-gba.ts. I rendered all four on light and dark backgrounds at 8–12x and looked at the small 1x and 2x view (that view only shows the first still, the White rook). The rook reads clearly as a rook, the knight as a horse's head facing left, and White and Black are the same shape.

What's drawn
- Rook (19 px tall, 13 wide): three square battlements with see-through gaps. The two side ones are narrower than the middle one, as on a round tower seen from the front. Under them are a crown band and a dark line where the crown overhangs, then a straight tower lit on the left and shaded on the right.
- Knight (22 px tall): the head in profile facing left. It has a pointed ear, a stepped brow, a blunt muzzle with a mouth pixel, a flat jaw line and a narrowing throat. The eye is a dark pixel on White and gold on Black. A gold mane with three notched tufts runs down the back of the neck. The muzzle sticks out 7 px left of centre; the mane comes 7 px right of centre at its tufts.
- Shared stepped base: a gold collar ring, the upper step (its top row lit, its lower row shaded), the bright top edge of the lower step, a two-row gold band, and a rounded bottom.
- Finish: flat bands of 3–4 tones lit from the top left, an unbroken 1-pixel outline (k on White, K on Black), and nothing blended against the background. The pieces draw their own outline, so the game's automatic dark outline and faint glow are off.

The frame: 26 x 34, foot (anchor) at (13, 33), exported as ARENA_PIECES_GBA with id arena-pieces-gba. The four stills are wr, br, wn, bn.

Palette: the brief's keys and values exactly (W w c C, B b d, Y G g, k K). Each piece is drawn once using placeholder shade keys:
- O outline; 1–4 highlight, light, mid, shade
- TUV gold band; RSQ collar ring; MN mane; E eye
WHITE_KEYS and BLACK_KEYS swap those for each side. Black only has three tones, so its light and mid both become b and mid and shade both become d.

Choices you might want to change
- White's collar and mane are gold, like Black's. The brief allowed cream for White, but cream on cream made the mane look like shading. To change it, edit M, N (mane) and R, S, Q (collar) in WHITE_KEYS.
- Both pieces use a 13 px base. That makes them truly symmetric about x = 13; a 14 px base (which you suggested for the knight) can't centre on one pixel.
- On a dark background Black's outline almost disappears. That's fine on the tan board; if Black pieces ever need to stand on dark ground, they'd need a light rim.

Adding the other four (pawn, bishop, queen, king)
1. Write a top grid for the piece using the placeholder keys. Fill body rows with shadeRow(n), which gives the lit-left / shaded-right bands for any width.
2. Stamp it with compose() so it sits on row 24 or above, above base(w, neck), which goes at row 25 with its left edge at 13 - (w-1)/2. Use an odd w; neck is the body's inside width where it meets the collar.
3. Add it to PIECES under one letter (p, b, q, k). The loop then makes both colours' stills and names them automatically (wq, bq…).
The base is 9 rows tall, so each piece's height decides how many rows are left above it. The pawn's 12 px base is even and can't centre exactly on x = 13; use 11 or 13.
