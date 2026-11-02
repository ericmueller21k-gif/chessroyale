# Boss art (rider views): puddles-mower

- Model claude-opus-5-5, effort high, adaptive thinking. 9 turns, 5 renders.
- Spend: **$1.04** of the $3 cap (20 input, 65,808 cache-write, 361,060 cache-read, 32,025 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/puddles-mower/puddles-mower.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/puddles-mower/preview/idle.png, scripts/boss-art/out/puddles-mower/preview/move.png, scripts/boss-art/out/puddles-mower/preview/look.png, scripts/boss-art/out/puddles-mower/preview/front-idle.png, scripts/boss-art/out/puddles-mower/preview/front-move.png, scripts/boss-art/out/puddles-mower/preview/back-idle.png, scripts/boss-art/out/puddles-mower/preview/back-move.png, scripts/boss-art/out/puddles-mower/preview/views.png. Each look it took: scripts/boss-art/out/puddles-mower/looks/.

## Its notes

I've added the front and back views to Puddles's Mower. The side view is unchanged: I only added new functions and the `views` field (plus `RiderViewDraft` in the import). I checked both new views at 4x and at town size, with white and black pawns and in every colour.

**Back view (going up the screen).** The pawn sits in the middle, seen from behind, its lower part hidden in the pink seat. In front of it is a short pink seat back with the brass flower holder on its right edge. The flower stands up beside the pawn's head. Below that is the canvas grass bag on its steel frame, with seams and a highlight. The rear panel ("body") is painted, and so are the two dome fenders ("fender") over the big end-on back tyres, each with a brass hub showing at its outer side. The chrome exhaust pipe opening sits low and a little left, under the bag.

**Front view (coming down the screen).** The pawn sits centred behind the steering wheel, with its head and upper body clear. Behind the pawn are the pink seat back and the flower, top left. In front of it are the rounded painted hood ("hood") with five grille slots and a round cream headlight, and the seat cushion. The body sides ("body") and the dark mower deck show beside the hood. The two small front tyres sit low, outside the hood. The big back tyres and fenders sit a little higher and further out, because they're further away. The painted parts and Region names are the same as on the side.

**Idle** (12 frames × 110 ms, same as the side): the same chug jiggle every other frame, and the pawn bobs half a step behind it. The flower sways gently sideways. From frame 5 to 9 one grey puff rises and fades. From behind it comes out of the pipe over the bag; from the front it rises from behind the right back fender.

**Move** (8 frames × 70 ms, dx 0, same as the side):
- The mower bounces with the chug and the pawn rolls about ±1° side to side.
- The tread marks roll 45° a frame on the back tyres and 67.5° on the front ones, matching the side. From the front they roll down toward us; from behind they roll up and away. The loop joins cleanly.
- Puffs leave the pipe at frames 0 and 4.
- Each frame, lime clippings spray out low to the left and right from behind the back wheels, land and fade.
- The flower nods along with the side's nod pattern.

**Choices you might want to change:**
- **Seat back height:** the side's seat back reaches y 25. In the back view I lowered it to y 34.5 and made it narrower, so the pawn's head and shoulders show; at full height it hid most of the pawn. In the front view it's at y 23, behind the pawn.
- **Single headlight:** the front has one round headlight in the middle above the grille, since the side shows just one.
- **Puffs stay with the mower:** in these two views the puffs rise in place instead of being left behind on the ground as they are on the side.
- **Side placement:** the exhaust is on the mower's left and the flower on its right, so they swap sides on screen between the front and back views.
