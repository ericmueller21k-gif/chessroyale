# Boss art: rank-set

- Model claude-opus-5-5, effort high, adaptive thinking. 33 turns, 28 renders.
- Spend: **$3.43** of the $20 cap (68 input, 206,730 cache-write, 3,854,419 cache-read, 81,307 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rank-set/rank-set.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/rank-set/looks/.

## Its notes

I've drawn the whole ladder in one file, scripts/boss-art/out/rank-set/rank-set.ts (`RANK_SET`, id "rank-set", 48 x 48). I rendered every tier at 4–6x and at 24 px, and compared the ladder neighbors side by side: Wood/Silver, Sublime/Radiant, Radiant/Pearlescent. The last renders gave no warnings. I added none of the usual boss animations (idle, entrance and so on), because the brief asked only for these 30.

**How it's built:** every emblem uses the same parts. The badge is the same octagon in every tier: a rim of eight facets lit from the top left, a dark inner ring, and a gem-cut centre of eight triangles. The studs, wings, crest and glow are also shared. The parts are drawn in generic colors, and each tier's frames swap in its own colors. That keeps the shape, outline weight, lighting and division steps identical in every tier. The pieces are drawn as masks and shaded the same way.

**The 28 stills** (one 1000 ms frame each):
- **Division steps, the same in every tier:**
  - d4: the badge and the piece.
  - d3: adds four round studs on the cut corners.
  - d2: adds a fan of four feathers each side.
  - d1: adds a small crown crest at the top, a white sparkle on the piece and a thin glow round the badge.
- **Wood:** honey pawn with grain on a walnut badge with grain. Its side fan is carved honey-wood leaves instead of metal feathers.
- **Silver:** polished pawn on a dark slate-blue centre, with dark steel studs.
- **Gold:** gold knight on a deep amber centre.
- **Paragon:** jade bishop with gold trim and a slit in its mitre, in a gold rim.
- **Illustrious:** sapphire rook in a silver-white rim.
- **Sublime:** amethyst queen in gold, based on Eric's sample.
- **Radiant:** ruby queen with gold-orange sun rays across the centre and sixteen gold rays behind the badge. The rays show in all four divisions, so Radiant has its own spiky outline.

**The two loops** (8 frames × 250 ms = 2 s, the emblem still):
- **Pearlescent:** a pearl king with champagne-gold trim, on a dark violet centre, in an iridescent rim. A pink, gold and blue sheen moves round the rim one facet per frame, the centre shimmers opposite it and the king's tint shifts. A sparkle swells and fades on the king, and four sparkles come and go at the corners. It has all the d1 pieces, with pearl-coloured feathers, pink pearl studs and a wider glow.
- **Transcendent:** a starlight king in front of a glowing white-gold halo, on a cosmic indigo centre, with starlight feathers and white-gold studs and crest. Each frame:
  - a bright shine moves round the rim with a tail;
  - the glow pulses;
  - a shine runs round the halo;
  - 14 stars twinkle at staggered times;
  - a sparkle pulses on the king's cross.

**Choices you might want to change:**
- **Four divisions, not five:** d1 now carries the crest, sparkle and glow together.
- **Wings and leaves:** every tier uses the same feather fan in its rim metal. Wood's fan is honey wood, and the two top tiers use the piece's own material. I dropped the sample's separate oak-leaf drawing so the d2 outline is the same in every tier and shows at 24 px.
- **Stud colors:** studs take the piece's color, except Wood (pale honey), Silver (dark steel), Gold (dark gold) and Pearlescent (pink pearl). Those four would vanish against their rims otherwise.
- **Pieces stay recognisable:** the queen is the Sublime sample's queen on the shared base. Sparkles sit on the piece's top-left edge. I kept them off the queen's orb, because there they looked like a king's cross.
- **What 24 px looks like:** my check used plain every-other-pixel shrinking, which loses some outlines. Each tier's color still reads there, and the d4/d3 studs are the subtlest step. If the game shrinks the images with smoothing, they'll look cleaner than in my check.
- **Placement:** everything is drawn 1 px lower so the crest's outline clears the top edge.
