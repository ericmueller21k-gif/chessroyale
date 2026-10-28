# Boss art: rank-top-transcendent

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 21 turns, 14 renders.
- Spend: **$2.08** of the $20 cap (44 input, 262,257 cache-write, 2,616,377 cache-read, 90,467 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rank-top-transcendent/rank-top-transcendent.ts.
- Previews: scripts/boss-art/out/rank-top-transcendent/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/rank-top-transcendent/looks/.

## Its notes

File: scripts/boss-art/out/rank-top-transcendent/rank-top-transcendent.ts, exported as RANK_TOP_TRANSCENDENT with id "rank-top-transcendent". The frame is 48x48 and the emblem fills about 44x44 with wings and crest. I looked at the idle at 12x, 8x and 5x, on dark and light backgrounds. The 1x and 2x phone-size view is beside the tiger. I couldn't render an actual 24 px version, so I judged that size from the 1x view. The render shows no frame-edge warnings.

**Design.** It has all the division-1 steps, plus extras.
- Badge: a 32x32 octagon of eight facets in violet and indigo, lit from the top left, around a deep indigo table.
- Piece: a starlight king in pale lavender and white, with a big cross, a crown with white-gold jewels, a collar and a flared base. It stands on the lower bevel, in front of the badge.
- Halo: a thick white-gold ring behind the king's head, on a dark disc so the king reads against it. It has a soft violet glow band around it.
- Studs: four white-gold gems on the badge's diagonal corners.
- Wings: a fan of four outlined starlight feathers on each side.
- Crest: a cut white-gold gem on top, between two small feather horns.
- Glow: a thin see-through violet glow round the whole badge.
- "A little more": a twinkling star field inside and outside the badge, a glint on the cross, a shine travelling round the facets, and a bright arc travelling round the halo.

**idle** (8 frames x 250 ms = 2 s, loops). The emblem itself doesn't move; only the light does.
- Facet shine: a highlight steps clockwise round the eight facets one per frame, with a dimmer tail behind it.
- Halo shine: a bright arc travels round the halo ring, one 45° step per frame.
- Pulse: the glow round the badge, the glow bands round the halo, and the gold of the halo and gems swell softly, dimmest at frame 0 and brightest at frame 4.
- Twinkle: twelve stars each run dot, small plus, bigger plus, back to nothing, at different phases. The four big outer stars are white-gold.
- Glint: a gold-white sparkle grows and shrinks on the cross's left arm.

**Choices you might change**
- The glow round the badge is see-through. On the dark ground it reads as violet. On a light ground it is pale lavender, and the white-gold outer stars fade out.
- The halo is a full ring, not a floating oval above the head. I chose it because it reads at small sizes; the king's body hides its lower half.
- The wings and crest horns are starlight lavender, not gold. Gold is kept for the halo, gems and studs, so the emblem doesn't read as the Gold tier.
- The king's gold crown jewels and body sparkles are a few single pixels. If they look like specks at 24 px, drop them.
- The idle needs no cues or extra animations, so I added none.
