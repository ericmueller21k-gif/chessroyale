# Boss art: house-birdie

- Effort high, adaptive thinking. 13 turns, 7 renders.
- Spend: **$1.34** of the $6 cap (28 input, 76,194 cache-write, 597,194 cache-read, 41,881 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-birdie/house-birdie.ts.
- Previews: scripts/boss-art/out/house-birdie/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-birdie/looks/.

## Its notes

Birdie's Station (house-birdie). The render tool wouldn't zoom past 1x for a 250 px tall frame, so I checked it only at 1x and 2x (dark and light, beside house-tiger and house-gardener), not the 4x close-ups of the base and nest the brief asked for.

What's drawn:
- Station: one story, warm wood planks with cream corner boards on a pale stone base; low charcoal shingle roof with a red stripe along the eave and a yellow fascia board.
- Front, top to bottom: round clock (charcoal frame, yellow ring, ticks, two hands, no numbers); sloped charcoal canopy on two slim posts with a yellow edge board and a row of pointed yellow boards; blank cream sign framed in yellow; a pair of wooden doors with a warm glass pane each, in a cream surround, on a stone step.
- Sides of the door: left, an arched lit ticket window with a brass grille and cream counter ledge; right, a lit 4-pane window with a sill; a bench under each.
- Roof corners: left, pennant pole (charcoal, yellow ball) with a red flag with a yellow stripe flying left; right, short brick chimney with a charcoal cap.
- Nest: woven twigs (strands round the rim, some crossing), dark hollow inside, thick rounded front rim, shadowed underside on the ridge; ragged twig ends, long twigs and pale straw strands across it; rim droops over both eave corners, a little lopsided (lower on the right). No eggs.
- At phone size it reads as a station with a big nest and stands as its own building beside tiger and gardener; it's taller than both (they're 120-124 px).

idle (6 frames x 600 ms, loops):
- Flag cycles 3 ripple positions.
- 3 smoke puffs rise from the chimney and drift left, growing.
- One rim twig shifts 1 px in frame 3.
- Right window's glass dims a shade in frames 1 and 4.
- Nothing else moves.

Size: 144 x 250, foot [72, 244]. Nothing touches the sides (nest x 3-141).

Box numbers ("over foot" = px above y 244):
- Body (walls): x 10-133, top y 141 = 103 over foot. Red stripe + fascia y 134-140, x 4-139 (~107 over foot).
- Roof: ridge y 114 = 130 over foot; 27 px from ridge down to the walls; x 26-118 at the ridge.
- Canopy: x 14-130 (y 168-183, front edge y 178, ~60-76 over foot); posts x 15-17 and 127-129.
- Nest: x 3-141; top ~y 70 (174 over foot, twig tips to y 61 = 183); underside ~y 124 (120 over foot); droop to ~y 131.
- Chimney: x 112-123 (cap 110-125), middle x 118, top y 91 = 153 over foot.
- Pennant pole: x 22.
- Door: middle x 72 (HOUSE_BIRDIE_DOOR). Surround x 56-87; leaves 28 wide, y 208-240 (32 tall, a little under the 34-40 asked; 34 with the surround). Step x 52-91.
- Sign: board (38,186,68x19); HOUSE_BIRDIE_SIGN = face {x 40, y 189, w 63, h 13}.
- LIGHTS: door glass 0.85; ticket window 0.8 flickering; right window 0.75; clock face 0.35 with halo 14.
- POOLS: door (rx 22), faint ones under each window.

Choices you might change:
- Height: frame is 250 tall but the top ~60 px are empty except for smoke. Station ~130 over the foot (~175 with the nest).
- Sizes: walls rise 103 over the foot (brief said ~120 including everything), ridge at 130. The extra height fits clock, canopy, a sign tall enough for a 13 px face, and the door one above the other.
- Chimney and pennant stand on the roof's front slope, in front of the nest's drooping ends; the flag flies left, the same way the smoke drifts.
- Smoke is pale see-through white: nearly invisible on the light background, fine over the dark nest and on dark ground.
