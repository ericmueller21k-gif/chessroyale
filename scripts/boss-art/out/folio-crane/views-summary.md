# Boss art (rider views): folio-crane

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 7 renders.
- Spend: **$0.89** of the $3 cap (24 input, 58,622 cache-write, 412,533 cache-read, 25,818 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio-crane/folio-crane.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/folio-crane/preview/idle.png, scripts/boss-art/out/folio-crane/preview/move.png, scripts/boss-art/out/folio-crane/preview/look.png, scripts/boss-art/out/folio-crane/preview/front-idle.png, scripts/boss-art/out/folio-crane/preview/front-move.png, scripts/boss-art/out/folio-crane/preview/back-idle.png, scripts/boss-art/out/folio-crane/preview/back-move.png, scripts/boss-art/out/folio-crane/preview/views.png. Each look it took: scripts/boss-art/out/folio-crane/looks/.

## Its notes

I've added the front and back views to Paper Crane. The side view's code is untouched; all the new code sits after the side's functions, plus a new `views` field. I checked both views in every color, and with both the white and the black pawn.

**Back (walking up):** the folded tail points at us as a diamond in the middle of the body. The body is a keel, lit on the left half and 15% darker on the right, with a center crease, a light highlight along the top rim and handwriting squiggles. Both wings rise in a V on either side of the pawn: the left one is lit with a highlight, the right one is darker like the side's far wing. The neck and the small folded head peek out to the right of the pawn's head. The pawn sits centered over the soft shadow, at the same height and cut as on the side (pawnY −10, cut 72, pawnX 0).

**Front (walking down):** the long neck rises from the chest toward us, lit on the left and shaded on the right. The folded head sits on the pawn's chest, below its face: a lit crown with two black dot eyes and the beak folding down toward us. The body, wings and shadow match the back view. The red seal sits on the right wing, which is the crane's near wing.

**Region names** are the side's own (body-lit/shaded, tail-top/under, neck-lit/shade, head-top/chin, nearwing-/farwing-back/fold), so blemishes and shine behave alike. Fixed colors match too: the red seal and the black eyes.

**Idle** (8 × 220 ms, the side's timing):
- the same slow 2-unit bob;
- the wings lift a little and settle;
- on frames 4–6 the head dips: it drops a few units toward us on the front, and drops behind the pawn on the back.

**Move** (8 × 75 ms, dx 0, the side's dy):
- Frames 1–3: both wings sweep out and down along an arc while the crane rises 6 units. At the bottom they hang beside the body. The roots turn with them so the wings keep their breadth.
- Frames 4–6: the wings sweep back up while it glides down.
- Frame 7: it settles, leading back into frame 0.
- The shadow stays on the ground and shrinks and fades as the crane rises; the head lifts slightly.

**Choices you might want to change:**
- In the back view the head peeks out to the right of the pawn's head rather than over it, so it doesn't look like a horn on the pawn. It's only a small beak at town size.
- On the front, the head is pulled low onto the pawn's chest so the pawn's face stays clear. That foreshortens the neck a lot.
- The pawn doesn't tilt in the front and back views. The side's tilt tips it backward and forward, which wouldn't show as a sideways roll.
- At the bottom of the downstroke the wings stick out fairly flat, out to about x −4 and 104, to stay inside the frame.
