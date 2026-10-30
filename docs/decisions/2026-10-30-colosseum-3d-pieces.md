# The Colosseum's giant pieces in 3D, behind a switch (Oct 30, 2026)

**Eric (Oct 30):** "it would be cool if we could make the chess pieces 3D, but look the same kind of as the basic chess pieces
that we're all used to seeing … draw each piece once as its own 3D version … then they're done … and we can reuse those
later." A first, glossy Staunton set looked "too nice", like a stock library set. He wanted the board's own cburnett pieces
made 3D, chunky like the town's table pieces. He liked the toon pawn ("just a hair too fat"), so all six are built that way.
It stays behind `?pieces=3d` until he decides. Without it, the flat pieces exactly as before.

**What changed:** `colosseum/pieces3d.ts` makes the six once in code. Each follows its cburnett picture's outline and
proportions, measured in the picture's own units (0.025 m each), its base no wider than the picture's: pawn, rook (notches),
bishop (slit), queen (six points with balls, one in the middle) and king (cross) turned in ten steps round, so the facets
show. The knight is the cburnett horse's head, its outline sampled from the picture's own curves and given depth with a
bevel, on a round base. `arena-gl.ts` draws them instanced, one draw call a kind. Each flat face gets one of two tones from
the table pieces' `TABLE_INK` (light: cream, its right-hand faces shaded; dark: charcoal, its upper-left faces a lighter
grey), with no shine, plus a thick dark outline. `Colosseum.tsx` reads the switch. The glossy set and `?pieces=toon` are gone.

**Calls made:**
- The outline is an inverted hull baked into each mesh (its inside-out copy, pushed out along welded normals, its foot kept on
  the board), with back faces culled: still one draw call a kind, about as thick on screen from any seat.
- Each piece turns round its own axis to face you, as the flat pieces did: a knight always shows its profile, nose to the
  left as on the board, turned 17° toward you so its depth shows. The views never move the eye, only turn it.
- The bishop's slit and the knight's eye are drawn in the outline's ink by the shader, not cut into the mesh.
- The pawn follows the cburnett pawn's proportions (skirt, round body, neck, head), slimmer than the first toon pawn.
- Test hooks for still pairs: `pieces(style)`, `freeze()` and `pose(fen)`.

**Frame rate** (eric.md's method: headless, software WebGL, the second seat, 5 s, medians of four runs taken in turn, flat
and 3D interleaved, one pass; the 32 pieces are about 23k triangles with their outlines):

| | fps flat → 3D | script a frame flat → 3D | draw calls flat → 3D |
| --- | --- | --- | --- |
| phone 390 × 844 | 12.3 → 10.3 | 0.28 → 0.37 ms | 3 → 9 |
| computer 1440 × 900 | 6.1 → 5.5 | 0.63 → 0.57 ms | 3 → 9 |

Nothing allocated a frame (six more draw calls and a few uniforms). The fps drop is SwiftShader (the CPU playing GPU); on a
real GPU it is small. Eric's phone decides.
