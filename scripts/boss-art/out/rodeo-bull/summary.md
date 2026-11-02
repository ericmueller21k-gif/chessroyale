# Boss art (rider): rodeo-bull

- Model claude-opus-5-5, effort high, adaptive thinking. 12 turns, 5 renders.
- Spend: **$0.79** of the $6 cap (26 input, 44,303 cache-write, 258,917 cache-read, 25,886 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rodeo-bull/rodeo-bull.tsx.
- Previews: scripts/boss-art/out/rodeo-bull/preview/idle.png, scripts/boss-art/out/rodeo-bull/preview/move.png, scripts/boss-art/out/rodeo-bull/preview/look.png. Each look it took: scripts/boss-art/out/rodeo-bull/looks/.

## Its notes

Rodeo Bull (mythic, id "rodeo-bull"): a stocky little brown bull seen from the side, facing right. It has a cream muzzle, a gold nose ring, short ivory horns with dark tips, a dark curly tuft, a small determined brow, a shoulder hump and a rope tail with a tuft on the end. It wears a western saddle with a cantle, a pommel and a horn, a dashed-stitch skirt, a fringed saddle blanket with a light stripe, a cinch and a stirrup. The pawn sits in the seat: cut 66, lifted 20, so its lower part is hidden behind the skirt, between the cantle and the horn.

Painted part (the item's color): the saddle (cantle, seat roll in a lighter shade, skirt, pommel, horn) and the blanket. The blanket's fringe, the cinch and the stirrup strap use a darker shade of the color. Fixed colors: the bull, horns, hooves, nose ring, a brown stirrup and a gold star concho on a darker gold disc.

Idle (about 2 s loop): rest → tail flicks → head dips and a white steam puff comes from the nostrils → bigger double puff → the puff fades while the front hoof lifts forward → the hoof scrapes back with a dust puff → the dust spreads and the tail flicks the other way → rest. The body sways gently as it breathes, and the pawn moves with it.

Move (0.7 s, dx 0→100): crouch with the hind legs gathered → push off nose-up from the back hooves, front legs tucked → airborne arc (peak dy −17) → the bull pitches nose-down with its hind legs kicking back → it lands on its front hooves with the back legs kicked high (the buck) and a dust puff at the front → the rear comes down → it lands level at dx 100 with a squash and dust under the front and back hooves. The last frame is the rest pose, so the next move's crouch follows on smoothly. The pawn follows the saddle and tilts with the bull the whole way.

Choices you might want to change:
- The steam reaches about x 110, a little past the square.
- On the yellow scheme the gold star sits on a yellow saddle; its darker disc keeps it readable, but it stands out less there.
- On midnight the blanket is quite dark.
- The description joke: "Eight seconds is the record. He's never once let anyone off early."
