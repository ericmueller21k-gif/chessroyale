# Boss art: sidekick-moo

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 34 turns, 37 renders.
- Spend: **$3.47** of the $20 cap (70 input, 361,206 cache-write, 6,613,686 cache-read, 124,701 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-moo/sidekick-moo.ts.
- Previews: scripts/boss-art/out/sidekick-moo/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-moo/looks/.

## Its notes

Drawing is in scripts/boss-art/out/sidekick-moo/sidekick-moo.ts (id "sidekick-moo", exported as sidekickMoo). I rendered every animation at 3–6x and looked at the idle at phone size beside Moo, on dark and light grounds. There are no edge warnings on the frames I rendered. I couldn't run a typecheck, so that's untested.

**The look.** A tiny Holstein calf facing our right. The frame is 64x64 with the foot at (31, 61), the same as Jefferson's sidekick. It is about 41 px tall, which is roughly 62% of Moo's 65. It has a big round head with big glossy eyes, a pink snout, floppy brown ears with pink insides, a cream tuft instead of horns, and cream fur with a few brown patches. The legs are stubby with dark hooves, and the tail is thin with a dark tuft. All colors come from Moo's palette. The yellow star hangs on a red ribbon at the chest. Outline weight and detail level match Jefferson's: a k outline on every part and a faint halo.

**Animations, beat by beat**
- **idle** (3 s, loops): breathes (a 1 px bob twice per loop), blinks twice and a third time at the end, and flicks the far ear up once. It flicks the near ear down and wags its tail twice, and the head sways forward at the end. The star swings gently, and around 1.6–2 s it twinkles up to a bright flash and back.
- **walk** (0.6 s, loops): a trot where the diagonal leg pairs alternate. The body and head bob, the ears bounce, the tail wags and the star swings. It fires a `step` cue on each footfall.
- **sit** (3.2 s, loops): it sits on a stool tipped up like a kid, with the thighs along the seat, shins hanging, forelegs dangling and hooves well above the ground. The legs swing and it breathes. It blinks, leans toward the board with eyes up for a thinking beat, flicks an ear, and the star hangs on its chest and twinkles at the end.
- **wave** (1.2 s, once): it lifts its head with ears up and a happy face, with a small hop. The star twinkles in steps to a big white glint, with sparkles near it. Then it settles to calm, matching the first idle pose.
- **entrance**: a shadow grows, it drops in with ears up and legs trailing, and lands with a squash, blinking, plus dust. It lifts its head with the star twinkling and sparkles, then settles.
- **thinking** (loops): head up, eyes rolled up, chewing, a hoof tapping and an occasional blink. Thought bubbles rise: a dot, a bigger dot, then a cloud with a pawn in it.
- **move**: crouch, a hop toward the board with ears up, a landing with dust and a happy nod, then calm.
- **capture**: two excited hops with ears up, eyes squeezed shut and the star twinkling, sparkles all round, then a smug settle.
- **hurt**: a pale flash with a jolt, "><" eyes, ears flung back, the star flung and sweat drops. It recovers with a wide-eyed look, a blink, a brave grin, then calm.
- **check**: two sharp snout jabs toward the board with a determined face, and the star flares bright each time. Then it goes happy, then smug.
- **smug** (loops): heavy-lidded, a smirk, chin up, a slow nod, an ear flick, and the star glints once.
- **rattled** (loops): trembling, wide eyes with tiny pupils, worried brows, ears down, a wobbly mouth, sweat flying and the star jiggling.
- **defeat**: a flash and "><" eyes, then X eyes with a tongue out as it wobbles. It slumps and flops flat on its belly with the star dimmed on the ground in front. It holds on the last frame.
- **victory** (loops): hops for joy with ears up and a happy face, the star twinkling, with falling confetti and sparkles.

**Choices the owner might change**
- **Sit pose:** a quadruped on a stool can't sit flat, so the body is tipped up with thighs along the seat, like a seated kid. The alternative is a flat body with legs hanging, but that read as standing at a bench.
- **Star placement:** the star is on a ribbon at the neck, not in its mouth, so it never fights the face. In the defeat it lies dimmed on the ground.
- **Size:** it is about 62% of Moo's height. Shrinking the head a little would bring it nearer 60%.
- **Ears and patch:** the brown head patch sits over the top-left, not over the eye, so the big eyes keep their contrast. The tuft is cream and small.
- **Cue names:** `step`, `twinkle` and `poof` are my guesses. Rename them to whatever the sound kit uses.
