# King attacks for Sawyer, Wrangler and Boingo (Oct 18, 2026)

**Eric (Oct 18):** "When the king did a save move, he came down and attacked him. That was super cool. We definitely
want to get those going for a couple more of the bosses that don't have them." Then, on how: make each one **a
relentless assault for the whole attack window**, many quick hits back to back (he finds that funny); Boingo keeps
throwing pie after pie, a splat on each; Wrangler keeps swinging and cracking the lasso at him, **never actually
lassoing him** ("we don't want some special animation where it actually interacts with the king"); Sawyer saws away
nonstop with sawdust flying. Inside the Last Stand's timing, no longer overall; the sounds not overwhelming.

## What was built

Each is a second character beside the boss's own (`SAWYER_ATTACK`, `PIG_ATTACK`, `CLOWN_ATTACK`), drawn from his own
parts, poses and palette, on the shared beats every boss's attack has (`KING_ATTACK`: drop in, a hit on each of ten
beats 170 ms apart from 560 ms, leap off at 2380, gone at 2780). Each has a hit effect on the king's square (one new
effect sprite each), his own sounds, three `kingAttack` lines, and is in `KING_ATTACKERS`, so solo and the server hold
his mate for the attack (3.88 s) as they do for Hollow's and Alfil's. Their frames: a shared helper
(`characters/attack-frame.ts`) moves the boss's own frames into a bigger frame (room toward the king for the prop,
headroom to drop in from) and keeps the landing shadow on the ground.

Beat by beat (ms after the attack starts; in the Last Stand that is 6550 ms after the crowd's move lands):

| ms | Sawyer | Wrangler | Boingo |
| --- | --- | --- | --- |
| 0, 100 | his shadow spreads where he'll land | the same | the same |
| 200, 280 | drops in, saw raised, feet tucked (`swing` whoosh) | drops in, loop whirling overhead (`whirl`) | bounces in from above on his pogo, arms up (`slideDown` whistle) |
| 360 | lands, dust (`hop`) | lands, dust (`hop`) | lands, the spring squeezed, dust (`boing`) |
| 470 | squeezes the trigger, the saw shakes (`rev`) | swings the loop wider, leaning back | a pie up in his hand |
| 560 + 170 x i (ten) | lunges and thrusts the buzzing saw into the king, high then a little lower in turn, sawdust bursting off the blade (`cut`, `swing` in turn); 90 ms later draws it back | cracks the rope straight out, its end snapping in the king's square, high then low in turn (`crack` = `pigYank`, `lash` = `pigCatch` in turn); 90 ms later it's whipped back overhead, spinning | lands a bounce and flings a pie, which arrives at the king at the end of a lob of speed lines (`splat`, `squeak` in turn); 90 ms later he's up again with the next pie behind his head |
| each hit, on the king's square | `sawHit`: a spark and a burst of sawdust flying up and away, then falling (about 200 ms) | `lassoHit`: a white snap, gold rays, rope fibers flicked off (about 200 ms) | `pieHit`: the pie side on, the cream splatting wide and flying on, then sliding down (about 200 ms) |
| 2260 | a gleeful rev, the saw held up | throws his head back and snorts a laugh (`laugh`) | arms up, laughing (`laugh`) |
| 2380 | crouches | crouches | squeezes the spring |
| 2480, 2560 | leaps off (`hop`) | leaps off | bounces off (`boing`) |
| 2640, 2720, 2780 | his shadow shrinks; gone | the same | the same |

The God King's own side is unchanged: a gold "−N" off him each hit, his jolt on each (`lastStandAttacked`), his grunts.

## Calls made

- **Ten hits, on the existing beats.** "A relentless assault" within the same window: a hit every 170 ms from the first
  beat to the last, as Alfil's ten jabs, and the frames between them keep moving (the saw drawn back, the rope whipped
  back overhead, the next pie up), so nothing stops for 1.7 s. More hits would need new shared beats, and the God King's
  frames, the numbers and the server all read those.
- **Sounds varied, not stacked.** Each boss's hits alternate between two sounds of his own pack (Sawyer's cut and the
  swing's whoosh, Wrangler's yank and the softer catch, Boingo's splat and his squeak), never the same twice running.
  The rev, the whirl and the boing are on the drop-in and the landing. A unit test mixes the ten hits as they play and
  keeps the mix under a move's peak and loudness. No new sounds.
- **Wrangler never touches the king.** The rope's end only cracks in the king's square (Eric's direction); nothing is
  drawn round the God King and his sprite is not moved by it beyond the jolt every attack has.
- **Sawyer stands 1.45 squares off, not 1.8.** His saw reaches 0.6 squares past his gloves, so at 1.8 it couldn't reach
  the king; at 1.45 the blade's end is past the king's middle (1.64 squares from his feet) and his gloves stay out of
  the middle of the king's square. Wrangler and Boingo stand 1.8 off, as Hollow does (the rope's end at 2.0, the pie at
  1.9). All draw at 36 frame pixels a square, the same scale as Hollow and Alfil.
- **Sawyer isn't turned round.** He faces our left in all his art. Rather than mirror his frames in code, the kit says
  `facesLeft` and the board mirrors him the other way (one flag in `KingAttack.tsx`), which also keeps his parts from
  being painted on the app's load.
- **The funhouse's turned board.** Boingo can now mate or meet the Last Stand with the board a quarter turned; the
  attack was placed by the king's real square, which a turned board draws elsewhere. KingAttack now places everything
  on the square the board shows (`viewSquare`), as the God King's Last Stand already did.
- **"Clear of the God King"** is measured, not eyeballed: a unit test checks that on every hit frame only the prop's
  colors (the saw and its sawdust, the rope, the pie and its cream) are past the middle 70% edge of the king's square;
  the e2e checks the boss's whole frame stays on screen on a phone and a computer, every frame.
- **The frames script was 1 s early.** `scripts/frames-king-attack.mjs` still started its strip at the Last Stand's old
  beat (5550 ms; it moved to 6550 when the cut-in got a second longer, Oct 15). Fixed, and it takes the boss
  (`hollow`, `alfil`, `sawyer`, `pig`, `clown`) and a window width.
- **The FAQ** said only Hollow attacks the God King in his Last Stand; it now names all five.

## Lines (new, said as he lands, every time)

- Sawyer: "Demolition time!", "Cut it out? Never!", "Timber, your majesty!"
- Wrangler: "Dance, little king!", "Crack! Crack! Yee-haw!", "Git along, your majesty!"
- Boingo: "Pie, pie, and more pie!", "Honk! Extra cream!", "Say cheese… cake!"

## Tests

Unit: `packages/app/test/king-attack.test.ts` (for each of the three: a hit cue on each shared beat, in turn, lasting
the attack exactly; his sounds, never the same twice running, the ten together under a move; the prop past the king's
middle and his body out of it; palette, frame edges and feet; the hit effect from each side, about 200 ms, ending
empty; his lines), `packages/chess/test/king-attack.test.ts` (`KING_ATTACKERS`, the mate hold for them). E2E: `e2e/king-attack.spec.ts`, the Last Stand against each of the three on a phone and a computer, every
frame: every hit, his side and facing, his frame on screen, his sounds, the God King falls, no page errors. Frames:
`npm run frames:king-attack -- <dir> sawyer phone laststand dark gif`.
