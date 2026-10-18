# King attacks for Big Boy, Ginger and Jefferson; Wrangler facing the king; the attack at the board's top (Oct 18, 2026)

**Eric (Oct 18):** king attacks for more bosses, each "a relentless assault" for the whole attack window ("Boingo,
just keep throwing pies at him… the pig just keeps swinging the lasso"); no special interaction with the God King's
sprite (nothing grabs, wraps or carries him); the sounds must not overwhelm. Then, on batch 1 live: "pig was facing the
right and looks like he's hitting him without looking so he needs to make sure he's facing the right way", and "should
we add logic so nothing gets smushed on a phone if the piece blundered is far right or far left on the board?"

Batch 1 is the model (docs/decisions/2026-10-17-king-attacks-sawyer-wrangler-boingo.md): the same shared beats
(`KING_ATTACK`: drop in at 200 ms, land at 360, a hit on each of ten beats 170 ms apart from 560, leap off at 2480, gone
at 2780), one hit effect each (about 200 ms), hit sounds from the boss's own pack in turn, three lines said as he lands,
`KING_ATTACKERS`. Nothing gets longer. Every playable boss but the Hidden Boss (who blocks the God King) now has one.

## What was built

Each is a second character from the boss's own parts, poses and palette (`BIGBOY_ATTACK`, `GINGER_ATTACK`,
`GREX_ATTACK`), with a hit effect on the king's square (`bonkHit`, `frostHit`, `popHit`; their four animations from
one shared helper, `hitAnims` in `effects/common.ts`).

Beat by beat (ms after the attack starts; in the Last Stand that is 6550 ms after the crowd's move lands):

| ms | Big Boy | Ginger | Jefferson |
| --- | --- | --- | --- |
| 0, 100 | his shadow spreads where he'll land | snow whirls where she'll land | his shadow spreads |
| 200, 280 | drops in, lollipop up (`whoosh`) | drops into the whirl, her cane raised and glowing (`jingle`) | drops in, the Roman candle held up in his hoof (`whoosh`) |
| 360 | lands, squashed, dust (`boing`) | lands in a burst of frost | lands and slams the candle down in front of him, splinters and dust (`slam`) |
| 470 | stamps into a tantrum, face red, lollipop wound up behind his head (`stomp`) | her cane drawn back, glowing ice-blue, her eyes icy | lights the fuse, sparks fizzing at its muzzle (`fizz`); at 520 the first fireball leaves in a muzzle flash |
| 560 + 170 x i (ten) | bonks the king with the giant lollipop: overhead onto its head (a rainbow arc behind the candy) then sideways at its chest (a rainbow streaming back), in turn (`bonk`, `swing`), glaring at it, tears flying; 90 ms later wound up again, a foot stamped | jabs the king with her frosted cane, at its head then its chest, in turn (`crackle`, `crunch`), frost flying off the tip; 90 ms later the cane drawn back up behind her, its tip clear over the king | a fireball arcs over and hits the king, a flaming tail and a trail of sparks back to the muzzle (`pop`, `sparkle` in turn); 90 ms later the next leaves the candle in a muzzle flash, the candle tilted for the head then the chest |
| each hit, on the king's square | `bonkHit`: a white star with rainbow rays, then candy-colored stars bursting out (about 200 ms) | `frostHit`: a white puff and ice shards flicking out, the puff thinning away (about 200 ms); never over or on the king's sprite | `popHit`: a white flash in a gold ring, eight sparks bursting out, falling and cooling (about 200 ms) |
| 2260 | a giggle behind his hand (`giggle`) | cackles, cane raised, snow falling | laughs, smoke curling from the muzzle |
| 2380 | crouches | crouches | crouches |
| 2480, 2560 | springs off (`boing`) | leaps off | leaps off, the candle in his hoof (`whoosh`) |
| 2640, 2720, 2780 | his shadow shrinks; gone | the same | the same |

The God King's side is unchanged: a gold "−N" off him each hit, his jolt on each, his grunts.

Lines (new, said as he lands, every time):
- Big Boy: "Bonk, bonk, BONK!", "Bad king! Time out!", "Waaah! Mine! Mine!"
- Ginger: "Frostbite, your majesty!", "Snap! Snap! Snap!", "Feeling a chill yet?"
- Jefferson: "Fireworks, your majesty!", "Ooh! Aah! Ouch!", "Let's light up the king!"

## Calls made

- **Big Boy faces our left** (`facesLeft`, as Sawyer and now Wrangler): his lollipop is in his hand on our left. He's
  drawn front on, so in his attack his eyes glare to that side (a new face, `mad`: his tantrum's wail with his eyes open,
  both pupils to the king), and his face goes red as in his tantrum. He stands 1 square off: the candy reaches 1.13
  squares from his feet, his fist 0.62. The stick is a little longer than when he holds it (16 pixels to the candy, not
  12 to 14): his "giant lollipop" reaching the king from beside it.
- **Ginger stands 0.85 squares off.** Her candy cane is held by its hook end and jabbed out (38 pixels: a little shorter
  than it stands, 50 with the hook), so its tip is just past the king's middle and her body (0.46 squares from her feet)
  stays out of the middle of its square. Between jabs it's drawn back up behind her, its tip over the king, so the jabs
  read as jabs, not a cane left in him. Her eyes glance at the king (a new face, `jab`). Her cold is the glowing cane,
  icy eyes and a small puff of frost on each jab, gone in 200 ms; nothing covers or recolors the God King.
- **Jefferson's candle is planted, not held level.** Every pose is one his Roman candle already has (planted in front
  of him, tilted 26° for the head, 20° for the chest), so nothing new is painted; the fireballs arc over to the king
  as a Roman candle's do. "The fuse is lit on landing": the fizz at 470 ms, the first shot leaves at 520.
- **Sounds.** Each alternates two of his own pack's sounds on the hits, and a unit test mixes the ten as they play and
  keeps the mix under a move's peak and loudness (batch 1's test). Ginger's crackle and jingle together were over (by
  1.3 dB), so hers are the crackle (frost) and the crunch (ice); Jefferson's crackle with the pop was over too, so his
  are the pop and the sparkle (the crackle his Roman candle's whistles end with), now a sound of its own
  (`grexSparkle`). No new sounds were made.
- **Built when first read.** Ginger's and Jefferson's parts are painted as their frames are made (not lazily, as Big
  Boy's are), so their attack frames are built the first time they're read (as their battle starts, by
  `prewarmKingAttack`), not when the app loads.
- **Wrangler faced away from the king** (Eric saw it live). His art faces our left, like Sawyer's, but his attack threw
  the rope to our right and his kit had no `facesLeft`, so the board mirrored him to reach the king and his face ended
  up pointing away. He now cracks the rope out to our left, where his snout points, from his lasso hand (on our left
  anyway), with `facesLeft`; his laugh (eyes squeezed shut) moved off the cracks onto the whip-backs, so his eyes are
  open on the king every hit. Beats, sounds, lines and hit effect unchanged. His frame lost the unused room on the
  right (126 pixels wide, not 127). Before and after: the zooms with this file's PR.
- **A test for where every attacker looks.** Batch 1's tests checked the prop's reach and the mirror, not the face. Now,
  in every hit frame, the face's features in his head part (the snout and eyes, the muzzle, the pupils), against the
  head's middle: a turned head (Sawyer, Wrangler, Jefferson) or glancing eyes (Big Boy, Ginger) must point the way the
  prop goes, by most of a pixel; a face drawn front on (Boingo, Hollow, Alfil, as all their art) must stay front on, so
  it can't be turned away either. And for a king on every file, the board mirrors him exactly when that keeps both
  toward the king. The old Wrangler fails it.
- **The board's top.** He always stood toward the board's middle, so the sides were fine, but his frame (about two
  squares above his feet, more while dropping in) rose over the top of the board when the king was on the top row or
  two: on a phone over the "BOSS BATTLE" line and into the boss bar with his words in it (Hollow on a8 at 390 px: his
  head on the bar's edge; Jefferson's neck would reach into the speech bubble). Now one rule in `kingAttackPlace`
  (KingAttack.tsx), for every boss: where his landed frames (his highest pixel, from the landing to the crouch before
  he leaps) would rise more than 0.4 squares above the board (`ATTACK_ROOM_ABOVE`; a phone has about 0.75 squares
  between the board and the bar, a computer 0.58), he's drawn smaller, shrunk toward the edge of the king's middle on his
  side (`KING_MIDDLE`, 0.35 squares from it, at the bottom of the king's square): his body, outside the king's middle at
  full size, stays outside it, his prop (which reaches past it) still lands on the king, and his feet stay on its row;
  his drop-in and leap are clipped at that line (he comes in from the top of the board). (Shrinking toward the king's
  very middle, the first try, drew Ginger and Sawyer over the God King on the top row.) On the top row that's 0.53 (Jefferson) to 0.75 (Sawyer) of his size; on
  the second row only Jefferson, at 0.92; everywhere else full size. Lowering him instead would put his prop under the
  king, and moving him to the side doesn't help with height. A unit test places every attacker at all 64 squares,
  either way up: never more than the room above the board, full size from the third row, never under half, his feet on
  the king's row, his prop past the king's middle, within the board's width give or take half a square.
- **The frames script** takes `sq=a8` (h8, e8, a1, h1): a position set on the runner first, so your move and the God
  King land on that square; and `stills`, for frames only at the attack's beats.
- **The FAQ** said "against a boss with an attack of its own"; every boss you can meet has one now, so it lists all
  eight.
