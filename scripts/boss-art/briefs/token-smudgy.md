# A boss token (not the arena)

You are drawing **one small coin-like token** for HunChess, in the same sprite format and pixel-art style as the Chess
Town crest (`scripts/boss-art/out/arena-town-badge/arena-town-badge.ts`, its picture: the reference `crest-idle.png`).
This run uses the scenery mode only for its format and tools: ignore everything about the arena. Eric: "I like the style
you did before… just like the one": **match the crest**: its gold rim (`y` `#ffe08a` / `Y` `#f4b740` / `O` `#b97c10`, shaded
from the top left), its rivets, its dark inner ring, its navy inside (`N` `#1f2a44` / `n` `#34466e`), its `k` (`#2a1c14`)
outline and its faint gold halo. Read the crest's file first and build the token the same way.

## The style
- Chunky, clean pixel art; light from the **top left**; an outline in `k` where the shape meets the background; banded
  shading (lit, mid, shade; never smooth gradients). Few colors, big readable shapes: it must read at a glance at phone
  size, on dark navy and on light panels.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts` (and `paint.ts` if useful).
  Export the Character as a named const (upper case of the id) with the id below and a short `name`.
- **Never draw letters or numbers.** Never draw anyone real.

## Match the approved tokens
Eric approved the Ginger and Blitz tokens (Nov 2: "the examples of the ginger and blitz coins were perfect"). This token is
one of the same series: **copy the coin from `scripts/boss-art/out/token-blitz/token-blitz.ts`** (read it, and
`token-ginger.ts` beside it): the same 40 x 40 frame, the same rim, rivets, inner ring, navy middle, halo, outline and
glint code, unchanged; only the face layers are new. Their pictures are the references `approved-token-ginger-idle.png`
and `approved-token-blitz-idle.png`; the crest is `crest-idle.png`. The face fills the navy middle the way theirs do: the
same size, centered, head and shoulders at most, cut off by the inner ring.

## How to check
Render it (`render`, `scale` 4, both `bg`s) and look at it small too. Pace yourself: a $1 cap; a clean,
readable token in a few renders beats a long polish. Call `done` with notes: the frame size, the scale it's meant for,
and any choice the owner might change.

## This token: `token-smudgy` (Smudgy, the chameleon painter)

One of the series of boss tokens (one per boss), after the approved Ginger and Blitz tokens.

- Frame **40 wide x 40 tall**, transparent background, meant for 2x.
- A round **gold-rimmed coin** (the approved tokens' rim and inner ring, copied) with **the boss's face** filling the navy middle: Smudgy's face: a lime-green chameleon head with his casque striped orange, teal and green, his big amber eye in its turret of skin, a friendly smirk, his deep plum painter's beret tipped on the casque; a cream apron with a paint splat at the shoulders, a tip of his brush with yellow paint is welcome if it fits (the reference: smudgy-idle; his colors: packages/app/src/characters/smudgy.ts).
  Head and shoulders at most; the face big and clear, the boss recognizable at a glance; one clear emblem of the boss, not a
  crowd of details.
- Animation: `idle`, as Blitz's: the glint travels round the rim a quarter turn per frame (about 180 ms each), a long rest
  (about 1400 ms), then a blink (about 150 ms) if the face has eyes that can blink. Nothing else moves.
