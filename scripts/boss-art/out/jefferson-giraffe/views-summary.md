# Boss art (rider views): jefferson-giraffe

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 5 renders.
- Spend: **$0.71** of the $3 cap (24 input, 58,014 cache-write, 459,057 cache-read, 16,310 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/jefferson-giraffe/jefferson-giraffe.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/jefferson-giraffe/preview/idle.png, scripts/boss-art/out/jefferson-giraffe/preview/move.png, scripts/boss-art/out/jefferson-giraffe/preview/look.png, scripts/boss-art/out/jefferson-giraffe/preview/front-idle.png, scripts/boss-art/out/jefferson-giraffe/preview/front-move.png, scripts/boss-art/out/jefferson-giraffe/preview/back-idle.png, scripts/boss-art/out/jefferson-giraffe/preview/back-move.png, scripts/boss-art/out/jefferson-giraffe/preview/views.png. Each look it took: scripts/boss-art/out/jefferson-giraffe/looks/.

## Its notes

I added front and back views to Giraffe Gallop and left the side view alone. The back view is unchanged from how it was. I replaced the old front view, which had a short, cow-like head, and deleted its unused code. All three views are the same height: the horn flames top out at about y -44 and the hooves stand on the same ground line. The pawn sits at the same height in every view (pawnY -20, cut 66, pawnX 0).

**Front view (walking down):**
- **Neck:** a long, narrow neck rises straight up the middle in front of the pawn. It is 8 units wide at the pawn's head and flares into the chest at the bottom. It has rust spots and a highlight line. The pawn's head and body show on both sides of it.
- **Mane:** four flame tufts stick out from behind the neck, alternating left and right.
- **Head:** at the top, at the same height as on the side (y -28 to -2), facing us. It has:
  - two big shiny eyes with lashes
  - pink cheeks
  - a cream muzzle with two nostrils and a cheeky, slightly uneven smile
  - pink-lined ears out to the sides
  - two ossicones with flames on top
- **Below the neck:** a spotted chest, the two front legs in front and the hind legs behind. The saddle and blanket show on both sides of the neck. Nothing is drawn behind the pawn in this view.

**Back view (walking up):** unchanged. We see the rump with the flame-tipped tail in the middle, the two hind legs, the back of the saddle and blanket, the pawn from behind, and the neck rising past the pawn with its mane flames, ears and flame-topped ossicones.

**Painted parts:** only the saddle and the blanket (a lighter shade with a band of the full color), with the same region names as the side ("saddle", "blanket"). Everything else keeps the side's fixed colors. I checked every color; on midnight the saddle is dark but still reads.

**Idle** (8 × 170 ms, the same beats as the side):
- All the flames flicker the whole time, each out of step with the others.
- The neck and head sway slowly and bob a little.
- The ears flick out on frame 2 and in on frame 3.
- The jaw chews on every other frame.
- It blinks both eyes on frame 5.
- From the back, the tail swishes.

**Move** (8 × 65 ms, dx stays 0):
- The legs follow the side's gallop, seen end-on: they lift, fold and land in turn, front legs and hind legs out of step.
- The body bobs so that a hoof stays on the ground, except in the airborne beat (frame 0), where it rises 3 units.
- The pawn lifts up to 1.8 units off the seat and rolls about 1.4° side to side.
- The neck pumps: the head rises and falls with the side's neck swing, and the mane tufts move with it.
- The horn flames splay outward and the mane tufts flare out further than at rest.

**Choices you might want to change:**
- The neck in front hides the middle of the pawn, so at town size the pawn shows as a white or black shape on both sides of a golden neck. You could make the neck narrower or lean it slightly to one side so more of the pawn shows.
- The chest covers the lower middle of the saddle, so from the front the item's color mostly shows on the two sides.
- The mane tufts in front are spiky flames, like the side's; you could make them bigger and rounder.
