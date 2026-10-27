# Boss art: sidekick-babur-2

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 38 turns, 43 renders.
- Spend: **$3.72** of the $20 cap (78 input, 344,905 cache-write, 7,032,629 cache-read, 144,668 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-babur-2/sidekick-babur-2.ts.
- Previews: scripts/boss-art/out/sidekick-babur-2/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-babur-2/looks/.

## Its notes

The file is scripts/boss-art/out/sidekick-babur-2/sidekick-babur-2.ts, exporting `sidekickBabur2` with id "sidekick-babur-2". It's a 64x64 frame with feet at (24, 61), the same size as Jefferson's sidekick. All 14 animations (the 11 required plus walk, sit and wave) are drawn and looked at. Frames I rendered show no edge warnings, except idle frames 5 and 8, wave 8 and defeat 4 and 5, which I never viewed. After the last tail edit I only re-checked idle at 0, 6 and 21.

**Look:** a round tiger cub with a big amber-eyed head, round ears with pink insides, a cream muzzle and chin, a few soft stripes, short stubby legs with big cream feet and a short striped tail. No vest, no hat. It hugs one big plain purple balloon: egg-shaped, banded shading, one soft highlight, a small knot and a short pale string. The paws are plain round cream balls with faint toe creases, no claws anywhere.

**Balloon squeeze:** the balloon is a shape of its own per squeeze level (-1 springing out, 0 resting, up to 4 squashed). It dents in where the near arm and far paw hold it, swells above and below them, and the paws and head move in with it.

**Animations, beat by beat:**
- **idle (3 s, loops):** breathes, blinks twice, swishes its tail, flicks an ear once. Late in the loop it winds up, squeezes the balloon (eyes shut happy, a heart pops up, "squeak" cue), then the balloon springs back slightly out and settles.
- **walk (0.6 s, loops):** a four-step waddle on its hind legs, head and body bobbing, the balloon bobbing a pixel against the body, the string swaying, "step" cue.
- **sit (loops):** on a stool seen from the side, legs dangling and swinging, tail hanging down behind. It blinks, then leans in and tilts its eyes up as if thinking, with a small balloon squeeze.
- **wave (1.2 s, plays once):** it ducks its head behind the balloon and peeks out with one eye. It pops out cheering and waves one paw over the balloon's top three times while the other arm keeps hugging. It then gives a small squeeze and settles back into the idle pose.
- **entrance:** the shadow grows, then the cub floats gently down hanging from the balloon, feet dangling. It lands in a squash with a dust puff and "thump", then gives a happy squeeze with a heart and twinkles.
- **thinking (loops):** one paw up at its chin, eyes rolled up, a foot tapping, blinks, thought dots growing beside the head.
- **move:** a wind-up squeeze, a happy hop with one paw pointing at the board, a landing with dust, then back to hugging.
- **capture:** two excited hops with the paw waving high, twinkles, a big squeeze and "squeak" on each landing, ending in a heart and a smug look.
- **hurt:** a pale flash and shake, then it clutches the balloon hard (squeeze 4) with eyes screwed shut and sweat drops. It recovers through wide-eyed, blink and a brave grin.
- **check:** it gasps with wide eyes and ears up, then throws a paw at the board twice with a "squeak" on each jab, ending in a smug look.
- **smug (loops):** chin up, half-lidded eyes, a smirk, a slow nod, a contented squeeze and a lazy tail.
- **rattled (loops):** wide eyes, worried brows, ears flat, trembling, hugging the balloon hard, sweat flying.
- **defeat:** a flash and a reel, then it plops down on the ground still hugging the balloon (it never lets go and the balloon never pops). X eyes, tongue out, dizzy stars circling, head slumped on the balloon, and the last frame holds for 1 s.
- **victory (loops):** jumping for joy with one paw waving high, a squeeze on every landing, confetti and hearts.

**Choices you might change:**
- Cues are "step", "squeak", "thump" and "poof". The kit needs to map them to sounds; I haven't checked how the kit handles an unmapped cue.
- The entrance drops from only about 9 px up, because the frame has no headroom for more. It reads as floating down on the balloon.
- The far arm is mostly hidden behind the balloon: only the wrist and paw show at its right edge when hugging, and it rises above the balloon for waving and pointing.
- In sit, the stool is partly hidden by the cub, so only the seat edge and the left legs show.
- The first idle frame is the still.
