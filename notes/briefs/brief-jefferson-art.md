# Brief: Jefferson's firework warehouse, his crew, his intro and wipe (art, all at once; Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art` (shared: `git pull --no-rebase origin claude/boss-art` before each
push, with `timeout 60`; never force-push). **Drawn by hand on the weekly plan usage (Eric, Nov 4), not the API runner.** Same files
and format the runner makes. Art only: no app code (a code round wires it right after: be exact in the notes). Include
notes/briefs/rules-common.md. Eric approved this scope (Nov 4, going to sleep): it runs straight through to live overnight, no
review stops; he'll look tomorrow. A handful of stills for the code round only, no GIFs.

## Read first
- Jefferson (the giraffe; kit id `grex`): the game's `packages/app/src/characters/grex.ts` (his rig, palette, his sparkler/firework
  powers), `characters/jefferson.ts`, his town home `packages/app/src/town/houses/grex.ts` ("Jefferson's Fireworks", the stand).
- Shops to copy for exports and structure: Wrangler's barn (`out/house-shop-pig/`, `out/shop-pig-nov4.md`) and Hollow's cave (a
  floor mask: `out/house-shop-hollow/`, `out/shop-hollow-nov3.md`). Intros: `out/intro-pig-nov4.md` + `house-intro-pig/`,
  `out/intro-timber-nov3.md`. A sidekick: `out/sidekick-pig-rooster/`.
- Fonts/lettering on props: the HunChess bucket (`out/house-shop-pig/hunchess-bucket.ts`).

## Eric's design (his words, Nov 4): a shady firework warehouse run by giraffes
### 1. The room (`house-shop-grex`): a packed warehouse, about 15 x 15 squares
On the 20 x 20 grid, with a floor mask (`SHOP_GREX_FLOOR`, as Hollow's) making the walkable floor about 15 x 15, square; everything
round it is stock. Exports as the other shops (`SHOP_GREX_PIECES`, `_LAYOUT`, `HOUSE_SHOP_GREX`, `_COUNTER_SIGN` (none needed: see the
shop), `_CRATE_AT`, `_MARKS` boss west / you east, `_LIGHTS`, `_POOLS`). 37 px squares.
- **Pallet racking** like a warehouse club: tall steel shelves (orange beams, blue uprights) with pallets of firework boxes stacked
  high. Copy-paste rows of pallets with slight variations are fine (Eric). Plus pallets on the floor, loose fireworks in open boxes.
- **Firework packaging with made-up names**, some nodding to the bosses, on the boxes (small pixel lettering, readable where it can be):
  e.g. "BOINGO BOTTLE ROCKETS", "TIMBER TUMBLERS", "DASH DAZZLERS", "WRANGLER ROUNDUP", "HOLLOW NIGHT LIGHTS", "BIG BOY BOOMERS",
  "PUDDLES POPPERS", "MOON SHOT", "ROMAN CANDLES", "SKY STRIPES". No real brands or company names.
- Concrete floor, painted aisle lines, a "NO SMOKING" style sign is fine as a joke only if generic.
- **The battle spot in the middle**, with room round the table for three giraffes to stand.
- **The board already stands there: on a wobbly stack of wooden crates** (4 or 5 crates high: tall, because giraffes like it high;
  idle: a slight wobble). Its slab top height in the notes.
- **The shop**: "literally just a guy in the corner": a **shady giraffe** (sunglasses, a toothpick, a trench coat) standing in a corner,
  with a **little white sign taped up with "SHOP" written on it like Sharpie** (hand-drawn black letters). Jefferson's Boss Crate sits
  by him (a firework crate, fuse sticking out; idle: the fuse sparks). He is the shopkeeper: `sidekick-grex-dealer` (idle, walk, sit,
  wave), giraffe-sized (taller than the other kids; say his foot and height).

### 2. The crew (moving, on loops: the code makes them follow paths and stop when you block them)
- **The lift guy**: a giraffe worker (hard hat, hi-vis vest) on a **scissor man-lift that's barely raised** (the joke: he doesn't need it).
  The lift with him on it: `npc-grex-lift` frames: idle, drive (wheels, beacon light flashing), and the platform up a tiny bit.
- **The forklift guy**: a giraffe worker in a **forklift**: `npc-grex-forklift`: drive, forks down, forks up with a pallet, forks up
  without; a loose pallet piece (`pallet`) the code can hand from the floor to the forks to a shelf slot. His loop: drive to a floor pallet,
  pick it up, raise it, stack it on a shelf slot, back off, drive back (the code loops it; in the notes give the path squares and the shelf
  slot).
- Both workers' **walk** too (off their vehicles), for the intro (they come over). Facing both ways or mirrorable.
- Give both loops as square paths in the notes (`SHOP_GREX_LIFT_PATH`, `SHOP_GREX_FORK_PATH`), clear of the racking, the table and the
  marks.

### 3. His challenge intro (boss LEFT, you RIGHT; it may run a little longer, about 13–15 s)
1. You both walk to the marks. He calls the crew, one line at random (the code shows it; no art): the code round has them.
2. **The crew stop what they're doing and come over**: the lift guy and forklift guy step off their machines and walk over, the shady
   dealer too, and they stand round the table behind (a loose ring), watching (idle: a nod, a toothpick flick for the dealer).
3. **Your lift:** a square floor tile at your mark rises on a **cylindrical piston** out of the floor and lifts you up to his height,
   level with the board on its crates. Frames: `INTRO_GREX_LIFT` (the tile flush, rising, up; the piston's height in px per frame).
4. (The code adds his God King attack swing as for the others.)
5. **The wipe into the match:** sparklers and fireworks: a sweep of bursting fireworks, sparkler trails, stars (`INTRO_GREX_STORM`
   + `INTRO_GREX_FRONT`). Bright, but no flashing faster than the other wipes.
- His moves if he needs new ones (`out/boss-grex/boss-grex.ts`, `BOSS_GREX_INTRO`): a call (cupping a hoof to shout), a wave-over,
  his brag. Same frame and foot as his sprite.
- The crate stack table (`INTRO_GREX_TABLE`, the same geometry as the other intro tables, palette and board colors), his side has no
  stool (he stands); your side is the piston lift.
- Cues for sounds (his shout, footsteps, the piston hiss and clunk, the crates' creak, fizz, pops, whistles, bangs (soft)), and a
  suggested timeline in seconds.

## Rules
- **Sprites always on screen (Eric, Nov 4):** at rest and where every move ends, from the challenge camera (phone and computer).
- No real people, brands or film references; toy-like fireworks, nothing realistic about explosives beyond cartoon bursts.

## Deliver
Notes `scripts/boss-art/out/shop-grex-nov4.md` (room: piece table, mask, layout, the paths and shelf slot, the marks, the table's
height, the dealer, calls) and `out/intro-grex-nov4.md` (exports, feet, cues, timeline, calls). A handful of stills (the room, the
fight-start view on phone and computer, the intro key frames as one sheet, the crew and vehicles sheet). Push. Reply with the head sha,
file paths and calls.
