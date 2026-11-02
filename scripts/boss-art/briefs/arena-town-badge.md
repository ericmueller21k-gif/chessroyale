# A home-screen picture (not the arena)

You are drawing **one small picture for HunChess's home screen**, in the same sprite format and pixel-art style as the
Colosseum's pieces (this run uses the arena mode only for its format and tools: ignore everything about the arena that the
brief doesn't ask for). It sits on a button on a phone, drawn crisp at a whole-number scale (2x or 3x), on the home's dark
navy panel in dark mode and a light panel in light mode, so it needs its own dark outline and must read on both.

## The style
- Chunky, clean pixel art; light from the **top left**; an outline in `k` (`#2a1c14`) where the shape meets the background;
  banded shading (lit, mid, shade; never smooth gradients). Few colors, big readable shapes: it must read at a glance at
  phone size.
- Match the town: read `packages/app/src/town/houses/kit.ts` (`paint`, `grain`) and one or two houses in
  `packages/app/src/town/houses/` for the town's roofs, walls and palette; the game's gold is `Y` `#f4b740` / `y`
  `#ffe08a` / `O` `#b97c10`, navy `N` `#1f2a44` / `n` `#34466e`, chess white `M` `#f7f4ee` / `m` `#d9d3c7` / `o` `#a39b8d`.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts` and
  `../../../../packages/app/src/town/houses/kit.ts`. Export the Character as a named const (upper case of the id) with the
  id below and a short `name`.
- **Never draw letters or numbers** (the button carries its own words). Never draw anyone real.

## How to check
Render it (`render`, `scale` 4, both `bg`s) and look at it small too. Pace yourself: effort medium on a small cap; a clean,
readable picture in a few renders beats a long polish. Call `done` with notes: the frame size, the scale it's meant for,
and any choice the owner might change.

## This picture: `arena-town-badge` (Chess Town, option C: an emblem)

It sits on the **Chess Town** button on the home screen: a wide button the size of the PLAY button (full phone width,
about 340 x 72 px), opening the town square where players walk, sit at park tables and play chess. Eric: the button
"needs some flair… maybe a chess piece in a town looking thing". Three different options are being drawn; this is one.

- Frame **40 wide x 40 tall** (a small emblem for the button's left end, meant for 2x); transparent background.
- A **round town crest**: a gold-rimmed circle (navy inside) with a **giant white chess pawn** standing in front of two or
  three tiny houses with pointed roofs and a clock tower, a ribbon of cobbles at its foot. Like a town's signpost badge.
- Animation: `idle`, 4 frames at about 300 ms: a glint travels round the gold rim, a window lights.
