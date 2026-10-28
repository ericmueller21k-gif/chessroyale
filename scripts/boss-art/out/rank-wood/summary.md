# Boss art: rank-wood

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 14 turns, 10 renders.
- Spend: **$1.11** of the $20 cap (30 input, 126,300 cache-write, 750,333 cache-read, 64,215 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rank-wood/rank-wood.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/rank-wood/looks/.

## Its notes

scripts/boss-art/out/rank-wood/rank-wood.ts is finished. It exports `RANK_WOOD` with id "rank-wood", a 48x48 frame, and five one-frame stills (`d5` to `d1`, 1000 ms each, not looping). I looked at all five at 6x, at 1x and at 2x (on dark and light backgrounds), and also beside the tiger at phone size. The render showed no warnings.

I did not add the boss animations (idle, entrance, move, etc.). The brief asked only for the five stills, and an emblem has no use for them.

Each division adds to the one before, and the badge, pawn and colors never change:
- **d5:** a 34x34 walnut octagon, with a 1px outline making it 36x36. Eight mitred facets frame a recessed dark-walnut table, lit from the top left and grained along each side. A honey-wood pawn stands in front, with a big round head, a collar, a flared body, a ring and a wide base. A knot and a nick on the pawn give it the well-loved look. It reads clearly at 1x.
- **d4:** adds four pale wooden pegs on the diagonal edges. They straddle the outline, so they bump the silhouette.
- **d3:** adds a pair of green oak leaves at the sides, lit from the top left, drawn in front of the badge's side facets.
- **d2:** adds a small three-point wooden crown sitting on the badge's top edge. It is the same honey as the pawn, so it also hints at a promoted pawn.
- **d1:** adds a white four-point glint on the pawn's head and a thin, semi-transparent two-pixel gold glow round the badge.

Choices you might want to change:
- **Leaf color:** the leaves are green, the only non-brown color. I did this so d3 shows up at 24 px, and it is a one-key swap (g, G, n) if you want it all brown.
- **Crest:** it is a crown, not the acorn I tried first. The acorn blended into the bevel at small size.
- **Vertical position:** the badge sits at y 9–44 in all five stills, so it doesn't jump between divisions. That leaves room for the crown above it, which puts d5 to d3 about 2 px low in the frame. d2 and d1 are centered.
- **Glow:** it is a bright gold ring and reads a little like a second outline. It is limited to two rings because a third would touch the frame's bottom row.
- **Halo:** it is a faint translucent walnut, `#a8733a55`.
