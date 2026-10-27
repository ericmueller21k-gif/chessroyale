# Boss art: house-folio

- Model claude-opus-5-5, effort high, adaptive thinking. 20 turns, 12 renders.
- Spend: **$2.01** of the $20 cap (42 input, 119,086 cache-write, 1,228,686 cache-read, 58,658 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-folio/house-folio.ts.
- Previews: scripts/boss-art/out/house-folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-folio/looks/.

## Its notes

I revised Folio's Folded House (house-folio) against all seven review points. The only animation is idle. I checked it at 3x to 8x on both backgrounds and at phone size beside house-gardener, house-smudgy and house-hollow, and the render tool gave no warnings.

**Size:** the frame is now 144 x 136 (it was 128) so the crane on the roof fits, with the foot at (72, 132).

**What changed:**
1. **Folio's colors:** the file has its own copy of Folio's colors, value for value: the paper A–E, the outline k, ink i/j/l, gilt G/H/g/o/q and the seal v/w. The cool whites and grey-lavender are gone, and the shaded side is Folio's D, with E in the eave's shadow and under the crease. The lamplight takes its brightest and gold tones from Folio's gilt, plus two warm ambers. The book cover is Folio's ink blue (j/l), and the threads are ink blue (l).
2. **Folded paper:**
   - **Gable:** a kite-shaped flap folded down over the wall like an envelope flap, with the seal on its point over the door. The left half is lit and the right half mid, with a lit fold down the middle, a crease where it bends at the eave, a darker pixel along its cut edge and its shadow on the wall below.
   - **Roof:** a pleated sheet of three pleats, each a lit strip with a highlighted crest and a shaded strip with a dark valley. The pleats make a zigzag eave, with a thickness line under it.
   - **Walls:** the shaded side has a diagonal crease with a lit edge, and the strip below it is darker. Both walls have a hem folded up along the bottom.
   - **Uneven paper:** the front's right half sits 1 px higher, and the flap's point is half a pixel off center.
3. **Crane on the roof:** about 20 x 16 px, drawn from Folio's own rest pose at a quarter size. It has a V of wings (the near wing with a gilt leading edge, the far wing behind and shaded), a long neck to a folded head with a gold beak, and a pointed tail with a gold tip. It perches on a short gilt pin on the ridge like a weathervane, and it reads as a crane even at 1x.
4. **Hanging cranes:** 9 px wide, each with a V of wings, a head with a gold beak, a tail point and a dark keel. They still sway out of step, and the middle one faces the other way.
5. **Writing:** 1-px cursive lines with rounded humps every 3–4 px and a rare taller loop. There are three lines on the flap's lit half, two on its mid half, three on the wall left of the door and two on the right. It uses #8a93b8 on lit paper and #717898 on mid, with none on the shaded side or the roof (on the narrow pleats it broke up into specks).
6. **Weight:** stronger lit/mid/shaded contrast, a dark E shadow band under the eave on the side wall, the dark lower half of the side, and a ground shadow like the other homes'.
7. **Kept:** the door flap with its gilt pull and the lamplight with its glow on the ground, the seal (now on the flap's point), the page stack and book, and the idle (cranes sway, and the lamp dims once in frame 3). The sign board is smaller (42 x 20, a folded-card face) so it covers less of the side wall; HOUSE_FOLIO_SIGN is updated to match. The grass tufts are gone, since the neighboring homes don't have them.

**Idle, beat by beat:** 6 frames at 320 ms each, looping. The three hanging cranes step through 0, +1, +1, 0, −1, −1 px, each starting at a different point. In frame 3 the lamplight and its glow on the ground dim slightly. Nothing else moves.

**Choices you might want to change:**
- **Ink:** at 3x the hump lines can still look a bit like little waves. Making them sparser or fainter is one setting.
- **Pleats:** I used three wide ones because four looked like corrugated tin; it's one number (PLEATS).
- **Side wall:** the dark lower triangle adds weight but is the darkest area on the house. Switching it back to D would lighten the house.
- **Imports:** the file copies Folio's colors rather than importing them (Folio's file still sits in the scripts folder), so they would need re-syncing if Folio's palette changes. It also imports the shared home pieces from kit.ts as the home brief says, which goes beyond the two imports in the general instructions.
