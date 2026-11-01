# Boss art (rider views): cheetah-shoes

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.66** of the $1.5 cap (16 input, 46,382 cache-write, 189,720 cache-read, 19,588 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/cheetah-shoes/cheetah-shoes.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/cheetah-shoes/preview/idle.png, scripts/boss-art/out/cheetah-shoes/preview/move.png, scripts/boss-art/out/cheetah-shoes/preview/look.png, scripts/boss-art/out/cheetah-shoes/preview/front-idle.png, scripts/boss-art/out/cheetah-shoes/preview/front-move.png, scripts/boss-art/out/cheetah-shoes/preview/back-idle.png, scripts/boss-art/out/cheetah-shoes/preview/back-move.png, scripts/boss-art/out/cheetah-shoes/preview/views.png. Each look it took: scripts/boss-art/out/cheetah-shoes/looks/.

## Its notes

I added front and back views to Cheetah Shoes. The side view's code is untouched; the new code sits after it, and the `views` field was added with small edits. I looked at all three views together, the front run in oceanic and the back run in emerald with a black pawn, at 4x, at town size and in every color. The renders gave no warnings.

**What each view shows:** In both views the two shoes stand side by side at x 35.5 and 64.5, about 58 units across, on the side's ground line (y 95). The pawn sits in them at the same height and cut as the side (pawnY -15, cut 86), with only the bottom of its base hidden.

- **Front:** Each toe shows its tan, spotted toe cap with a seam line, the white midsole and the painted sole's front edge with tread marks. Above the toe are three painted laces on a darker strip, a painted bow, and the tongue sticking up behind them.
- **Back:** Each heel shows the spotted heel counter, a tall painted heel tab, the collar rim, the white midsole and the painted sole's back edge.
- **Painted parts:** They use the same Region names as the side (near/far-sole, -laces, -bow, -tab). The near shoe is the pawn's right foot: on our left from the front, on our right from behind.

**Idle (8 frames, the side's timing):**
- Frames 0 and 2: rest.
- Frames 1 and 3: the near shoe taps its toe. From the front the toe lifts and a sliver of the sole's underside shows; from behind it's a tiny twitch.
- Frames 4 and 5: rest, then a pause.
- Frame 6: both heels rise and the pawn bounces up 3. From behind, the heels lift and the sole's underside shows.
- Frame 7: it drops back down.

**Move (6 × 70 ms, in place, dx 0):** It follows the side's run with the shoes half a cycle apart. Each shoe goes through heel strike, flat, push-off, kick back, swing through and reach. The pawn bobs as on the side (low each time a foot lands) and leans about 3° toward the planted foot.
- **Back:** The kicked shoe flips up toward the camera, a little bigger, showing its sole's underside and tread.
- **Front:** The kicked shoe drops behind the pawn, drawn smaller and shaded, so only its sole and midsole peek out under the base. On the reach and heel strike the toe tips up, showing a little underside.
- **Dust:** A tan puff kicks out beside the pushing foot and moves with the ride. Nothing is left behind, and there are no speed lines in these views.

**Choices you might want to change:**
- **Kicked-back shoe from the front:** it shows only as a small sliver under the base. If it reads too faintly, it could stay in front of the pawn instead.
- **Toe tap from behind:** it's nearly invisible; from behind the heel-rise at the end does most of the work.
- **Spots:** they're placed by hand and mirrored for the other shoe.
- **Trail mark:** there still isn't one.
