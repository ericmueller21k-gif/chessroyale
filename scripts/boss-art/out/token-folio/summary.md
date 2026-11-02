# Boss art: token-folio

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.39** of the $1 cap (16 input, 24,425 cache-write, 92,852 cache-read, 12,667 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-folio/token-folio.ts.
- Previews: scripts/boss-art/out/token-folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-folio/looks/.

## Its notes

The Folio token is done, at scripts/boss-art/out/token-folio/token-folio.ts. It exports TOKEN_FOLIO with id "token-folio" and the name "Folio token". The frame is 40 x 40 with a transparent background, meant to be shown at 2x. I rendered it on both dark and light backgrounds and looked at every idle frame, plus the small phone-size views.

**The coin:** the rim, rivets, dark inner ring, navy middle, gold halo and glint code are copied unchanged from token-blitz. Only the face layers are new.

**The face (Folio):** flat paper faces in Folio's own colours, light from the top left, each piece outlined in k and cut off by the inner ring. Back to front:
- **Wing:** a tall wing fold rising behind on the right, its tip cut off by the ring. Its left (leading) edge is gilt, 2 px wide and lighter near the tip. It has a darker crease, a shaded right face, and the small vermilion seal (a 4 x 4 square with a tiny cream pawn mark) on its lit face.
- **Body:** a low shoulder fold along the bottom, mostly hidden behind the ring.
- **Neck:** a slender neck leaning toward the head, with a lit left face and a shaded right face.
- **Head:** a folded head with the beak pointing left. It has a crease along the beak, the back of the head shaded, a highlight on the top edge, and a dark 2 x 2 eye with a brow.

Short blue-black ink dashes on the wing, neck and body stand for the page's lines. They are strokes only, never letters.

**Idle, beat by beat** (same timing as Blitz): the glint steps a quarter turn round the rim per frame, at -135°, -75°, -15° and 45°, 180 ms each. Then there is a 1400 ms rest, then a 150 ms blink: the eye's top row turns to paper, leaving a thin closed line. Nothing else moves.

**Choices you might want to change:**
- **Seal and wing:** the seal sits low on the wing (about x 25–28, y 24–27) so the gilt edge doesn't cover it. At 1x the pawn mark inside it is barely visible; it reads as a red stamp.
- **Shoulder fold:** it is kept low so the head and neck stay the main shape. Raising it (the BODY polygon) would fill more of the bottom.
- **Silhouette:** at the smallest size the head and neck read as a stem-and-head T beside the wing. The gilt edge, the seal and the eye are what make it Folio. A sharper, longer beak could make the crane read more clearly if you want it.
- **Outline colour:** I used the coin's outline k (#2a1c14) for the paper too, not Folio's own #2b2330, so it matches the series.
