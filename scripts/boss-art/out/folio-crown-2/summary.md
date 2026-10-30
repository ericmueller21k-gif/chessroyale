# Boss art (item): folio-crown-2

- Model claude-opus-5-5, effort high, adaptive thinking. 13 turns, 6 renders.
- Spend: **$0.75** of the $2.65 cap (28 input, 46,834 cache-write, 342,130 cache-read, 22,483 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio-crown-2/folio-crown-2.tsx.
- Previews: scripts/boss-art/out/folio-crown-2/preview/frames.png, scripts/boss-art/out/folio-crown-2/preview/look.png. Each look it took: scripts/boss-art/out/folio-crown-2/looks/.

## Its notes

Folio's Paper Crown (legendary head item, attach 25) is drawn and rendered, and the three problems from the first try are fixed. The renderer gave no warnings for edge spill or cap height.

**What it is:** a folded paper crown in the item's color, with Folio standing on top as a tiny cream origami crane.
- **Crown:** a zigzag row of five folded points behind a folded-over band.
  - **Points:** each one has a light left face and a darker right face, with a faint crease line down the middle.
  - **Band:** a lighter top fold strip, its right half in shadow, two rows of handwriting squiggles and a small gold diamond in the middle.
  - **Squiggle colour:** a darker shade of the paper colour, or a lighter one when the colour is dark (Midnight, for example), so they stay soft but visible in every scheme.

**Fixes from the first try:**
- **It no longer floats:** the band runs from y 18.5 down to the brim at y 25, curving to about y 27 in the middle, and it sits right on the head on both the white and black pawn.
- **The crane isn't cut off:** it sits low, in the middle dip of the crown. Its highest point, with wings lifted, is about y -6.5, under the y -9 cap.
- **The crane reads at 60 px:**
  - It's a simpler, bolder outlined silhouette: a body shaped like a folded paper boat, a thick neck rising left to a head with a beak, a tail point up to the right, and two big triangle wings.
  - The wings are cream with a tan shaded face, a gold leading edge and a couple of blue ink squiggles.
  - At 60 px it reads as a little bird on the crown. Wings down against wings up is a clear change between frames.

**Motion:** 9 frames, a 3.25 s loop, eased.
1. Wings rest folded back along the body (1.2 s).
2. They lift into a V over three quick frames (170 ms each).
3. They hold up (750 ms).
4. They fold back down over four frames (about 0.8 s).

**Choices you might want to change:**
- **Id:** the file uses "folio-crown-2", the id this task gave me. The brief asked to keep "folio-crown", so rename it when it replaces the first try.
- **Crane outline width:** I used 1.4, thinner than the 1.6 kit default for small parts, so the cream shows through on the small pieces.
- **Crane size:** it could be a touch bigger, but the cap only leaves about 2 units of headroom when the wings are up.
- **Description:** "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed."
