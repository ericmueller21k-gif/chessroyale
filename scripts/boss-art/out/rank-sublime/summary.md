# Boss art: rank-sublime

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 18 turns, 13 renders.
- Spend: **$1.52** of the $20 cap (38 input, 141,029 cache-write, 1,240,876 cache-read, 92,278 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rank-sublime/rank-sublime.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/rank-sublime/looks/.

## Its notes

Sublime is in scripts/boss-art/out/rank-sublime/rank-sublime.ts, exported as `rankSublime` with id "rank-sublime". It has five one-frame stills, d5 to d1, at 1000 ms each, on a 48x48 frame. I looked at d5, d4, d3, d2 and d1 on the dark and light backgrounds beside the tiger. I could not view anything below 1x/2x phone size, so the 24 px reading is judged from those views, not seen directly. The render showed no warnings.

**The base (d5):** a 34x34 octagon badge (centred, x 7..40) in gold. Its bezel is cut in eight facets, lightest at the top-left and darkest at the bottom-right. It surrounds a deep purple table split into eight wedges that darken the same way. The queen stands in front of it. She is amethyst, shaded in left-to-right facet bands. Her crown has a gold orb, gold pearls on the prongs, a gold band and a gold collar, and she stands on a three-step gold base. The queen's crown is what keeps her from reading as a rook.

**What each division adds (each keeps everything below it):**
- **d4:** four faceted amethyst studs at the middles of the badge's cut corners.
- **d3:** a pair of gold wings, four feathers a side. They sweep up from behind the badge's sides into the corner gaps, with the longest feather at the top.
- **d2:** a gold crest with an amethyst gem, over the badge's top edge.
- **d1:** a white four-point glint on the queen's crown, plus a thin lilac glow ring round the badge. The glow is translucent and sits outside the outline, so it shows on dark and light backgrounds.

**Choices you may want to change:**
- **Badge size:** I made the badge 34 px, not 40. That leaves room for the wings and crest, which push d3 to d1 out to about 44 px wide and tall, but d5 and d4 fill only about 34 of the 48.
- **Colours:** the gold bezel with a purple field and light amethyst queen is deliberate. It keeps the queen readable against the badge and keeps Sublime distinct from a gold-material tier.
- **Wings and glow:** wings were chosen over leaves because they read better at small size. The glow's strength is the two alpha values on palette keys `z` and `Z`.
- **Frame loop:** the stills are set to `loop: false`.
