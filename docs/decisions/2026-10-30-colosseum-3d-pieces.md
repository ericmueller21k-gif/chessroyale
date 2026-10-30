# The Colosseum's giant pieces in 3D, behind a switch (Oct 30, 2026)

**Eric (Oct 30):** "it would be cool if we could make the chess pieces 3D, but look the same kind of as the basic chess pieces
that we're all used to seeing … draw each piece once as its own 3D version … then they're done … and we can reuse those
later." Stills first; the build stays behind `?pieces=3d` until he decides. Without it, the flat pieces exactly as before.

**What changed:** `colosseum/pieces3d.ts` makes the six Staunton pieces once in code (turned profiles with the rook's
merlons, the queen's points and the king's cross; the knight's head an outline extruded with a bevel). `arena-gl.ts` draws
them instanced, one draw call a kind, lit from the arena's sun; `Colosseum.tsx` reads the switch. `docs/areas/colosseum.md`.

**Calls made:**
- Each piece turns round its own axis to face you, as the flat pieces did: a knight always shows its profile (nose to the
  left, as on the board's pieces) and a bishop its slit, from every seat. The views never move the eye, only turn it, so
  nothing visibly spins.
- Gold trim on both sets (a line on the base and collars, the queen's points, the king's cross), as Eric's mockup.
- The bishop's slit and the knight's eye are drawn in the shader, not cut into the mesh: less code, reads the same.
- Sized a little over a real set (the king about 1.6 m on 1 m squares), so they read from the high seats.
- 16 steps round each turned shape (24 cost a third more triangles and looked the same from the stands): about 30k
  triangles for 32 pieces.

**Frame rate** (eric.md's method: headless, software WebGL, seat 2, 5 s, medians of four runs taken in turn, flat and 3D
interleaved, one pass):

| | fps flat → 3D | script a frame flat → 3D | draw calls flat → 3D |
| --- | --- | --- | --- |
| phone 390 × 844 | 12.5 → 8.6 | 0.30 → 0.49 ms | 3 → 9 |
| computer 1440 × 900 | 6.4 → 4.4 | 0.42 → 0.60 ms | 3 → 9 |

Nothing allocated a frame (six more draw calls and a few uniforms). The fps drop is SwiftShader (the CPU playing GPU)
shading 30k more triangles; on a real GPU that is well under a millisecond. Eric's phone decides.
