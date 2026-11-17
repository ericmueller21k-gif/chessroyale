# Boss art: token-coin-small

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.52** of the $1.2 cap (18 input, 24,588 cache-write, 100,078 cache-read, 18,939 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-coin-small/token-coin-small.ts.
- Previews: scripts/boss-art/out/token-coin-small/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-coin-small/looks/.

## Its notes

I redrew the king on the 20 x 20 coin (token-coin-small.ts, TOKEN_COIN_SMALL). The coin and rim are unchanged. It now reads as a gold coin with a crown on light and dark backgrounds at scales 6, 3 and 12, and as a coin with a crown at phone size. I didn't look at the 1x view on its own; the phone-size thumbnail in each render was the only small-size check. One frame, idle, 1000 ms. No letters, no rivets, no halo (they muddied it at this size).

What changed in the king:
- **Cross:** now a clear plus. A pale vertical bar 3 tall (rows 3–5) crosses a 3-wide bar on row 4, all outlined in k. Its top sits on the inner ring, and its top outline pixel is one k in the rim. It stands on the knob.
- **Knob:** a 3 x 2 pale block under the cross, with k on each side.
- **Lobes:** rounded left and right shoulders 11 px wide, with their top corners cut. A k dip 2 rows deep separates each lobe from the knob, and a short k line runs down the middle under the knob, as on the 40 px coin.
- **Band:** a pale row, one dark line and a pale row, 9 px wide (narrower than the lobes), with a k line between lobes and band. Light from the top left comes from white top-left pixels on the cross, knob, lobes and band; the right side is a shade darker.

Things you may want to change:
- The king is 11 px wide (an odd width) inside an interior 12 px wide, so it sits half a pixel left of centre. That leaves no gold on the left beside the lobes and band, against one column on the right. A centred king would need the cross's bars to be 2 px wide.
- The lobes and the band's bottom row touch the inner ring, so there's less open gold than on the 40 px coin. I kept the king large because the brief wants it big and it needs to read at 20 px.
- The knob is short, so the cross and knob read together as "cross on a block". That's fine at this size, but it's the weakest part of the silhouette.

## Not used (Nov 17)

Two passes ($0.27 + $0.52). At 20 px its crown read as a box with a grimace; the 40 x 40 `token-coin` scaled down to 20 px read better, so the game uses that one everywhere.
