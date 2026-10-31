# Boss art (rider views): moon-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 6 turns, 4 renders.
- Spend: **$0.54** of the $3 cap (14 input, 42,183 cache-write, 134,033 cache-read, 15,199 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/moon-ride/moon-ride.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/moon-ride/preview/idle.png, scripts/boss-art/out/moon-ride/preview/move.png, scripts/boss-art/out/moon-ride/preview/look.png, scripts/boss-art/out/moon-ride/preview/front-idle.png, scripts/boss-art/out/moon-ride/preview/front-move.png, scripts/boss-art/out/moon-ride/preview/back-idle.png, scripts/boss-art/out/moon-ride/preview/back-move.png, scripts/boss-art/out/moon-ride/preview/views.png. Each look it took: scripts/boss-art/out/moon-ride/looks/.

## Its notes

I added front and back views to Moon's Ride. The side view is untouched: all the new code sits after it, and the only change to the draft is the new `views` field.

**Shape (both views):** the moon-board seen end-on is a wide, level sliver with pointed tips, from x 6 to 94 (about 91 units with its outline, inside the 125 limit). Its top is the lighter deck surface (Region "deck", seen at 30°). Under that is the crescent's curved belly (Region "moon"), with the same darker belly shade, pale rim highlight and faint craters as the side. The soft ground shadow is narrowed to match. The pawn sits centred at the same height as on the side (pawnY −18, cut 88), with its base resting on the deck and the deck's near edge drawn in front of it.

**Front:** a sleepy face on the belly in the side's fixed colours: two closed half-lid eyes with tiny highlights, a small smile and two pink blushes. On dark colours the face gets the same pale cream edge as the side. The face reads at town size.

**Back:** the same sliver with no face, a few craters and a lighter deck edge. The pawn hides most of the deck behind it; only the tips show past its sides.

**Idle (8 × 260 ms, same as the side):** the board and pawn float up about 2.6 units and settle back, and the shadow shrinks as they rise. Five twinkling stars on offset phases, placed to suit the narrower shape.

**Move (6 × 100 ms, same as the side, dx 0, loops cleanly):**
- **Bob:** the side's small height bob, plus a tiny sideways roll (0, 0.7, 1.1, 0.6, −0.2, −0.5°) that the pawn shares.
- **Front dip:** the nose dips toward us following the side's lean curve, so more deck top shows and the face slips down slightly. Three sparkles drift up and inward behind the pawn, as if left behind, with two tiny dots.
- **Back dip:** the tail tips toward us, so less deck shows. Three small sparkles drop and spread outward from the tips toward us, shrinking and fading, with two tiny dots.

**Choices you might want to change:**
- The front shows two eyes and two blushes, where the side profile shows one eye; this read as a face better than a single eye.
- End-on, the board looks a little like a shallow bowl, because the pawn covers the far deck edge. I kept the belly shallow (about 15 units, like the side) and the tips pointed to keep it reading as a sliver.
- On midnight the board is dark on the dark background, the same weakness as the side view.
- The fading back sparkles look a bit grey against the ground when they're faint.
- The sideways roll in the move is my own addition; set ROLL to zeros if you want only the bob and dip.
