# Brief: Wrangler's barn, rooster, Pen Pony, intro and wipe (art, all at once; Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art` (shared: `git pull --no-rebase origin claude/boss-art` before each
push; never force-push). **Drawn by hand on the weekly plan usage (Eric, Nov 4), not the API runner.** Same files and format the
runner makes. Art only: no app code (a code round wires it right after, so be exact in the notes). Include
notes/briefs/rules-common.md. Eric approved this scope (Nov 4) and wants it live fast: **no review GIFs**; a few stills for the
code round only.

## Read first
- Wrangler: the game's `packages/app/src/characters/pig.ts` (PIG, PIG_ATTACK, palette `PIG_PALETTE`, his lasso art), his town home
  `packages/app/src/town/houses/pig.ts` ("Wrangler's Stall"), his piglet `characters/sidekicks/wrangler.ts` (stays a town bot).
- A box shop to copy for structure and exports: Timber's or Dash's (`out/house-shop-blitz/house-shop-blitz.ts`,
  `out/shop-blitz-nov3.md`, `briefs/blitz-house-and-shop.md` §2). A sidekick: `out/sidekick-hollow-dog/`. A ride:
  `out/hollow-bulb/`, `out/hollow-steed/`, `out/moon-ride/`, `out/rides-tokens-nov1.md`. An intro with a table, stools and a wipe:
  `out/intro-timber-nov3.md` + `house-intro-timber/` (and `intro-blitz-nov3.md`).

## 1. The barn (`house-shop-pig`): a normal 20 x 20 box room, 37 px squares
Exports as the other shops (`SHOP_PIG_PIECES`, `SHOP_PIG_LAYOUT`, `HOUSE_SHOP_PIG`, `SHOP_PIG_COUNTER_SIGN`, `SHOP_PIG_CRATE_AT`,
`SHOP_PIG_MARKS` boss west / you east on one line, `SHOP_PIG_LIGHTS`, `SHOP_PIG_POOLS`).
- Plank walls and beams, straw on the floor, hay bales stacked, a hanging lantern or two, his coiled ropes hung on the walls, a
  saddle on a rail, a water trough.
- **Two wooden pens** with **chess knight pieces, black and white**, hopping around inside (idle: little L-shaped hops, a skip).
- **The board on its stand, set back in a far corner**: the stand is **a hay bale** with the chessboard on top. It must be clearly
  visible from the challenge camera (you both on the marks). Say its square and its hay-bale foot in the notes: the intro lassos it
  and drags it to the middle.
- The counter at the back, ≤ 32 px tall, a blank plaque; **Wrangler's Boss Crate** on it (a wooden crate, rope round it, a gold star
  brand; idle glint).
- Mark a clear battle spot in the middle (straw, maybe a rope ring on the floor) with room for the table and two stools.

## 2. The shopkeeper: a rooster (`sidekick-pig-rooster`)
A `Character` like the other sidekicks: idle, walk, sit, wave. A proud, scruffy barn rooster (maybe a tiny bandana), stands on or
behind the counter. Readable at the other kids' size.

## 3. The ride in his crate: Pen Pony (`ride-pen-pony`)
A mythic ride: one of his pen knights, saddled, that you ride; it moves in little hopping skips. Same format, frames and anchors as
the other rides (rides-tokens-nov1.md). Name "Pen Pony".

## 4. His challenge intro (Eric's design; boss LEFT, you RIGHT; about 12 s)
1. He spins his lasso overhead, throws it at the corner, and **yanks the hay bale with the board on it** into the middle (it slides
   / bumps across the straw).
2. He **crosses his arms and throws two ropes at once, one each way** (right arm across to the left, left arm across to the right),
   off screen. He yanks, and **a white bucket and a black bucket** (big 5-gallon buckets with handles) come **tumbling** in from
   either side and **land upside down as the stools** beside the table. The grab itself is off screen: only the ropes and the
   tumbling show.
3. **The wipe into the match** (like Timber's sawdust sweep): spinning **spurs**, **tumbleweeds**, and **clearly toy cap-gun pistols**
   that pop out a **"BANG!" flag**. Playful, nothing realistic.
- His moves (`BOSS_PIG_INTRO`, id `pig-intro`, added as lines to a boss file or a new `out/boss-pig/boss-pig.ts` built from the
  game's rig): spin, throw, yank (pulling, heels dug in), crossThrow, doubleYank, brag. Same frame and foot as his sprite.
- Props (`out/house-intro-pig/house-intro-pig.ts`): the rope (a loop and a line the code can stretch between hand and target), the
  hay bale + board stand (`INTRO_PIG_TABLE` + palette, the same geometry as the other intro tables), the buckets (tumble frames, then
  upside-down `stool` frames, white and black), the wipe (`INTRO_PIG_STORM` + `INTRO_PIG_FRONT`).
- Cues for sounds (lasso whirl, throw, yank, the bale's slide, rope snaps, the buckets' clatter and thunk, spurs jingle, the pops):
  list them; his existing `pig-sounds.ts` where they fit.
- A suggested timeline in seconds.

## Rules
- **Sprites always on screen (Eric, Nov 4):** at rest and where every move ends, everything on screen from the challenge camera
  (phone and computer).
- No real people, brands or film references.

## Deliver
Notes `scripts/boss-art/out/shop-pig-nov4.md` (the barn: piece table, layout, the board's corner square, marks, calls) and
`out/intro-pig-nov4.md` (exports, feet, cues, timeline, calls). A handful of stills only (the room, the fight-start view, the
intro's key frames as one sheet). Push. Reply with the head sha, the file paths, and the calls.
