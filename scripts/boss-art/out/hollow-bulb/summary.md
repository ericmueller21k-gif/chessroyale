# Boss art (rider): hollow-bulb

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.63** of the $6 cap (18 input, 41,452 cache-write, 173,460 cache-read, 19,209 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-bulb/hollow-bulb.tsx.
- Previews: scripts/boss-art/out/hollow-bulb/preview/idle.png, scripts/boss-art/out/hollow-bulb/preview/move.png, scripts/boss-art/out/hollow-bulb/preview/look.png. Each look it took: scripts/boss-art/out/hollow-bulb/looks/.

## Its notes

I've drawn Hollow's Bulb (id "hollow-bulb", mythic), side view only, as the brief asked. I rendered idle (red, midnight with a black pawn, pearl) and move (emerald, yellow). It reads at town size in every color.

**What it is:** a fat old-style Christmas bulb lying on its side and floating. The round glass belly faces right and a ridged silver screw cap sits at the back (left). A dark green cord comes out of the cap and makes one curl behind it like a little tail. On the ground underneath is a soft violet shadow, a nod to Hollow's darkness, with a warm glow around it. The pawn sits upright on top of the glass just right of the cap (pawnX 10, pawnY −24, cut 74). Only its base is hidden behind the bulb's top curve, so it reads as sitting on it, not cut in half.

**Colors:** the glass is the item's color: one painted region, with blemishes and shine. Inside it, the glow is a pale warm yellow-white core fading out to a lighter tint of the item's color. It has a little gold zigzag filament on two thin support wires, and it reads in all nine colors, pearl and midnight included. There's a white highlight streak and dot on the upper right of the glass and a faint reflection along the bottom. The cap is silver and the cord dark green; both are fixed colors.

**Width:** 123 units at most, cord swing included (x about −14 to 109), so within the 125 limit. Height runs from about y −9 at the top of the pawn's head on the highest bob, to the shadow at y 96–100.

**Idle (8 frames × 300 ms = 2.4 s):**
- The bulb floats up 1.5 units and settles back.
- The glow pulses dim → bright → dim. It's brightest at the top of the float, where the light grows and the filament goes from gold to pale.
- The ground glow brightens with it, the shadow shrinks a little as the bulb rises, and the cord sways a few degrees.

**Move (8 frames × 90 ms = 720 ms, dx 0 → 87.5 in steps of 12.5):**
- One smooth bob per square: it rises 2.25 units and comes back down.
- The cord swings with the motion: it droops low as the bulb rises, then flicks up as it sinks and catches up by the last frame. The last frame flows straight into the next move's first.
- The pawn sways a little (±1.5°) and the glow stays steady and warm.

**Choices you might want to change:**
- **Cap color:** silver; brass would be warmer but would blend into yellow glass.
- **Glow color:** a fixed warm yellow-white core rather than a second color the player rolls (it isn't colors: 2).
- **Filament:** the visible zigzag inside the glass is my addition.
- **Pawn height:** with this much float, the pawn's head comes within about 1 unit of the −9 limit on the highest bob. If you want more float, the bulb would need to be a bit smaller.
