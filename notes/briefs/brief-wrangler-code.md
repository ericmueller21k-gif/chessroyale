# Brief: Wrangler's barn and his intro, into the game (code; Opus high)

Worktree `/home/user/cr-wrangler`, branch `claude/wrangler-home`, from main **after PR #482 (bigger figures, the cave bubble) merges** — it touches the same intro/bubble code. Set it up with `git worktree add` + `npm ci` (never a
node_modules symlink). Push as you go. Ports: 8981, inspector 9481. Include notes/briefs/rules-common.md.
Eric approved the whole build (Nov 4) and wants it **live**; Wrangler is live, so this goes to everyone (not admins-first).

**Art** on `origin/claude/boss-art` (head 606565da; read with `git show`; copy in as Hollow's and Timber's
were): the notes `scripts/boss-art/out/shop-pig-nov4.md` and `intro-pig-nov4.md` first, whole. `house-shop-pig`,
`sidekick-pig-rooster`, `ride-pen-pony`, `boss-pig` (`BOSS_PIG_INTRO`), `house-intro-pig`.

## 1. The barn (as Hollow's #480 / Timber's #472 / Dash's #477)
- Wrangler's Stall's card: his line, then **"Go in"** (no "Shop" / "Coming soon").
- Inside: the header "Wrangler's Stall", the room from the art (box room), the lights at every placement, the pens' knights hopping
  (idle), the board on its hay bale in its corner (drawn as a room piece until the intro takes it).
- **The shopkeeper: the rooster** (art: behind the counter at [9.5, 2], only his head shows; Eric's pick was ON the counter: add a
  shopkeeper lift so he stands on the counter top and reads clearly, without breaking the other shops), tag and card "Shopkeeper", "Talk"; baked with `scripts/bake-sidekicks.ts`
  (`town/sidekicks/<name>.png`, `sidekick-sheets.ts`; update town-bots' count). The piglet stays a town bot.
- **Wrangler's Boss Crate** in `BOSS_CRATES`, its ride **Pen Pony** (`pen-pony`, mythic, slot ride, a one-line description in the
  house style, e.g. "One of Wrangler's pen knights, saddled. It only ever hops in an L."); the ride wired like the other rides
  (rides v2; its art from `ride-pen-pony`); the crate in the Crates tab and the FAQ; the server's boss-tokens test gains
  `["pig", "pen-pony"]` (check the id the code uses for Wrangler).

## 2. His challenge intro (custom; boss LEFT, you RIGHT; about 12 s; Eric's design, his words in the art notes)
- Walk on to the marks; his line (placeholder until Eric's Gemini lines: **"Saddle up, partner. The board's comin' to us."**).
- He spins the lasso, throws it to the corner, yanks the hay bale with the board to the middle (the room piece hidden from that
  moment); then the cross-armed double throw off screen each way, the yank, and the white and black buckets tumble in from either
  side and land upside down as the stools. Then the God King attack swing before the cover (as the others), then **the wipe**
  (`INTRO_PIG_STORM` + `INTRO_PIG_FRONT`: spurs, tumbleweeds, toy cap guns with "BANG!" flags) as the screen cover.
- Wire it as Timber's (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, `pig-intro-art.ts`): every beat a number in the feel;
  lazy-loaded art; the real board is the game's; nothing jumps in at the end (Eric, Nov 4: the table and stools are in place before
  any darkness or cover; nobody steps after the stools land); his sounds mapped to every cue (synthesized ones must pass
  `boss-sounds-finite.test.ts`).
- **Sprites always on screen (Eric, Nov 4).** The cave-style big bubble (#482's `CHALLENGE_FEEL.bubble`) for his line.

## Done
- Unit (shop: mask/room, crate, rooster sheet; intro: beats in order ~11–13 s, every cue a sound, bale and buckets land where the
  table and stools stand, the corner board hidden from the yank); e2e: `e2e/shop.spec.ts` (go in, the rooster, the crate),
  `e2e/boss-challenge.spec.ts` (his challenge to the board and back), the town card test updated.
- A few stills in `docs/wrangler-home/` (room, rooster at the counter, intro start, the stools landed, the wipe), phone and computer.
  No GIFs.
- PR body `docs/wrangler-home/pr-body.md` (every player-visible change and new text, changed checks old → new, the lane: full e2e,
  the crate is shared). Push; no PR. Short report.

## Art calls to keep (shop-pig-nov4.md / intro-pig-nov4.md)
The board stand at (4, 3) (visible from the challenge camera); the pens (white knights / black knights); the straw bed in a lasso ring with
the star where the table stands; his red star mat, your denim horseshoe mat; you both stand clear of the stools from the start (7.2 and
11.6) so nobody moves when the bale and buckets come in; black bucket his (from our left), white yours (from our right); the bale's drag
curves past him; Pen Pony matches the pawn's colour, only the blanket takes the item colour; new sounds slide, clatter, jingle, pop.
