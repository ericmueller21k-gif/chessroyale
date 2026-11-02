# The Colosseum's inside: one piece of the arena

You are drawing **scenery, not a boss**: one piece of the inside of the Colosseum in HunChess's town, where a weekly
chess tournament is watched from the stands. The game builds the arena (a ring of tiered stands round a sandy floor with
a giant chessboard on it, seen from a seat high in the stands) out of many such pieces, placed and repeated by code. So
draw **this one piece**, cleanly, on a transparent background; never a whole scene.

## The style
- Eric's mockup sets it (view_reference: `a-mockup.jpg` whole, and the close-ups `b-…` to `e-…`): pixel art, warm
  sandstone, navy banners with a gold crown, torches on stone pillars, tiered stands packed with a crowd, a giant board on
  the floor with big white and black pieces trimmed in gold. Take shapes and feel from it, never its pixels; ours is
  cleaner, chunkier pixel art.
- Match the town: read `packages/app/src/town/houses/coliseum.ts` (its PALETTE and how it shades stone; the Colosseum's
  outside) and `packages/app/src/town/houses/kit.ts` (`paint`, `grain`). Light from the **top left**, an outline in `k`
  (`#2a1c14`) where the shape meets the background, banded shading (lit, mid, shade; never smooth gradients), and
  the coliseum's colors: travertine stone `1`..`6` (`#fbf0d8` `#ecd9b2` `#d8bf93` `#bb9e70` `#93784f` `#6a5539`), the dark
  of an opening `x` `#2e2018` / `z` `#150e0a`, navy `N` `#1f2a44` / `n` `#34466e`, gold `Y` `#f4b740` / `y` `#ffe08a` /
  `O` `#b97c10`, marble `M` `#f7f4ee` / `m` `#d9d3c7` / `o` `#a39b8d`. Use these same keys and values (add more keys
  only where needed), so every arena piece sits together.
- Read only what you need (packages/app/src/characters/sprite.ts for the format, kit.ts, coliseum.ts's palette and a
  part or two of it); skip the bosses. Earlier arena pieces, if any, are readable under `scripts/boss-art/out/arena-*/`:
  match them.
- Import with paths relative to your file: `../../../../packages/app/src/characters/sprite.ts` and
  `../../../../packages/app/src/town/houses/kit.ts`. Export the Character as a named const (upper case of the id, e.g.
  `ARENA_WALL`) with the id below and a short `name`.
- Never draw letters or numbers. Never draw anyone real, and nothing from the town's bronze statue.

## How to check
Render your animations (`render`, `scale` 4, both `bg`s) and, for a piece that repeats, `tile: "x"` (or `"xy"`) to see
the seams: a repeat must join with no visible edge. `anim: "*"` shows a set of stills side by side. Pace yourself: you
are at effort medium on a small cap; a clean, readable piece in a few renders beats a long polish. Call `done` with
notes: the frame size, where its foot/anchor is, how it repeats, and any exported points.

## This piece: `arena-cup-banner`

The **Colosseum Cup banner**: a wide title banner for the Cup (the game writes the words over it, so leave its middle
plain).
- Frame **112 wide x 36 tall**; anchor: its top center at (56, 1).
- A **navy cloth banner** (`N`, `n`) with a gold border, hung from a gold rod with finials, its two ends folding back like
  a ribbon (swallowtails behind), a small gold **laurel and trophy emblem** at each end, and a **plain navy field** in the
  middle (about 64 x 16) for the words. Lit from the top left, a fold or two in the cloth. No letters or numbers.
- Animation: `idle`, 4 to 6 frames at about 220 ms: the tails sway a pixel or two, a glint runs along the gold rod.
