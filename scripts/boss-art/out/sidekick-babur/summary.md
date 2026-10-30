# Boss art: sidekick-babur

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 41 turns, 59 renders.
- Spend: **$4.23** of the $20 cap (84 input, 351,094 cache-write, 10,105,927 cache-read, 133,224 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-babur/sidekick-babur.ts.
- Previews: scripts/boss-art/out/sidekick-babur/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-babur/looks/.

## Its notes

The drawing is `scripts/boss-art/out/sidekick-babur/sidekick-babur.ts`, exported as `sidekickBabur` with id "sidekick-babur". It is a 64x64 frame, feet at (28, 61), with a 1 px `k` outline and a faint halo, built like Jefferson's sidekick. I looked at every animation at 4x–6x and the idle beside Babur at phone size. A final one-frame-at-1x pass over every frame of every animation, defeat frames 8–9 excepted, showed no pixels on the frame edge.

**Look:** a round tiger cub with a big head, big amber eyes and a cream muzzle. It has forehead and cheek stripes, round ears with a cream middle, stubby legs with big cream paws, and a short ringed tail with a dark tip. Babur's orange, cream and stripe colors are copied from `TIGER_PALETTE`. There is no vest and no hat. Its one prop is a shiny purple pawn balloon (his purple, with a highlight) on a string held in the near paw.

**Animations** (the cues are `step`, `squeak` and `poof`; the sound pack needs to map them):
- **idle** (3 s, loop): it breathes in 1 px bobs, blinks twice, and swishes its tail twice. Its ear flicks, it glances at its balloon, and it turns its head slightly. The balloon bobs and its string sways.
- **walk** (0.6 s, loop): a playful trot with a small hop every third frame. The head bobs, the tail flips, and the balloon trails up and back on a bowed string. `step` fires on each landing.
- **sit** (3.2 s, loop):
  - It sits on a stool facing right, legs dangling, and the far leg swings. The balloon is tied to the stool and floats behind it.
  - It breathes, then slowly blinks twice. It leans forward with its eyes up, and rests a paw under its chin for a moment.
  - The whole pose is drawn 5 px right, so the stool lines up with the standing cub's middle.
- **wave** (1.2 s, plays once, ends on the idle pose):
  - Beat 1: it squats and grins.
  - Beat 2: the near arm reaches out wide with the balloon, the far paw pops up beside its face, and it squeaks.
  - Beats 3–10: the paw waves left and right, the expression alternates between a cheer and a happy squint, the balloon bounces, and a twinkle appears.
  - Beats 11–12: the arm lowers and it settles.
- **entrance**: a shadow grows with sparkles, then it hops in at 10 px up and 6 px up, lands in a squash with dust, and waves.
- **thinking** (loop): head tipped up, eyes rolled toward the balloon, a foot tapping. Thought dots grow into a "..." cloud at the upper left.
- **move**: a crouch, then a hop toward the board with the balloon swung out ahead, and a happy settle.
- **capture**: two excited hops with the balloon held high and twinkles, ending in a smug look.
- **hurt**: a pale flash and shake, eyes squeezed shut, ears flat, the balloon yanked sideways and a sweat drop. Then it wobbles and shakes it off with a brave grin.
- **check**: two sharp jabs of the balloon toward the board with a bold face, then a grin and a smug look.
- **smug** (loop): chin up, half-lidded eyes, a slow nod, the tail and balloon swaying.
- **rattled** (loop): wide eyes, worried brows, trembling, ears down, sweat flying, the balloon jittering.
- **defeat**: a flash and a dizzy X-eyed stumble. It lets go and the balloon drifts up and hovers at the top of the frame, string dangling. The cub flops onto its belly with ears down and holds there. No gore.
- **victory** (loop): big joyful hops with the balloon held high, confetti and twinkles.

**Choices the owner may want to change:**
- **Balloon in defeat:** it drifts up and hovers above the flopped cub. The frame has no headroom to float it away, so I did not let it leave the frame. A pop could replace this.
- **Entrance:** a hop-in rather than a drop from above the frame, because the balloon would have been cut off at the top.
- **Wave:** the free paw is the far one, drawn peeking out from behind the head. The balloon arm stretches out to make room, so that arm is long for a few frames.
- **Sit:** the balloon is tied to the stool instead of held, and there is no table in the sprite (like Jefferson's).
- **Tiny hat:** skipped on purpose; the link to Babur is the palette, the stripes and the balloon.
