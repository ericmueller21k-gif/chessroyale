# Profile circle: the blurred backdrop on its own layer (Nov 9, 2026)

Eric, Nov 9 (iPhone, his public profile): white, box-shaped glitches flickering in the circle behind his moving pawn. The circle's
backdrop is the player's icon under `filter: blur(9px)`; each frame of the pawn's animation dirties a few tiles of the circle, and
Safari re-blurs just those tiles, which can come back white. Fix: the backdrop gets its own compositing layer (`translateZ(0)`,
`will-change: transform`), so it is blurred once and never redrawn while the pawn moves. CSS only. Eric checks it on his phone.
