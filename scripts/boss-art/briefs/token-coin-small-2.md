# The coin, small: a 20 x 20 version of `token-coin`

The game's coin (the icon beside every coin count and price in HunChess) is drawn at 40 x 40 in
`scripts/boss-art/out/token-coin/token-coin.ts` (read it first; its picture is the reference `the-coin-40-approved-design.png`:
the boss tokens' gold rim and dark inner ring, an all-gold middle, and a chess king's head, the game's own king piece, the
reference `game-king-pieces.png`, as a pale-gold emblem). This run uses the scenery mode only for its format and tools.

The coin is shown at **20 CSS px** beside text on phones (the shop's top bar, price pills, Buy buttons). Halving the 40 x 40
drawing blurs it, so draw **the same coin by hand at 20 x 20**, every pixel placed for that size, shown at whole pixels
(1, 2 or 3 screen pixels per art pixel).

- Frame **20 wide x 20 tall**, transparent background. Same palette as `token-coin` (copy its palette keys and colors).
- Same design, simplified for 20 px: a round gold coin with a `k` outline, a 2-pixel gold rim lit from the top left (light
  top-left, darker bottom-right), a 1-pixel dark inner ring, a gold middle (a darker gold corner bottom right is enough),
  and the king's head big in the middle: the small cross on top (a plus, 3 pixels wide), the knob, the crown's two lobes and
  the band below with one dark line across it, outlined in `k` where it meets the gold. It must read as **a gold coin with
  a king's crown** at a glance, beside a number. Drop the rivets and the halo if they muddy it (say so in your notes).
- Must read on light (`#f2f0eb`) and dark (`#1c1c1e`) backgrounds.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts`. Export the Character as a
  named const `TOKEN_COIN_SMALL` with id `token-coin-small` and name `Coin (small)`.
- **One animation, `idle`, with ONE frame** (a still), 1000 ms. **Never draw letters or numbers.**

## How to check
Render at `scale` 6 and 3 on both backgrounds, and at 1x. A $1 cap: a few renders. Call `done` with short notes.

## Second pass: your file already has a first try
`scripts/boss-art/out/token-coin-small/token-coin-small.ts` is a first pass (its render: the reference `pass-1-render.png`).
**Read it and edit it** (don't start over). The coin and rim are good. Fix the king, which at 20 px reads as a box or a face:
- **The cross** reads as a dash. Make it a clear plus: a vertical bar 3 pixels tall through a horizontal bar 3 wide, in pale
  gold, outlined in `k`, standing on the knob, touching or overlapping the inner ring at the top if it must.
- **The crown's two lobes**: rounded shoulders left and right of the knob, wider than the band, with a `k` dip between each
  lobe and the knob, so the silhouette is the cburnett king's (`game-king-pieces.png`): wide rounded top, narrower band.
- **The band**: one or two pale rows with a single dark line across, a little narrower than the lobes.
- Nothing that reads as eyes or a mouth.
Render at scale 6 and 1, both backgrounds, compare with the 40 x 40 (`the-coin-40-approved-design.png`), and call `done`.
