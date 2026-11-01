# Boss art: sidekick-beaver

- Model claude-opus-5-5, effort high, adaptive thinking. 31 turns, 27 renders.
- Spend: **$2.38** of the $6 cap (64 input, 131,019 cache-write, 2,865,637 cache-read, 57,479 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-beaver/sidekick-beaver.ts.
- Previews: scripts/boss-art/out/sidekick-beaver/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-beaver/looks/.

## Its notes

Timber's sidekick, "sidekick-beaver": a little woodpecker foreman. The frame is 64×64 with its feet at (27, 61), the same frame and outline weight as Jefferson's sidekick, and it stands about 48 px tall (roughly 60% of Timber). I rendered and looked at all 14 animations at 3–5×, and at phone size (1×, 2×) beside the tiger. It reads as a woodpecker in an orange hard hat: the hat, the red crest, the big eye and the beak all show. The render ignored my request to compare against Timber himself and showed the black knight instead, so I haven't seen the two side by side.

**The look:** a round black-and-white body with a cream belly crossed by an orange safety sash with a silver reflective stripe. It has a red crest poking out behind its tiny hard hat (Timber's orange palette), a white face with a cheek stripe, one big shiny eye with a blush, and a strong chisel beak. Its wings are black with white spots, and it has a stiff tail. A short plank stands on end just in front of its beak, ready for pecking.

**Animations, beat by beat:**
- **idle** (3.1 s, loops): breathes and blinks → leans in and pecks the plank three times (rat-a-tat, wood chips fly, cue `tap`), the hat jiggling more askew with each peck → happy nods → pushes the hat straight with a wing tip → calm, with a tail flick and a blink.
- **walk** (0.6 s, loops): quick hop-steps, head bobbing forward, tail flicking, `step` cues. It doesn't carry the plank, and the plank isn't drawn while walking.
- **sit** (3.1 s, loops): perched on a wooden stool facing right, feet dangling and swinging, a slow blink, a determined little peck at the air (`tap`).
- **wave** (1.1 s, once): the wing flaps up and out twice while the hat wobbles and the crest flares → two hello pecks at the air (`tap`) → a wing tip to the hat → back to the idle pose.
- **entrance:** drops in on a growing shadow, with the hat floating above its head → lands with a squash and dust → the hat lands a beat later (`tap`) → salutes at the hat → twinkle.
- **thinking** (loops): eyes up, wing tip on its chin, a foot tapping, thought dots popping up.
- **move:** a crouch, a hop, then the wing points forward like giving orders, beak open with shout lines → a nod.
- **capture:** a fast eight-peck rat-a-tat with chips everywhere, crest flared, hat knocked askew → a hop with both wings up → a smug finish.
- **hurt:** a white flash, eyes screwed shut, the hat pops up and lands crooked → sweat → it pushes the hat straight → calm.
- **check:** two forward wing points with the beak shouting and the crest flared (`tap` on each) → wing on its hip, smug.
- **smug** (loops): crest flared, chin up, eyes half shut, wing on its hip, a slow nod.
- **rattled** (loops): wide eyes, crest flattened, trembling, the hat rattling side to side, sweat flying.
- **defeat:** a flash, the hat pops → dizzy X eyes, the hat slides down over its eyes → a wobble → it plops onto its bottom, feet up, stars circling. The last frame holds.
- **victory** (loops): hops for joy with both wings up and flapping, the hat bouncing, sawdust confetti.

**Choices you might want to change:**
- **The plank:** it stands upright beside the bird in every animation except walk and sit. If you'd rather it showed up only now and then, it's one flag per pose (`plank`).
- **No carrying:** the brief allowed it to carry the plank now and then. I didn't draw that; it could be added to walk.
- **One eye:** I gave it a single big eye (an almost-profile three-quarter view). That keeps the face clean at phone size, but there's no far eye.
- **Pointing without moving:** in move and check it points from where it stands, because stepping forward pushed the wing into the plank.
- **Cue names:** the pecks use a new `tap` cue, and landings and walking use `step`. Neither has a sound yet.
- **No table:** sit shows only a stool, like Jefferson's sidekick, with no chess table.
