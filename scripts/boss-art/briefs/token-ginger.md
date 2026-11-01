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

## How to check
Render it (`render`, `scale` 4, both `bg`s) and look at it small too. Pace yourself: effort medium on a small cap; a clean,
readable token in a few renders beats a long polish. Call `done` with notes: the frame size, the scale it's meant for,
and any choice the owner might change.

## This token: `token-ginger` (Ginger, the gingerbread boss)

An example of a set of boss tokens (one per boss); Eric approves these two before the rest are drawn, so it should
look like the first of a series: the same rim and layout could take any boss's face.

- Frame **40 wide x 40 tall**, transparent background, meant for 2x.
- A round **gold-rimmed coin** (the crest's rim and inner ring) with **the boss's face** filling the navy middle: a gingerbread man's round brown cookie face: white icing eyebrows and smile, gumdrop or currant eyes, a little icing trim round the face (the references: gingerbread-idle and gingerbread-victory).
  Head and shoulders at most; the face big and clear, the boss recognizable at a glance.
- Animation: `idle`, 4 to 6 frames at about 150 to 300 ms: a **short shine**: a glint sweeps across the coin's face or
  travels round the rim, then rests. Nothing else moves (a blink is welcome if it's cheap).
