# The street town, round 3: box buildings and the turning camera (Nov 5, 2026)

Eric (Nov 5): "The corner screenshot you can clearly see the houses are flat, any way to fix?" Every building is now a box, as the art
drew it (`claude/boss-art` 11a4d903, `town-art-nov5.md`), and the camera turns with the street so you always see the fronts. Still an
admin's town only (`STREET_TOWN`); the director flips it for everyone after Eric walks it.

## What's in

- **Boxes** (`town/boxes.ts`: where each stands, its sides a neighbour covers, its roof faces' geometry and light, each frame's plan;
  `town/box-draw.ts`: each roof painted once; `render.ts` draws them). The 43 lots (16 homes, the everyday buildings and the bigger
  ones behind), the 12 sheds and the 131 squares of hedge. A front stands on its front line; its sides run back from its body's edges;
  three homes have a back wall; the roof is the art's faces. Each part is sorted by its own depth among everything else (the art's
  order), the roof's faces far to near inside it.
- **The camera turns** (`town/turn.ts`, `camera.ts`): north everywhere, east on Seam Avenue outside its four crossings (the plan's
  `camAt`, checked square by square against the art's). It eases over `streetTurnMs` (500 ms a quarter turn), turning about you as it
  follows you; a chip's glide turns it to where it glides; dragging to look round keeps it. Taps (`pickSquare`), the arrow keys
  (`screenStep`: up is up the screen) and the drag go through the heading. People, trees, lamps, benches and tables stay billboards;
  hedges are planes. The sun stays put; the clouds slide (`streetTurnClouds`). The chips follow the heading (they aim through the turned
  camera). The Colosseum's far drawing shows only within 45 degrees of north (`farColosseumShows`).
- **Seam Avenue's fronts face west**, the camera facing east there (round 2's stand-ins facing the camera are gone).
- **Names over their own roofs:** a home's floating name sits `nameOverRoof` px over its roof's (or its front's solid) top, and drops
  (down to its eave) while it would lie over a building behind. Round 2's sat over the picture's first drawn row, which for Timber's
  lodge was its chimney smoke, high over the lodge and over Boingo's Funhouse behind.

## The calls

1. **Lighting as the art's:** a roof face `0.74 + 0.36 (n . L)`, 0.55 to 1.12, with the light fixed to the camera (so the sun stays
   put and a face's light changes as it turns); a wall's shade by how far it's turned from the camera, 6% turned left to 30% right (the
   art's two numbers), none facing you. So a front never darkens at rest, and Seam Street's fronts seen from the avenue take the 30%.
2. **A roof is painted once a heading.** Each face is painted top-down at the art's 37 px a square (its tile, its light, its ink edge,
   a flat roof's rim), whole and in triangles, into a sheet or two a box. The camera rests facing north or east, so a box is painted
   for each; a turn blends the two (half a second). Painted ahead of being seen, nearest first, `boxBakeMs` a frame.
3. **One drawing path for both renderers:** every piece is an image through an affine transform (what both backends already draw), so
   WebGL batches them into its few draw calls. A face is drawn in one piece when that lands its last corner within `boxWholePx`,
   else in triangles (exact corners). A wall seen at a slant is drawn in upright strips (perspective): fine in WebGL (a strip is a few
   vertices), coarser on the 2D fallback (`boxStrip`, `boxStrips`), each strip's top at its nearer end's height so the step hides
   under the eave. Faces turned away and tiny ones (`boxTinyPx`: a water tank's legs from afar) aren't drawn.
4. **The 2D fallback's domes (and Boingo's vault) are cut down** (Ginger Igloo and Chub & Chirp's Grassland 6 x 3 faces, the vault 4
   round), so every building stays within the art's 12 to 20 draws (`town-boxes.test.ts`). WebGL keeps the art's 10 x 5 domes.
5. **A side is skipped when a neighbour at least as tall covers it:** the same street line, its facing wall within a third of a square,
   from no further back at the front to no nearer at the back. The homes' bodies stand in from their lots, so their sides mostly show
   (four sides are covered in this plan).
6. **Nothing between the camera and you** (round 2's rule) now per part: a front, side or roof face nearer than `streetNearCut` isn't
   drawn; hedges are drawn anyway (low).
7. **The turn's target is the square you're on** (the art's), so a look round (drag) never turns the camera; a chip's glide uses where
   it's going.
8. **The arrow keys mid-turn** go the way the screen's up points most nearly (the nearest quarter turn).
9. **The chess tables' boards stay drawn in the camera's frame** (they're in the park, where it always faces north).

## Frame rate

See the PR body (`docs/street-town-boxes/pr-body.md`): measured as round 2 (headless, phone and computer, 5 s walking, medians of four
runs in turn), plus the turn (up and down Seam Avenue through two crossings), on both renderers.
