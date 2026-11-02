# Boss art (rider): cheetah-shoes

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 6 renders.
- Spend: **$0.66** of the $2 cap (24 input, 42,774 cache-write, 255,407 cache-read, 19,955 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/cheetah-shoes/cheetah-shoes.tsx.
- Previews: scripts/boss-art/out/cheetah-shoes/preview/idle.png, scripts/boss-art/out/cheetah-shoes/preview/move.png, scripts/boss-art/out/cheetah-shoes/preview/look.png. Each look it took: scripts/boss-art/out/cheetah-shoes/looks/.

## Its notes

I made the kick-back steeper and checked the run again in oceanic. That shoe now flips up behind the pawn with its sole showing, and it reads better. It still overlaps the pawn's lower-left a little at 4x (frames 0 and 3), because the shoes are about as long as the pawn's base. I looked at idle and the run at 4x and at town size in red, cobalt, emerald and oceanic, plus every color in the swatch row. The renders gave no warnings, and the widest run frame stays well under 125 units. Only the side view is drawn: no front or back views and no trail mark, since the brief didn't ask for them.

**What it is:** Cheetah Shoes (mythic, side view). Two chunky running shoes with their toes pointing right. The pawn stands in them with its whole body showing, lifted 15 units, and only the very bottom of its base hidden (cut 86). The near shoe sits a little ahead and in front of the pawn; the far one sits a little behind, higher and slightly shaded. Each shoe is tan with black spots, a white midsole and a collar opening. The item's color goes on the soles (with tread marks), the laces, a bow on the tongue and a heel tab, so it reads in every scheme. Description: "Spotted, laced and twice as fast. Blitz says the spots are just for show; the speed is not."

**Idle (8 frames, about 1.15 s), impatient:**
1. Rest.
2. Toe up.
3. Tap.
4. Toe up.
5. Tap (the near shoe taps twice, pivoting on its heel).
6. A pause.
7. Both heels rise onto the toes and the pawn bounces up 3.
8. It drops back down.

**Move (6 frames × 70 ms, dx 0 to 100):** the shoes run half a cycle apart. Each goes through heel strike, flat, heel-up push-off, kick back (sole up behind), swing through and reach forward. On the run the far shoe strides out ahead of the base so its toe shows. The pawn leans forward 12° and bobs twice per square, low each time a foot lands. Three white speed lines with dark outlines move along behind its back, and a tan dust puff kicks up at whichever foot just pushed off. Both travel with the ride, so nothing stays on the ground.

**Things you might want to change:**
- **Kick-back overlap:** shorter shoes would stop the kicked shoe crossing the base at 4x.
- **Far shoe at rest:** in idle only its heel and tab peek out on the left.
- **Ideas I left out:** the cheetah print and midsole are fixed colors as the brief asked. I didn't add a teal stripe or a lightning-bolt logo, which I considered.
