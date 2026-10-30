# Folio's Paper Crown (a head item, Boss Series Crate #1)

Draw **Folio's Paper Crown**, a crate hat. Folio is the game's paper crane boss (the references): an origami crane folded
from a single page of handwriting, warm cream paper, faint lines of ink.

- **A folded paper crown** on the pawn's head (its brim at y 25: attach 25): crisp folded points, flat faces in two tones
  each (light from the top left), clean crease lines, a few faint handwriting squiggles on it like Folio's page.
- On top, in the middle, **a tiny origami crane** (Folio in small) that **slowly folds and unfolds its wings**: the
  wings lift up, hold, and fold back down (about 3 to 4 seconds a loop, 8 to 12 frames). It must rise no higher than the
  cap (y -9 on the pawn's square).
- The crown's paper is the painted part (the item's color: so it's colored paper); the crane stays Folio's warm cream
  with a touch of gold (#f2c14e) at most. The ink squiggles are a soft shade.
- "Yeah, this thing is sweet": delicate, elegant, a little magical.
- Tier: legendary. Name it "Folio's Paper Crown", id "folio-crown".

## Second try: what read badly the first time
The first drawing (scripts/boss-art/out/folio-crown/folio-crown.tsx: you may read it) has three problems on the pawn:
- **It floats:** there's a gap between the crown and the pawn's head. The pawn's head top is y 20 (center y 29, radius
  9). With attach 25, the line y 25 in your drawing lands on the head's y 25, so the crown's bottom edge (its brim) must
  be at y 25 in your drawing, its band wrapping the head from about y 18 to y 25, sitting down on it like the Little
  Crown (Items.tsx ~677-691) and the Party Hat.
- **The crane is cut off:** on the pawn nothing may rise above y -9 (after the shift); the crane's lifted wings must
  stay under that in every frame. Make the crown lower and the crane sit down on its middle.
- **The crane is a smudge at 60 px:** make it simpler and bolder: a clear crane silhouette (a body, a neck and head up
  to one side, a tail point, two wings) a little bigger, with an outline, so at 60 px it reads as "a little bird on the
  crown", and its wing lift is a clear change between frames.
- Keep the name and id ("folio-crown").
