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

## This picture: `arena-auto-card` (the Auto chess card)

The **Auto chess** card on the home screen: a half-width card whose picture sits in a **64 x 64 px** rounded square
(today a plain white knight). Auto chess (Eric: "build an army, watch it fight"): you buy chess pieces from a shop, place
them, and they fight on their own; pieces gain little gold stars when merged.

- Frame **32 wide x 32 tall** (meant for 2x in the 64 px square); transparent background.
- **A tiny army marching out:** a white knight in front, a rook and a pawn just behind it, the game's chess-piece shapes
  in white (`M`, `m`, `o`) with dark outlines, two small **gold stars** over the knight (a merged piece), a little sword
  or banner tilted forward, a few dust puffs. It must read at 64 px.
- Animation: `idle`, 4 to 6 frames at about 200 ms: the three march in place (a step bob, staggered), the stars twinkle.
