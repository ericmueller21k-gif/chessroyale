# GBA pieces, trial: the rook and the knight (Nov 2)

Eric (Nov 2): today's Pixel pieces look "smeared and sloppy… like a JPEG saved 100 times"; redraw them as crisp Game Boy
Advance pixel art with defined features. On the spend question: "Just draw a rook and a horse, I will approve all the
pieces if these turn out the way we want."

- **What's here:** `arena-pieces-gba.ts` (one Character, 26 x 34, foot (13, 33); stills `wr`, `br`, `wn`, `bn`), drawn
  by the Claude API (Opus 5.5, effort high): **$1.13** of a $5 cap, 15 turns, 9 renders (`summary.md`, `log.jsonl`).
- `sheet.png`: the four at 1x and 4x on light and dark squares. `mockup-computer.png`, `mockup-phone.png`: the four laid on
  a still of the arena (Pixel, the high view behind White) with no other pieces, one sprite pixel one art pixel, each foot
  on its square's middle (`arena-pieces-sheet.ts`; the empty stills came from a local, uncommitted switch).
- **The size:** drawn for a square near White of 20 art pixels (rook 19 tall, knight 22, as PIXEL_TARGET). The arena's
  grid today gives a square there of about 19 art pixels on a computer (fits) and 16 on a phone (the pieces stand about 20%
  taller there, as the phone mockup shows). Far ranks aren't shrunk (as in Eric's picture). Whoever wires them in decides:
  a finer art pixel on a phone (the canvas is 2x today; at 3x a scale of 4 gives about 18) or a smaller phone set.
- **Next, once Eric approves:** the pawn, bishop, queen and king in a second run on the same base and palette (the model's
  notes in `summary.md` say how), then the director's helper draws them in the arena in place of the meshes.

## Round 2: the 3D model (Nov 2)

Eric, on the flat trial: "Have it draw them 3d in the same style it is right now, no smear, the plan all along was to
mirror the first reference image." On the spend: "No just actually draw the 3d model based on the 2d image you just made
for the horse and rook, then send me a view of it from the crowd." So no API run (no spend): built here, by hand, in
`scripts/boss-art/arena-pieces-3d.ts`.
- **The model,** from the 2D drawing's own grids, one unit a sprite pixel: every row of the rook and the bases turned round
  the axis (gold rows gold rings, dark rows grooves); the rook's top a ring wall of four battlements round a sunken roof;
  the knight's head the sprite's head given a rounded thickness, the mane gold, the eye on both cheeks.
- **The view from the crowd:** each pixel one ray from the stands behind White, looking down 30 degrees (Eric's picture's
  pieces show their bases' tops and the rook's top at about this angle); flat bands of the same palette lit from the top
  left, a 1-pixel outline round each piece and where a nearer part covers a farther one. Every pixel is a palette color.
- `sheet-3d.png` (1x and 4x), `mockup-3d-computer.png`, `mockup-3d-phone.png` (laid on the empty arena as before),
  `compare-3d-reference.png` (Eric's picture's board beside the computer mockup), `arena-pieces-3d.json` (the four
  drawings as palette keys, the foot's pixel). The other four pieces would be built the same way from their 2D drawings.

## Round 3: gold accents and the bishop (Nov 2)

Eric: "The rook flat area on the top should be gold, horse mane gold, bishop helmet strip thing on top gold like in our
reference. This is so they have a sharper defined look but still maintain the design style."
- The rook: the flat tops of its battlements and the roof inside them gold (from the stands the roof is mostly hidden by
  the wall, so the tops carry it).
- The knight: the mane a flat-sided gold ridge down the back of the neck, one clean gold stripe from the side.
- The bishop (new, `wb`, `bb`): built straight in 3D on the shared base: a stem narrowing to a gold collar, an egg-shaped
  mitre with a small ball on top, and the slit across the mitre's front a gold strip from upper left to lower right.
