# Boss art: house-folio

- Model claude-opus-5-5, effort high, adaptive thinking. 13 turns, 6 renders.
- Spend: **$1.59** of the $20 cap (28 input, 117,592 cache-write, 508,054 cache-read, 44,941 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-folio/house-folio.ts.
- Previews: scripts/boss-art/out/house-folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-folio/looks/.

## Its notes

The house is drawn, in scripts/boss-art/out/house-folio/house-folio.ts. One thing to check first: I couldn't open Folio's own file (folio.ts) or its brief, because they're outside the folders the tools let me read. So I didn't import FOLIO_PALETTE; I picked the paper, outline and gilt colours myself. The only exact colours from Folio are the three ink blues you gave me. If Folio's real paper or gold is different, swap the values in the palette at the top of the file.

I looked at the idle frame by frame at 3x, 4x and 5x on both backgrounds, and at phone size beside Hollow Peak, the Botanical Garden, Smudgy's Gallery and the tiger.

The house
- View and size: the frame is 144 x 128 with the foot at (72, 124). The pointed gable end faces you and the side runs back to the upper right. It's about the size of the Botanical Garden, and lighter in weight than the other homes because it's pale paper.
- Folded paper: a fold runs down the middle of the gable, lit on the left half and mid on the right. The side wall is shaded. The roof face has a diagonal crease (one bright pixel line) splitting it into a lit and a mid half. The roof's front edge folds under in shade beside the gable, and the roof throws a darker band onto the top of the side wall. The front corner catches a line of light.
- Handwriting: short broken lines in the three ink blues, with a letter rising here and there, about 2 to 5 lines per face. The lines on the roof and side wall slant back with the face. In an earlier try the lines were solid dashes and read like siding, so I broke them up and cut how many there are. At phone size they're a faint texture now, not lines.
- Gilt runs along the ridge, with a few brighter glints, and down the roof's front edges.
- Door: a pointed opening with an amber glow inside. The door is a folded flap hinged on the left and swung a little open toward you, with a gilt pull. A faint pool of lamplight lies on the ground in front.
- Seal: a 9 x 9 vermilion stamp above the door, with the pawn knocked out to the paper.
- Cranes: three small paper cranes hang from the side eave on thin threads, at different lengths. Each has a gold beak pixel, and the middle one faces the other way.
- By the door: a stack of folded pages with a little folded tent on top, and a closed blue book with gilt corners.
- Sign: a blank folded-card board in a wooden frame on two posts, front right, with gilt nails. It's exported as HOUSE_FOLIO_SIGN.
- Not in the design: I added four small grass tufts to help it sit on the ground like the other homes.

Idle (6 frames x 320 ms, loops)
- Frames 0-5: each crane sways sideways (0, +1, +1, 0, -1, -1 pixels), and the three move out of step with each other. Nothing else moves.
- Frame 3: the lamplight and its glow on the ground dim once, then come back.

Choices you might want to change
- Paper colours are guesses (see above).
- The roof's lit half: the half of the roof by the ridge is lit, so the house reads very pale overall.
- Sign placement: the sign sits front right and hides the bottom of the side wall.
- Crane spot: the cranes hang from the side eave, not the front.
- Grass tufts: delete them if they don't belong.
- Lamp flicker: it's a single dimmer frame.
