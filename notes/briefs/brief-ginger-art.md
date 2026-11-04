# Brief: Ginger's igloo candy shop, his elves, his intro and wipe (art, all at once; Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art` (shared: `git pull --no-rebase origin claude/boss-art` with `timeout 60`
before each push; never force-push). **Drawn by hand on the weekly plan usage, not the API runner.** Same files and format the runner
makes. Art only (a code round follows: be exact in the notes). Include notes/briefs/rules-common.md. Eric's reference photo for the
dispensers: `notes/briefs/assets/ginger-candy-dispensers.webp` (a candy store wall: tall clear tubes of candy above, a row of
gravity-bin dispensers with handles below).

## Read first
- Ginger (kit `gingerbread`): `packages/app/src/characters/gingerbread.ts` (rig, palette, his candy-cane staff and ice/blizzard
  powers), his town home `town/houses/gingerbread.ts` ("Ginger Igloo"), his kid `characters/sidekicks/ginger.ts` (stays a town bot).
- To copy for structure: Jefferson's warehouse (`out/house-shop-grex/`, `out/shop-grex-nov4.md`: floor mask, moving crew with paths,
  the shared kit file), Hollow's cave (a curved floor mask), Wrangler's intro (`out/intro-pig-nov4.md`).

## Eric's design (Nov 5)
### 1. The room (`house-shop-ginger`): inside the igloo, a CIRCLE about 10 squares across
- `SHOP_GINGER_FLOOR` mask: a round floor ~10 across (centered on the grid), ice/packed-snow floor, a short entry tunnel from the
  front. Curved ice-block walls round it (the dome's inside).
- **The back wall, left and right of the shopkeeper: lined with candy dispensers like the photo**, curving with the wall: a **lower
  row** of gravity-bin dispensers (clear bins, handles, candy inside, all colors) and an **upper row** of tall clear tubes of candy.
  Copy-paste with color variations is fine.
- **A wooden shelf (catwalk) running above the first row**, along the curve, so you can walk along it to reach the upper row.
  **A little curved staircase at each end**, following the wall's curve, from the floor up to the catwalk. This is a second walking
  level: mark its squares in the notes (`SHOP_GINGER_UPPER`: the catwalk squares and their height in px; `SHOP_GINGER_STAIRS`: each
  stair's squares from floor to top, with the height per step), and draw the catwalk so a figure on it reads as standing up there
  (shadow on the planks, the rail in front if any).
- **The shopkeeper's stand**: a small **half-round table** at the back center, just big enough for him behind it; **Ginger's Boss
  Crate** on it (a present-like crate, candy-striped).
- **Barrels** scattered round: some filled with loose candy, some stuffed with big candy canes. The side walls and the near area can
  be lighter (less visible) but not bare (frost, icicles, a few sacks/barrels).
- The battle spot in the middle: icy floor (the intro cracks it), room for the table, both figures and two elves to run in.
- Exports as the other shops (`SHOP_GINGER_PIECES`, `_LAYOUT`, `HOUSE_SHOP_GINGER`, `_CRATE_AT`, `_MARKS` boss west / you east,
  `_LIGHTS` (warm candy-shop glow + cool ice), `_POOLS`).

### 2. The elves (`sidekick-ginger-elf` + `npc-ginger-elf-*`)
- **The shopkeeper**: a happy little elf in a Santa hat (`sidekick-ginger-elf`: idle, walk, sit, wave), behind the half-round table.
- **A few elves walking around in different-colored outfits**, each carrying a **big candy cane striped white + his outfit's color**.
- **The dispensing pair** (a loop): elf A walks to a dispenser, **taps it, holds out a box, candy flows in** (frames for the tap, the box
  out, the candy stream, the box full); elf B follows **writing on a notepad**. They do **5 dispensers on the lower row, walk up a
  staircase, cross the catwalk and do 5 on the upper row**, then come back down and repeat. Give the path as squares (`SHOP_GINGER_
  DISPENSE_PATH`) with the stop squares and which dispenser each faces, and say the floor level of each square.
- Shared elf rig, recolors fine. Walk frames for all, facing both ways or mirrorable; climbing frames optional (the code can raise a
  walk along the stairs).

### 3. His challenge intro (boss LEFT, you RIGHT; about 12–14 s)
1. Walk on to the marks; his line (the code's).
2. **He draws power with his magic candy-cane staff** (a glow gathering), then **shoots a blast above the battle spot**.
3. **An ice shard drops**: a block with a **flat top and a spiked bottom**, plummets and **cracks the icy ground** where it lands
   (crack frames on the floor, a puff of snow). It is the table.
4. **Two elves rush over carrying the chessboard** (they say a line: the code's, e.g. "Coming, boss!") and **toss it up onto the ice
   table**.
5. **He casts once more and the pieces appear from a small white magic light** on the board (sparkle frames; the code draws the real
   pieces as the light fades).
6. (The code adds his God King attack swing.) Then **the wipe: snowflakes and a blizzard with candy canes of different colors**
   (`INTRO_GINGER_STORM` + `_FRONT`).
- Seats: none needed: you both stand at the ice table (the director's call; say if the ice table's height needs a step for you).
- His moves (`out/boss-ginger/boss-ginger.ts`, `BOSS_GINGER_INTRO`): charge (staff glow), blast, cast, brag; same frame and foot.
- Props (`out/house-intro-ginger/house-intro-ginger.ts`): the blast, the falling shard (fall frames, landing, the floor crack), the
  ice table (`INTRO_GINGER_TABLE`, the table geometry, palette, board colors, slab top height), the board the elves carry (a flat
  board prop), the white light for the pieces, the wipe.
- Cues for sounds (the charge, the blast, **the ice plummeting into the ground** (a heavy crunch-crack), the elves' footsteps, the
  board's clack, **his cast**, the sparkle, the blizzard), and a timeline in seconds.

## Rules
- **Sprites always on screen (Eric, Nov 4)**; no real brands (the dispensers are generic); no emoji as stand-ins.

## Deliver
Notes `scripts/boss-art/out/shop-ginger-nov5.md` (room, mask, the two levels: catwalk and stairs squares and heights, the dispensers'
squares, the elves' paths and stops, the marks, calls) and `out/intro-ginger-nov5.md` (exports, feet, cues, timeline, calls). Stills:
**the room (`room.png`), a view of the back wall from the challenge camera on phone and computer showing both rows of dispensers, the
catwalk and both staircases** (Eric wants to check these), the elves sheet, the intro key frames sheet. Push. Reply with head sha,
paths and calls.
