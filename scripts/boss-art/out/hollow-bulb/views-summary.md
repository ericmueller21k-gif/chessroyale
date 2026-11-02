# Boss art (rider views): hollow-bulb

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.66** of the $3 cap (16 input, 43,447 cache-write, 182,020 cache-read, 20,384 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-bulb/hollow-bulb.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/hollow-bulb/preview/idle.png, scripts/boss-art/out/hollow-bulb/preview/move.png, scripts/boss-art/out/hollow-bulb/preview/look.png, scripts/boss-art/out/hollow-bulb/preview/front-idle.png, scripts/boss-art/out/hollow-bulb/preview/front-move.png, scripts/boss-art/out/hollow-bulb/preview/back-idle.png, scripts/boss-art/out/hollow-bulb/preview/back-move.png, scripts/boss-art/out/hollow-bulb/preview/views.png. Each look it took: scripts/boss-art/out/hollow-bulb/looks/.

## Its notes

I've added the front and back views to Hollow's Bulb. I only added code after the side's functions and added the `views` field to the export (plus the `RiderViewDraft` type import), so the side view's code is untouched. Both new views use the side's bob, glow, timing and pose values: pawnX 0, pawnY −24, cut 74, dx 0, 8 idle frames at 300 ms and 8 move frames at 90 ms. Both are about 55 units wide (x 22.5–77.5), well under the 125 limit, and stand on the same ground line as the side, with the shadow at y 96.

**Front (walking down):** the bulb seen from its glass end, as a big round glowing ball painted in the item's color. It's the same "glass" region as on the side, so blemishes and shine behave the same. Its top is a little broader where the belly runs back behind it, and that's what the pawn sits on: the glass hides the pawn's cut line cleanly, so it reads as sitting on top. Inside is the same warm yellow-white glow, brightest at the center, with the gold zigzag filament seen end-on and its two support wires running back. There's a white highlight streak and dot on the upper right, a faint reflection along the bottom, and the violet shadow with the warm ground glow below. I left out the silver cap: from above it would be hidden by the belly anyway.

**Back (walking up):** the round ridged silver cap faces us at the center: the collar ring, the screw with two darker ridge rings, highlights and the dark tip. The glass rim in the item's color shows all round it, with the warm glow shining out round the cap as a halo and a bright ring. The dark green cord hangs from the tip like a tail with one small curl, and the same shadow and glow sit below.

**Idle (2.4 s):** the bulb floats up 1.5 units and settles back. The glow pulses dim → bright → dim, and the filament on the front goes from gold to pale at its brightest. The ground glow brightens with it and the shadow shrinks a little as the bulb rises. On the back, the cord sways ±4°.

**Move (720 ms, in place):** one smooth rise of 2.25 units and settle per square. The pawn rolls ±1° side to side and the glow stays steady and warm. On the back, the cord swings ±12° side to side, lagging the bob, and the last frame leads straight into the first.

I rendered all three views together, the back's move frame by frame and the front's idle, at 4x and at town size in every color, and both new views read clearly. I haven't run the final pixel check of the side view against the original; `done` runs it now.

**Choices you might want to change:**
- **Glass shape (front and back):** the top is wider than a true round ball so it hides the pawn's flat cut line, which makes a slight waist that can look a little like a jar.
- **Cord placement (back):** the cord hangs over the lower half of the cap. A side swing instead would show the cap's rings more fully.
- **Glow strength (back):** while moving, the halo round the cap is fairly strong and makes the rim look lighter (red looks pinkish). Lowering the halo's opacity would keep the item's color stronger.
