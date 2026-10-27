# Boss art: sidekick-puddles

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 39 turns, 41 renders.
- Spend: **$3.32** of the $20 cap (80 input, 322,982 cache-write, 6,388,581 cache-read, 123,129 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-puddles/sidekick-puddles.ts.
- Previews: scripts/boss-art/out/sidekick-puddles/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-puddles/looks/.

## Its notes

Drawing: scripts/boss-art/out/sidekick-puddles/sidekick-puddles.ts. It exports `sidekickPuddles` with id "sidekick-puddles". The frame is 64x64 and the feet are at (26, 61). I looked at every animation at 4x to 10x. I checked the idle beside Puddles (`gardener`) and beside the tiger at phone size. I did not run the typecheck or the unit tests. The edge-pixel warnings from earlier passes are all fixed.

**The character:** a round baby hippo in Puddles's skin colors, with pink cheeks and belly, big shiny eyes and a wide muzzle with two nostrils. It has small round ears, a short stub tail, and a green sprout behind the near ear. It stands upright like him and faces right. The watering can is green with a brass rim and a brass rose, like his nozzle. At phone size it's about 62% of Puddles's body height, or about 72% with the sprout.

**Animations (beat by beat):**
- **idle (3 s, loops):** it sways a pixel, breathes, blinks twice, flicks its ear and tail, and the sprout leans with the sway. Twice the can forms a drip at the rose and the drop falls and splashes.
- **walk (0.6 s, loops):** a waddle. The feet alternate with a 3 px lift, the body leans toward the planted foot, the head bobs, and it keeps the can close. The step frames carry a `step` cue.
- **sit (loops):** side view on a small stool. The can is in its lap, the legs dangle and swing, and it blinks. Mid-loop it leans forward with eyes up (thinking), and the can trickles once.
- **wave (1.2 s, plays once):** a small crouch, then it lifts the can with a happy grin. Two crossing arcs of drops sprinkle while the can rocks and the ears and sprout bounce. Then it lowers the can and settles into the exact idle pose. The `sprinkle` cue is on the first sprinkle frame.
- **entrance:** a shadow grows, it drops in, lands with a squash and dust, then lifts the can and sprinkles with twinkles.
- **thinking (loops):** eyes and brows up, head tipped, a foot tapping, the can low, and thought bubbles growing one, two, three.
- **move:** a crouch, then a hop toward the board pointing the can and sprinkling, and a landing with dust.
- **capture:** two excited hops with the can high, a shower of drops, and twinkles. It ends with a smug look.
- **hurt:** a pale flash, eyes shut, the sprout wilts, the can sloshes and sweat flies. It recovers with a brave grin.
- **check:** two sharp jabs of the can at the board with a forward spray, then a smug look.
- **smug (loops):** half-lidded eyes, a smirk and a slow nod.
- **rattled (loops):** wide eyes, a wavy mouth, sweat, trembling, and the can slopping drops.
- **defeat:** a flash, x-eyes with the tongue out and dizzy stars, then it drops the can and plops onto its bottom. The can ends standing crooked on the ground beside it, with a puddle spreading. The last frame holds.
- **victory (loops):** hops with the can high and a shower of drops. The sprout bursts into a daisy.

**Choices the owner might want to change:**
- **Idle drip:** it is a small drop or two at the rose. It could be bolder if you want it to read at 1x.
- **Smug eyes:** the half-lidded eyes read a little unamused. Closed happy eyes would be sweeter.
- **Defeat:** it sits and drops the can rather than lying on its back, because the can reads better upright. The defeat frame needs `dx -3` to keep the can inside the frame.
- **Flower:** the daisy for victory is my addition; remove it by making `sprout: "bloom"` into `"mid"`.
- **Frame width:** the whole figure is shifted 3 px left (`SHIFT`) to leave room on the right for the raised can and its drops.
