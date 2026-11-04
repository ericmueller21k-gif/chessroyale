# Brief: Ginger's igloo candy shop and his intro, into the game (code; Opus high)

Worktree `/home/user/cr-ginger`, branch `claude/ginger-home`, from main 70733948 (the director creates it). `npm ci`, never a
node_modules symlink. Push as you go. Ports: 8983, inspector 9483. Include notes/briefs/rules-common.md. Eric approved the design
(Nov 5) and OK'd the stills; Ginger (kit `gingerbread`) is live, so this goes to everyone. Same flow as Jefferson's warehouse (#489/#491
era): straight through to a pushed branch, no review stops.

**Art** on `origin/claude/boss-art` (head 6ef02ce9): read `scripts/boss-art/out/shop-ginger-nov5.md` and `intro-ginger-nov5.md`
whole first (they are exact: squares, heights, feet, cues, timeline). Copy in as Jefferson's (`grex-*`), Wrangler's (`pig-*`) and
Hollow's (floor mask) were: `house-shop-ginger/{house-shop-ginger.ts, candy-kit.ts}` (candy-kit imports `warehouse-kit.ts`, already
in the game), `npc-ginger-elf/`, `sidekick-ginger-elf/`, `boss-ginger/` (`BOSS_GINGER_INTRO`), `house-intro-ginger/`, `ginger-sled/`
only if the ride's art differs from the game's (`ride ginger-sled` is already wired: check).

## 1. The igloo (as Jefferson's #489; the round floor mask as Hollow's #480)
- Ginger Igloo's card: its line, then **"Go in"** (no "Shop" / "Coming soon").
- Inside: the header "Ginger Igloo", the round room with `SHOP_GINGER_FLOOR`, lights at every placement, the walls exactly as the art
  (overlapping 45 px cards: no gaps or outside colour anywhere inside).
- **The shopkeeper elf** (Santa hat) behind his half-round stand: tag and card "Shopkeeper", "Talk"; baked with
  `scripts/bake-sidekicks.ts` (update town-bots' count). Ginger's town kid stays a town bot.
- **Ginger's Boss Crate** in `BOSS_CRATES`: `bossCrate("gingerbread", "Ginger's Boss Crate", "ginger-sled")` (Candy Cane Sled;
  out of NO_CRATE_YET if it's there); the Crates tab and FAQ; the server's boss-tokens test gains `["gingerbread", "ginger-sled"]`
  (check both ids: the boss id is `gingerbread`, which is also a skin item id: make sure nothing collides).
- **Two levels (new for shops; this is what Eric will test first):** your pawn can walk up either staircase onto the catwalk
  (deck height `SHOP_GINGER_DECK_H` 40), along it, and down the other. Per the notes: west stairs (5,5) low / (6,5) high, foot (5,6),
  catwalk (7,5),(8,4),(9,4),(10,4),(11,4),(12,5), east mirrored (14,5)/(13,5), foot (14,6). The figure's height follows the steps
  smoothly (each step's height from the notes, interpolated across the square: no pops, no hovering, no sinking into a step), drawn
  in front of / behind the deck and the bays correctly from every camera place, and the pawn can't walk off the deck's front edge
  (only on and off via the stairs). Tap-to-walk and arrow keys both route via the stairs (tap a deck square from the floor: it walks
  to the nearer free staircase and up). **If elves are on a staircase or blocking the catwalk, your route takes the other staircase;**
  if both are blocked, it waits as Jefferson's crew does. Eric (Nov 5): "The real test will be when I try to run up the stairs with
  the pawn and just see if it connects properly. As long as it's not buggy and it's actually connected to the ground and it's just
  like a continuous thing." Make that solid: unit tests on the height curve (continuous, floor 0 at the foot, 40 at the deck) and an
  e2e that walks up one stair, along, and down the other on phone and computer, with stills of each step.
- **The elves:** the walkers on their loops, the dispensing pair (box elf + notepad elf) on their ~47.5 s loop through the 5 lower and
  5 upper stops (they climb the same stairs: same height curve), chatting. They stop and wait when your figure is on or right in front
  of their next square (as Jefferson's crew, `Walker.peek()` / `halt()`), and block walking where they are. Every number in the shop
  feel; no server state.

## 2. His challenge intro (custom; boss LEFT, you RIGHT; about 13.2 s; per intro-ginger-nov5.md)
- Walk on to the marks (8, 9.5) / (11, 9.5); his line, the big bubble (placeholder **"Cold enough for you?"** until Eric's Gemini lines).
- Charge, blast up, the icicle falls point first and stabs the floor (crack, snow puff); its round flat top is the table (27 px, no
  stools needed: check the notes). The two carriers come out of the stockroom door ("Coming, boss!"), run over and toss the board up onto
  it. He casts and the pieces appear from a small white light. The God King attack swing (as the others), then **the wipe**: blizzard of
  snowflakes and colored candy canes (`INTRO_GINGER_STORM` + `_FRONT`).
- **His own camera:** `INTRO_GINGER_CAM` (west 0: centred on the table). Add a per-boss `cam` override on BossIntro; every other boss
  unchanged (a test that their cameras are identical to before).
- Wire as Jefferson's (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, `ginger-intro-art.ts`): every beat a feel number;
  lazy-loaded; nothing pops in at the end (table and board in place before any cover; nobody steps after it lands); his sounds for every
  cue (ice charge, blast, whistle-fall, crack, puff, footsteps, toss, cast sparkle, wind for the wipe); synthesized ones must pass
  `boss-sounds-finite.test.ts` and the no-chimes test if it applies.
- **Sprites always on screen (Eric, Nov 4).** No emoji for him anywhere (Nov 5 rule): name and/or portrait.

## Done
- Unit: room/mask (round floor, stairs feet), wall cards cover every edge square, crate, shopkeeper sheet, the two-level height curve and
  routing (both stairs, the other stair when one is blocked, no walking off the deck), elves' loops clear of the table and marks and
  stopping when blocked, intro beats in order ~13 s, every cue a sound, the per-boss camera only for Ginger.
- e2e: `e2e/shop.spec.ts` (go in, the shopkeeper, the crate, up one stair / along / down the other, an elf stops when you block it),
  `e2e/boss-challenge.spec.ts` (his challenge to the board and back), the town card test; any ride/crate counts updated.
- Frame rate: the igloo vs Jefferson's warehouse (phone 390x844, computer 1440x900, headless, walking 5 s, medians); if more than ~3 fps
  slower, cut cost before trimming elves. Report the numbers.
- Stills `docs/ginger-home/` (room, shopkeeper, the pawn on a stair / on the catwalk / at the bottom of the other stair, an elf blocked,
  intro start, the icicle landed, the board on it, the wipe), phone and computer. No GIFs.
- PR body `docs/ginger-home/pr-body.md` (every player-visible change and new text, changed checks old → new, lane full e2e: the crate
  is shared). Push; no PR. Short report.
