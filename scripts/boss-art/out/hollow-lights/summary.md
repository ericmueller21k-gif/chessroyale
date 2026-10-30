# Boss art (item): hollow-lights

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 3 renders.
- Spend: **$0.24** of the $3 cap (12 input, 20,395 cache-write, 46,079 cache-read, 6,532 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-lights/hollow-lights.tsx.
- Previews: scripts/boss-art/out/hollow-lights/preview/frames.png, scripts/boss-art/out/hollow-lights/preview/look.png. Each look it took: scripts/boss-art/out/hollow-lights/looks/.

## Its notes

Hollow's String of Lights is an epic weapon. It's a string of big old-fashioned bulbs on a dark green wire, held at the pawn's right side (a twist of wire at about (75, 49) with a small loop of slack above it). It hangs in two strands of three bulbs each, like the string in Hollow's hand in the reference. The six bulbs are each a painted region, so they take the item's color; each has a white glint. The sockets are grey (fixed), and the wire is green inside a dark outline. It renders cleanly in every color scheme and on both pawns, with no warnings at the final frame box (38, 36, 66, 68).

Motion (10 frames × 200 ms, a 2-second loop): one bulb at a time lights up, getting a pale tint plus a soft two-ring halo in a light tint of the item's color, while the others dim a little. The light chases from the bottom of the left strand up to the hand, then down the right strand, and loops back. The in-between frames hand the glow smoothly from one bulb to the next, so it reads as a chase, not a blink.

Things you might want to change:
- **Glow strength:** the halo opacity (0.3 / 0.5) is modest so it doesn't distract. At 60 px it reads, but subtly.
- **Wire on the black pawn:** the green wire nearly disappears against a black pawn at 60 px. The bulbs still read.
- **Bulb size:** set by S = 1.3.
- **Bulb count and shape:** it's six bulbs; the brief allowed five to seven, and the reference has five per strand. More would need smaller bulbs.
