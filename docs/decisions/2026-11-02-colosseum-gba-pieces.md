# The Colosseum's Pixel pieces: the art session's models, only the pieces pixelated, its own Animations (Nov 2, 2026)

**Eric (Nov 2):** "When it's set in pixel form for the pieces, it also pixelates the entire crowd, and it looks terrible. The
whole point was just to change the chess pieces." The pieces "look smeared and sloppy… like a JPEG saved 100 times." Then, on
the art session's 3D models: "it looks better now… queue it to go live, make it the default piece style option in the
colosseum, remove the old pixel one, also the default animation toggle should be no animation"; and "the colosseum settings
are separate."

**What caused the smear:** the whole arena drew into a target a third of the screen's size and was scaled up, so the crowd and
the stands went chunky too; and the old pixel set was 3D meshes rasterized straight into that small grid: dozens of tiny faces
a piece, each lit to its own cel tone (and a shine threshold), so tones broke into one-pixel specks; thin parts (collars,
merlons) came and went pixel by pixel; and as a piece slid, perspective changed its size by fractions of a pixel, so its
pixels reshuffled every frame (shimmer).

**What changed** (`docs/areas/colosseum.md`, "Pixel"):
- The arena and crowd draw full size in Pixel too; only the pieces are pixel art.
- The pieces are the art session's models (`pieces-gba.ts`, `arena-pieces-gba.ts`, from `claude/boss-art` at b6a7743, as
  they are), each drawn by its own tracer as a sprite for the seat's pitch, laid on one texel an art pixel, its foot snapped
  to an art pixel: every pixel a palette color, a one-pixel outline, nothing changes as it slides. The old pixel set
  (`pieces-pixel.ts`, its shaders, its small target and outline pass) is gone. 3D and 2D stay as they were.
- The Colosseum's gear has its own Animations, off by default (`colosseum-animations`); Settings → Board's Animations
  (Crowd, raids, Classic's and Squads' reveals) is unchanged.

**Calls made:**
- **The name stays "Pixel"**, so players see the same option; an old saved "pixel" gets the new pieces.
- **Sprites, not a shader:** the models are drawn by the art session's own code when the seat changes (about 150 ms for
  twelve), so the game shows exactly what Eric approved; per frame it's one draw call of 32 quads.
- **Pitch:** a share of the view's own (30/47: the high view behind White gives the mockups' 30°), at most 0.7 rad.
- **Farther pieces smaller** (the reference's perspective; the mockups had every piece one size): six shares of each model
  (1 to 0.5) drawn ahead, picked on the GPU from the square's width where the piece stands. Without it a low seat's far
  rank stood as big as the near one and crowded its squares.
- **The art pixel:** whole screen pixels, at least 2, so the square nearest you is about 20 art pixels (what the models were
  drawn for): 3 on a 1440 × 900 computer, 2 canvas pixels on a phone (a square there about 24).
- **Order:** far ranks first by each piece's square, from where you look; a sliding piece keeps its destination's place.
- **No contact shadow** (the mockups have none), and the knight always looks left (as drawn).
- **The Colosseum's Animations is its own** (the global one would have changed Crowd and raids too); it sits where the gear's
  Animations row was, beside Pieces.

**Frame rate** (headless, software WebGL; the styles in the same page in turn, the high view behind White, medians of six
2 s windows): phone Pixel 18.4, 2D 20.2, 3D 11.0; computer Pixel 9.8, 2D 9.8, 3D 7.4. Pixel now costs what 2D does (the arena
is full size again); the old Pixel was cheaper only because it drew the arena at a ninth of the pixels.
