# Boss art (item): folio-crown

- Model claude-opus-5-5, effort medium, adaptive thinking. 7 turns, 4 renders.
- Spend: **$0.33** of the $3 cap (16 input, 24,441 cache-write, 78,875 cache-read, 9,712 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio-crown/folio-crown.tsx.
- Previews: scripts/boss-art/out/folio-crown/preview/frames.png, scripts/boss-art/out/folio-crown/preview/look.png. Each look it took: scripts/boss-art/out/folio-crown/looks/.

## Its notes

Folio's Paper Crown is a legendary head item (attach 25, frame [30, -9, 40, 36.5]). It's a zigzag paper crown with five folded points; each point has a lighter left face and a shaded right face split by a thin crease. Two shaded points sit behind the front ones. The band is folded over with a crease along its top and a small gold diamond in front. Faint ink squiggles (a darker shade of the item's color) run across the points and the band. The paper is the painted part, so the crown takes whatever color the item rolls.

On top, sitting on the center point, is a tiny origami crane in Folio's warm cream paper. It has a beak, a dot for an eye, a pointed tail, a gold leading edge on the front wing and a short blue squiggle on its body. It doesn't go above the cap: its highest point is about y -3.2.

I only looked at a few colors up close (red, cobalt and emerald, on white and black pawns), and the details are small at 4x. Every color shows in the strip at phone size, and it reads at 60 px.

The motion is a 10-frame loop of about 3.2 s:
- **Rest (1 s):** the wings are folded down, almost flat.
- **Lift (about 0.5 s):** the wings rise smoothly into a tall, almost closed V.
- **Hold (about 0.8 s):** the wings stay up.
- **Fold back (about 0.9 s):** the wings come down again over three short frames and a slower last one.

Choices you might want to change:
- The squiggles are a darker shade of the crown's color, not Folio's blue ink. The blue only appears on the crane.
- The crane is drawn quite small (scale 1.15). It could be a little bigger if you want it to stand out more.
- With the wings up, the crane plus its neck and tail make a spiky little cluster at 4x.
- The gold diamond on the band is a stand-in for Folio's red stamp. The red stamp would be an easy swap.
- The description reads: "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed."
