# Boss art: token-coin

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 2 renders.
- Spend: **$0.47** of the $1.5 cap (20 input, 25,611 cache-write, 95,450 cache-read, 16,212 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-coin/token-coin.ts.
- Previews: scripts/boss-art/out/token-coin/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-coin/looks/.

## Its notes

The coin, `TOKEN_COIN` (id `token-coin`, name `Coin`), is a 40×40 drawing with one animation. I checked it at 8x and at the two small sizes on both backgrounds. At 20 px the crown still reads as a king's head and the coin as gold.

**Check this first:** I couldn't open `token-blitz.ts`, so I didn't copy its coin as the brief asked. I rebuilt the rim from the boss-token pictures using the brief's colors (`y #ffe08a` / `Y #f4b740` / `O #b97c10`, outline `k #2a1c14`). It's close to the tokens but probably not identical. The rivets are a guess: four small 2×2 studs at the top, bottom, left and right of the rim. If they differ from `token-blitz.ts`, paste its rim and rivet code into `coinGrid()`.

**Animation:**
- `idle`: one still frame, 1000 ms. It doesn't move.

**The drawing:**
- **Coin:** a gold disc drawn by code and lit from the top left. The rim is light on its outer edge, darker on the inside, and darkest at the bottom right. Inside it is a one-pixel dark ring, then the gold field.
- **Field:** mid gold with a darker band toward the bottom right, plus a one-pixel shadow just inside the ring at the top left.
- **King:** a hand-drawn 20×21 head at (10, 8). From top to bottom: a cross with two-pixel arms, the round knob, two lobes split by a two-pixel dark line, then the band with two dark rings. It stops below the band.
- **King's colors:** ivory on the lit side, pale gold in the middle, a darker gold in shadow.
- **Outline and halo:** everything is outlined in `k`, with a faint gold halo (`#ffe08a40`).

**Colors I added:**
- `G #dc9a24`: the field's main gold
- `D #b8760e`: the field's dark band and the shadow under the rim
- `W #fff4cc`: the king's lit ivory
- `V #f5d888`: the king's pale gold middle
- `S #d9a84a`: the king's shade

**Choices you might want to change:**
- **Cross:** the smallest part of the crown; it only just reads at 20 px. It could be a pixel thicker, but it already almost touches the dark ring at the top.
- **Rivets:** they barely show on the rim. They could be darker or moved to the diagonals.
- **Field band:** it starts fairly far toward the bottom right. Lower the `p > 5.5` threshold in `coinGrid()` for a bigger band.
- **Halo:** its strength is the last two digits of its color (`40`).
