# The coin (the game's currency), in the boss tokens' style

You are drawing **the game's coin**: the icon shown beside every coin count and price in HunChess (the shop's top bar, its
price pills, rewards). It replaces today's coin, an emoji (a silver eagle coin, the reference `todays-coin-to-replace.jpg`).
This run uses the scenery mode only for its format and tools: ignore everything about the arena.

Eric, Nov 17: "I want it drawn like the boss coins but a king chess piece 'head only' style as the center."

## Match the boss tokens
The boss tokens are the references `boss-tokens-light.png` and `boss-tokens-dark.png`. **Copy the coin from
`scripts/boss-art/out/token-blitz/token-blitz.ts`** (read it, and `token-ginger.ts` beside it): the same 40 x 40 frame, the
same gold rim (`y` `#ffe08a` / `Y` `#f4b740` / `O` `#b97c10`, shaded from the top left), the same rivets, the same dark inner
ring, the same `k` (`#2a1c14`) outline and faint gold halo, unchanged.

**One change: the middle is gold, not navy.** The coin must read as *money* at a glance, next to the navy-middled boss
tokens. Fill the inside of the inner ring with a deeper, warmer gold field (for example a mid gold with a darker gold band
toward the bottom right, banded, never a smooth gradient), so the whole coin is gold.

## The king's head in the middle
The top of a chess king, **head only**: the small cross on top, the round knob under it, the crown's two lobes, and the
crown's band (a couple of horizontal rings), cut off below the band: no neck, no base. Its shape is the game's own king
piece, the reference `game-king-pieces.png` (the cburnett set): match its silhouette, simplified to chunky pixels.
- Draw it **as a struck emblem on the coin**: the king in pale gold or ivory (`#fff4cc`-ish lit side, a mid gold shade),
  outlined in `k`, standing out clearly from the gold field. Lit from the top left like everything else.
- Big and centered: the cross near the inner ring's top, the band near its bottom; it fills the middle the way the bosses'
  faces do. One clear shape, not a crowd of details.

## It must read small
This coin sits beside numbers in text: about 20 CSS px on a phone (the size of a letter), and 40 px in bigger places.
At 20 px, the cross, the two lobes and the band must still read as a king's crown, and the coin as gold. Check it with the
render's small sizes, on both backgrounds. Keep the halo faint; no thin one-pixel details that vanish when halved.

## The style
- Chunky, clean pixel art; light from the **top left**; an outline in `k`; banded shading (lit, mid, shade). Few colors.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts` (and `paint.ts` if useful).
  Export the Character as a named const `TOKEN_COIN` with id `token-coin` and name `Coin`.
- **Never draw letters or numbers.** Never draw anyone real.

## This token: `token-coin`
- Frame **40 wide x 40 tall**, transparent background.
- **One animation, `idle`, with ONE frame** (a still; no glint, no blink: it's shown in many places at once and must not
  move). Give it 1000 ms.

## How to check
Render it (`render`, `scale` 4, both `bg`s) and look at it small too. Pace yourself: a $1.50 cap; a clean, readable coin in
a few renders beats a long polish. Call `done` with notes: the palette keys you added and any choice the owner might change.
