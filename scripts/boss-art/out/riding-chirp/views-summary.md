# Boss art (rider views): riding-chirp

- Model claude-opus-5-5, effort high, adaptive thinking. 13 turns, 9 renders.
- Spend: **$1.38** of the $3 cap (28 input, 80,101 cache-write, 670,379 cache-read, 42,156 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/riding-chirp/riding-chirp.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/riding-chirp/preview/idle.png, scripts/boss-art/out/riding-chirp/preview/move.png, scripts/boss-art/out/riding-chirp/preview/look.png, scripts/boss-art/out/riding-chirp/preview/front-idle.png, scripts/boss-art/out/riding-chirp/preview/front-move.png, scripts/boss-art/out/riding-chirp/preview/back-idle.png, scripts/boss-art/out/riding-chirp/preview/back-move.png, scripts/boss-art/out/riding-chirp/preview/views.png. Each look it took: scripts/boss-art/out/riding-chirp/looks/.

## Its notes

I've added the front and back views to Riding Chirp. The side view's code wasn't touched: the new functions sit after it, and the only edits there are the views field and two names added to the imports. Both new views use the side's IDLE/MOVE tables, so the timing is the same: idle is 10 frames over 1.94 s, and the move is 8 frames over 650 ms. The pawn's height and seat depth match the side too (pawnY −16 + bob, cut 69 − extra, pawnX 0, no tilt). I checked them in renders at 4x and town size, in red, yellow, cobalt and midnight, with white and black pawns. The last antenna change was checked in red only.

**Front (walking down):**
- His big round green head faces us, with two big shiny black eyes and their white glints, pink blush, a little smile and the yellow mouthparts.
- The two antennae rise from the top sides of the head, bow outward, then go up past the pawn.
- His chest has the painted collar band ("collar") just under the chin, with the gold bell hanging from it.
- His front legs are planted under his head, and the middle legs splay out wider and a little darker.
- Behind the head is the body seen end-on with its pale belly, and the blanket (the darker shade, with its trim stripe) draping over both sides. The flaps show edge-on as thin slivers on each side.
- The front of the saddle (the pommel) and its horn sit in front of the pawn's lower body. The back rim of the seat, a separate region called "cantle", peeks out on each side behind the pawn.
- The pawn sits clearly above and behind his head.

**Back (walking up):**
- His rounded green rump, with a pale belly and segment lines.
- The two folded wings meet down the middle of his back, their tips showing below the blanket.
- The blanket and trim drape over both sides, with the flap slivers.
- The back of the saddle is the main painted part ("saddle"), with stitching and a highlight. It hides the pawn below its chest.
- His two big striped jumping thighs are folded up on each side over the blanket edges, with the shins outside them.
- His thin middle and front legs show underneath.
- Both antenna tips curl up and out past the pawn, which is seen from behind.

**Idle (both views):**
- The same breathing bob as the side: the body and head sink about 1 unit while the feet stay planted, and the pawn moves with them.
- The near antenna twitches, then the far one.
- The front view blinks both eyes on the blink frame.
- One front leg lifts and sets down: on our right from the front, and a far front leg on our left from behind.

**Move (in place, dy matching the side's arc):**
1. Crouch, then a deeper crouch, with the pawn sinking a little and the antennae folding back.
2. Launch, 12 up: the legs push straight down and the thighs open. The head tips up slightly from the front and the rump dips slightly from behind.
3. Rising (24 up), then floating at the top (27 up) with the legs tucked.
4. Coming down (18, then 5 up) with the legs reaching out wide and the antennae swinging out.
5. Squat landing, which runs into the next crouch.

**Choices you might want to change:**
- **Front antennae:** they just skim the sides of the pawn's lower body and cross over the edges of the saddle. Giving them a wider bow would clear the pawn completely.
- **Thighs in the front view:** I left the big thighs out because they made it look spidery, so only six thin legs show. The thighs only appear in the back view.
- **Region names:** the back rim of the seat in the front view is its own region, "cantle", because it's drawn behind the pawn. The other parts keep the side's names: saddle, horn, flap, collar and blanket.
- **Horn and flaps:** the horn doesn't show from behind, since the pawn covers it, and the flaps only show as thin slivers in both views.
- **Seat depth from behind:** the back of the saddle hides the pawn a little higher up than the side view does. Lowering the saddle shape, E_CANTLE_B, would show more of the pawn.
