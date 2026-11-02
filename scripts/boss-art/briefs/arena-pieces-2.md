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

## This piece: `arena-pieces-2` (a redo of `arena-pieces`)
The first drawing, `scripts/boss-art/out/arena-pieces/arena-pieces.ts` (read it first, and keep it as your starting point:
copy it into your file and change only what's needed), reads well except one thing: **the queen looks like a rook** (a
straight tower with a small cap). Fix the queen, white and black:
- A queen's silhouette: a slimmer, waisted body that flares out at the top into an open **crown of 5 to 7 sharp points**
  (a coronet, wider than the body's neck, with gold on the points), a small gold ball on top in the middle; a tapered
  neck under the crown, no flat battlements anywhere. It must be unmistakable from the rook at phone size, and a little
  taller (about 46 px) than the bishop.
- Keep everything else as it is (frame 32 x 56, foot (16, 55), the twelve animations, palettes, the other pieces). The
  id is `arena-pieces-2` (export `ARENA_PIECES_2`).
- Check with `anim: "*"` on both backgrounds, and look at the rook and queen side by side at phone size.
