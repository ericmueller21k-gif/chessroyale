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

## This piece: `arena-pieces`

The **six giant chess pieces** on the arena's board, **white and black**: king, queen, rook, bishop, knight, pawn.
- One Character, frame **32 wide x 56 tall**, foot (bottom center of each piece's base) at **(16, 55)**, with **twelve
  single-frame animations**: `wk`, `wq`, `wr`, `wb`, `wn`, `wp`, `bk`, `bq`, `br`, `bb`, `bn`, `bp`. Check them all with
  `anim: "*"` on both backgrounds.
- Heights (base to top): pawn about 26, rook 32, knight 36, bishop 40, queen 46, king 52. All about 20 to 24 px wide at
  the base. Standing upright, seen from the front and a little above (the base's top shows as a thin ellipse).
- The classic Staunton shapes, chunky and **readable at a glance from the stands** (the king's cross, the queen's crown
  of points, the rook's battlements, the bishop's mitre with its slit, the knight's horse head facing left, the pawn's
  ball). The mockup's close-up `d-pieces-board.jpg` shows the look.
- **White**: marble (`M`, `m`, `o`, with a lit left side). **Black**: a deep slate/ebony (add keys, e.g. `#2b2d3a`,
  `#3d4152`, `#575d74`, so the shape reads on the sandy floor, never pure black). **Both trimmed in gold** (`Y`, `y`,
  `O`): a gold ring on the base and the collar, the king's cross and queen's crown points touched with gold, as in the
  mockup.
- Keep each piece's drawing as a function or a shared base so the twelve stay consistent (white and black the same shape,
  only their colors differ).
