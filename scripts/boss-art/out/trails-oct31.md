# Ride trails, Oct 31

Eric (Oct 31): every ride leaves its own trail while it runs round the town, in place of the white droplets; never in the
idle, never drawn into the ride's own frames. Approved list, about $0.50 a ride, cap $25. Each ride ran
`--rider-trail` (Opus 5.5, effort medium, cap $1.50) and passed the trail check (the mark within its box, and the
ride's frames changed only by what was taken away). Briefs: `briefs/<id>-trail.md`. GIFs: `out/<id>/ride.gif`.

| Ride | Its trail | Taken out of its frames | Cost |
|---|---|---|---|
| riding-chirp | tiny grasshopper footprints, left and right in turn | nothing | $0.30 |
| moon-ride | a little dust of fading stars | the sparkle trail in its move, every view (18 frame pictures) | $0.62 ($0.26 first try, API error; $0.36 retry) |
| hollow-bulb | a dark smoky smudge with a glint of the glow's color (p2) | nothing | $0.20 |
| smudgy-brush | dabs of paint in the item's color | the color ribbon in its move and the color wisp in its idle (26) | $1.04 ($0.33 + $0.71) |
| alfil-howdah | big round mammoth footprints | nothing | $0.26 |
| balloon-pup | little balloon-dog paw prints | nothing | $0.25 |
| bigboy-buggy | two thin wheel tracks | nothing | $0.22 |
| boingo-pogo | one round bounce mark per hop | nothing | $0.26 |
| folio-crane | a few tiny folded-paper scraps | nothing | $0.27 |
| ginger-sled | two runner tracks with a few candy-colored specks | the snow puffs left behind the runners (30) | $0.25 |
| jefferson-giraffe | two-toed hoofprints | nothing | $0.32 |
| puddles-mower | a short strip of fresh-cut grass clippings | the clippings and exhaust puffs left behind (24) | $0.81 ($0.33 + $0.48) |
| sawyer-dozer | tread marks | the dirt crumbs and puffs left behind (14) | $0.40 ($0.24 + $0.16) |
| rodeo-bull | hoofprints with a small dust puff | nothing | $0.35 |

**Total: $5.55** of the $25 cap ($1.16 of it on four first tries lost to a runner bug).

**Hollow's Bulb glow (the extra fix):** done by hand, $0. The glow's core, halo, ring and ground glow now come from the
second color (`p2`, `colors: 2`), still pulsing slowly in the idle; nothing else changed.

**Runner fixes made on the way** (`run.ts`):
- The spend guard read pictures' base64 as text, so every first turn looked like $1.87 to $3.05 and was refused under the
  $1.50 cap (nothing spent). It now counts a picture as about 1,600 tokens.
- The trail check's refusal sent its before/after pictures in an error tool result, which the API rejects ("all content
  must be type text if is_error is true"). It now goes as a plain result. That bug stopped moon-ride, smudgy-brush,
  puddles-mower and sawyer-dozer (the four with something to take out); they were reset to their committed drawings
  and run again.

**Open:**
- The trail check and these pictures show p2 as the item's own color (the GIF) or yellow (the color row); the bulb's
  glow and its trail glint will follow whatever second color the game rolls.
- The ten-ride commit's message says $2.46; those ten cost $2.68 (this table is right).
