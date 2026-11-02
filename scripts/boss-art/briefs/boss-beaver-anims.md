# Timber, the beaver builder: his full animation set, Nov 1 (Eric's design, approved)

Your file `scripts/boss-art/out/boss-beaver/boss-beaver.ts` **already holds Timber's approved still and idle** (read it
first; its briefs are `scripts/boss-art/briefs/boss-beaver.md` and `boss-beaver-vest.md`). Eric approved this look:
**keep it exactly**. The idle's 24 frames must stay pixel for pixel as they are (same pose, face, palette, hat, vest,
planks, belt and tools, tail, timing). Build on it: add rigging (arm, head, jaw, eye and hat positions as numbers, like
the finished bosses' `pose()` rigs: read `packages/app/src/characters/gardener.ts` and `tiger.ts`) without changing what
the idle draws, then add the animations below. Keep the export `BOSS_BEAVER`, id "boss-beaver". His name is **Timber**.

## Who he is
A stout, friendly brown beaver builder, proud of his craft: orange hard hat, orange safety vest, yellow tool belt
(red-handled hammer, tape measure, wrench, pouches), two crossed planks strapped on his back, a crosshatched paddle
tail, **big buck teeth**. **No pencil** anywhere. No letters or numbers. Facing a little to our left (toward the board),
light from the top left.

- **His passive, the Workshop:** scraps of wood come to him through the battle; he builds chess pieces with them in a
  workshop above the board, and drops a finished piece onto the board.
- **His ultimate, the Gnaw:** he chews up one of the player's pawns with his buck teeth, turning it into scraps.

## The animations (frame counts and lengths like the gardener's and the tiger's)
The usual set, every one in his character (a craftsman, cheerful, a bit gruff when things go wrong):
- **idle**: as it is. Don't touch it.
- **entrance**: he arrives (drops or stomps in), sets his hard hat, a confident hammer twirl or tap.
- **thinking** (loops): sizing up the board like a job, a paw on his chin or squinting along the hammer like a level,
  a tail tap.
- **move**: a quick work gesture toward the board (a hammer point or a tap), then back to rest.
- **capture**: a satisfied hammer swing, a few wood chips.
- **hurt**: flash and shake, his hat knocked askew, then he straightens it.
- **check**: a firm point of the hammer at the board.
- **smug** (loops): arms folded or hammer on his shoulder, a toothy grin.
- **rattled** (loops): worried, sweat, tail twitching, hat slipping.
- **defeat**: hat falls off, he sits down hard, tools spill; the last frame holds.
- **victory** (loops): he cheers, hammer high, tail slapping the ground, wood chips like confetti.

His own moments (name them exactly so):
- **`scrap`** (about 1 to 1.5 s, plays once; the Workshop, a scrap added): he catches or picks up a small scrap of wood
  and **hammers it into place** with a couple of taps (a little puff of sawdust on each tap, a cue `tap` on each), toward
  our upper left (the workshop sits above the board).
- **`build`** (about 1.5 to 2 s, plays once; the Workshop, a finished piece dropped): he **reaches back and pulls a plank
  off his back**, shows it off, and swings it down toward the board as if setting the piece down (a cue `drop` on the
  frame the piece would land). The planks on his back return by the end (two again), so the idle picks up seamlessly.
- **`gnawWarn`** (loops, about 1.5 s; the warning before his ultimate): he bares his big buck teeth, licks his lips,
  clacks the teeth together, eyes narrowed and gleeful: hungry for wood.
- **`gnaw`** (about 1.5 to 2 s, plays once; the ultimate): he leans in and **chomps** with his big buck teeth, quick
  repeated bites (jaw open, closed, open, closed, a cue `chomp` on each bite), wood chips and splinters flying from his
  mouth, then a satisfied chew and a little burp of sawdust.
- **`cheer`** (about 1 s, plays once): a quick proud nod when a piece he built lands.
- **`bigCheer`** (about 1.5 s, plays once): a big one (his queen finished): hammer up, a hop, a tail slap.

If there's budget left after all of these look good, add his attack on a king like the gardener's `GARDENER_ATTACK`
(a second export `BOSS_BEAVER_ATTACK` on the shared `KING_ATTACK` beats: drop in, lash the king with hammer blows, drop
out). Skip it rather than rush the rest: it's optional.

## Quality bar
Look at each animation at 4x before calling done, and the idle and the face at phone size beside another boss. The
idle must be unchanged. Board effects (the workshop strip, pieces under construction, the pawn being eaten) are drawn
by the game's code later: draw only Timber and what's in his paws or mouth (scraps, chips, sawdust, the plank).
