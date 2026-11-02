# Boss art (rider): puddles-mower

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 10 renders.
- Spend: **$0.94** of the $6 cap (32 input, 58,265 cache-write, 480,594 cache-read, 27,705 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/puddles-mower/puddles-mower.tsx.
- Previews: scripts/boss-art/out/puddles-mower/preview/idle.png, scripts/boss-art/out/puddles-mower/preview/move.png, scripts/boss-art/out/puddles-mower/preview/look.png. Each look it took: scripts/boss-art/out/puddles-mower/looks/.

## Its notes

I drew Puddles's Mower (mythic, id "puddles-mower"): a chunky little riding mower in side view, facing right. The pawn sits in a hippo-pink seat, and the cushion's front edge hides its lower part (pawnX -6, pawnY -17, cut 70). It has a rounded hood with grille slots and a headlight, a big back wheel and a small front wheel with turning tread marks and brass hubs, and a small steering wheel on a column. A canvas grass bag hangs behind, and a pink flower with a brass centre stands in a brass holder on the seat back. A chrome exhaust pipe sits under the bag. I rendered and checked all of it: idle and move frame by frame at 4x with white and black pawns, town size, and every colour scheme.

**Painted part:** the body, hood and rear fender take the item's colour; there's a darker band along the bottom of the hood and a soft highlight on top. Fixed: black tyres with brass hubs, the seat in hippo pinkish-grey (a nod to Puddles), the tan canvas bag, the steel exhaust and bag frame, the pink flower with its leaf, and the cream headlight.

**Idle** (12 frames × 110 ms): the engine chugs with a tiny jiggle every other frame, and the pawn bobs half a step behind it. The flower nods slowly on its stem. Once per loop (frames 5–9) a little grey puff comes out of the rear pipe and rises and fades.

**Move** (8 frames × 70 ms, dx 0 → 87.5 in even steps): the wheels turn 45° a frame, so the loop joins cleanly. The mower bounces with the chug, the pawn leans forward 2°, and the flower nods back and forth. Puffs leave the pipe at frames 0 and 4 and stay where they were left as the mower drives on. Every frame, four lime clippings spray up and back from behind the rear wheel, land on the ground and stay there as a trail that fades. All of this is worked out in fixed town positions, so it carries over smoothly into the next square's move.

**Things you might want to change:**
- The clippings read well at 4x, but at town size they're only a faint green trail on the ground.
- I made the bag tan canvas rather than hose green so the green clippings show up against it.
- Brass hubs on the Yellow scheme blend into the body a little.
- Exhaust puffs come out the back, low down, so they never float over the pawn's head.
- The description joke is "Top speed: a brisk stroll."
