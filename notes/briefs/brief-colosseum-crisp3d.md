# Brief: Colosseum, crisp 3D pixel pieces (prototype + stills for Eric)

Worktree `/home/user/cr-crisp`, branch `claude/colosseum-crisp3d` (from main). Opus high. Push as you go. ASAP: Eric wants
pictures tonight.

## Eric (Nov 2)
- "When it's set in pixel form for the pieces, it also pixelates the entire crowd, and it looks terrible. The whole point
  was just to change the chess pieces."
- The Pixel pieces "look smeared and sloppy… like a JPEG saved 100 times… a Game Boy Advance game… the drawings aren't
  smeared." "Draw them 3D in the same style … no smear, the plan all along was to mirror the first reference image"
  (`docs/refs/colosseum-high-view.png`).
- An API art run is redrawing the rook and knight as hand-made sprites at the camera's angle in parallel (branch
  `claude/boss-art`, `scripts/boss-art/out/arena-pieces-gba/`: look at its `sheet.png`/mockups for the palette and crisp style
  Eric likes). Your job is the other option: **the real 3D pieces (`colosseum/pieces-pixel.ts`, `arena-gl.ts` Pixel), crisp**.

## What to build
1. **Pixel pixelates only the pieces.** Today Pixel draws the whole arena into the small target and scales it up
   (`arena-gl.ts`, the comment at the top, `pixelScale`). Draw the arena, stands and crowd at full resolution as in 3D/2D;
   only the pieces go through the pixel look.
2. **No smear.** Find why the pieces smear (likely: low-res rasterizing of many small faces, cel tones banding per face,
   outline from neighbors, scaling filter, the 8-sided faces, sub-pixel jitter as the camera or piece moves). Make them read
   like the reference: crisp 1 px dark outline, a few flat cel tones with a clear light side and shadow side, the shapes'
   features defined (knight's head and mane, rook battlements, bishop slit, crowns), stable pixels (no shimmer as things
   move). Options: render pieces at an art pixel tuned so features have enough pixels (phone and computer), snap to the
   pixel grid, smoother lathe profiles, per-kind tuned meshes, quantized lighting. Your call; say why.
3. Keep the gear's Pieces option (Pixel / 3D / 2D) as is for now.

## Deliver (fast)
- Stills, phone 390x844 and computer 1440x900, the high view behind White, the start position: before (today) and after,
  plus a close crop of the rook and knight at 4x, and the reference picture beside them. `docs/colosseum-crisp3d/`.
  A short GIF of a few moves (pieces sliding) to show no shimmer.
- Unit/e2e: keep `e2e/colosseum.spec.ts` passing; run only what you change.
- PR-body file `docs/colosseum-crisp3d/pr-body.md`. Push. Don't open a PR.
