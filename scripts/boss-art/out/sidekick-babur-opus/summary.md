# Boss art: sidekick-babur-opus

- Model claude-opus-5-5, effort high, adaptive thinking. 29 turns, 27 renders.
- Spend: **$3.10** of the $20 cap (62 input, 167,113 cache-write, 3,147,670 cache-read, 81,945 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-babur-opus/sidekick-babur-opus.ts.
- Previews: scripts/boss-art/out/sidekick-babur-opus/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-babur-opus/looks/.

## Its notes

The cub is drawn in `scripts/boss-art/out/sidekick-babur-opus/sidekick-babur-opus.ts`, exported as `sidekickBaburOpus`. I looked at all 14 animations at 3x to 4x, and the idle at 6x and beside Babur at phone size, where it reads as a tiger cub with a purple balloon.

The look: a round orange cub, 64×64 frame like Jefferson's sidekick, about 50 px tall. It has a big round head, big amber eyes with a dark pupil and a white glint, a cream muzzle and cheeks, round ears with pink insides, a few soft stripes and a short striped tail. It faces right, lit from the top left. No hat, no vest.

The balloon: plain purple, about as big as the body, one soft highlight, a little knot and a short string. The near front leg wraps across its front, the far paw peeks round its far side, and the cub's cheek rests on its top left. In a squeeze the balloon pinches in at the arms and bulges out above and below, then springs back a little too round at the middle before settling. The paws are soft round mittens with pink toe beans and no claws anywhere.

Animations, beat by beat:
- idle (3 s, loops): breathes, sways its head, blinks twice, swishes its tail; once a loop a happy squeeze with closed eyes and a floating heart, then the spring-back with small "boing" marks.
- walk (0.6 s, loops): a waddly trot on its back legs; feet step and lift, body and head bob, ears perk at the top of each bounce, and the balloon bobs a beat behind.
- sit (3.2 s, loops): on a wooden stool facing right, feet dangling and swinging, balloon in its lap; blinks, looks up to think while thought bubbles appear, blinks slowly, one small squeeze.
- wave (1.2 s, once): leans its head out, the far paw pops up from behind the balloon with its pads showing and waves four times while the near arm keeps hugging, then a squeeze and back to idle.
- entrance: walks in from the left edge, stops, perks up, then a big squeeze with hearts and the spring-back.
- thinking (loops): head resting on the balloon, eyes up, the near paw tapping the balloon, thought bubbles growing.
- move: crouches, hops toward the board, squeezes as it lands with a puff of dust, then a happy face.
- capture: two joyful hops with twinkles, a squeeze and hearts at each landing, ending smug.
- hurt: a flash, eyes screwed shut, clutching the balloon hard (it squishes, never pops), sweat drops, a wobble, then a brave smile.
- check: a tiny roar copied from Babur (open mouth with small fangs, two sound arcs, a small shake), then smug.
- smug (loops): chin up, half-closed eyes, a smirk, tail swishing, one pleased squeeze.
- rattled (loops): wide eyes, worried brows, ears flat, trembling, clutching the balloon, sweat drops.
- defeat: a flash and a wobble, then it plops on its bottom with its soles showing, teary and ears down, cuddling the balloon; the last frame holds.
- victory (loops): hops for joy with a squeeze at every landing, confetti in Babur's balloon colours (red, blue, green, gold) and hearts.

Choices you might want to change:
- The far paw is the one that waves, so the near arm never leaves the balloon. When the near arm waved it covered the balloon and looked like a stick.
- The entrance walks in from the left, so its first frames are cut off at the edge on purpose; the render warns about edge pixels for those frames only.
- Check is a tiny roar rather than pointing. It uses a new sound cue, "roar", which still needs a sound in the kit.
- Defeat is a sad sit-down cuddling the balloon, not falling over.
- The cub's orange is a touch softer than Babur's; the confetti uses his balloon colours to tie the two together.
- The sit has a stool but no chess table, as Jefferson's sidekick does.
- The "boing" marks are only a few pixels and the ear flicks are small; both are easy to make bigger.
