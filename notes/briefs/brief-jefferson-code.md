# Brief: Jefferson's warehouse and his intro, into the game (code; Opus high)

Worktree `/home/user/cr-jefferson`, branch `claude/jefferson-home`, from main (the director creates it). `npm ci`, never a
node_modules symlink. Push as you go. Ports: 8995, inspector 9495. Include notes/briefs/rules-common.md. Eric approved the whole build
(Nov 4) to go **live overnight** with no review stops; Jefferson (kit `grex`) is live, so this goes to everyone.

**Art** on `origin/claude/boss-art` (head named by the director): read `scripts/boss-art/out/shop-grex-nov4.md` and
`intro-grex-nov4.md` whole first. Copy in as Wrangler's (#483) and Hollow's (#480) were.

## 1. The warehouse (as Wrangler's barn #483; the floor mask as Hollow's cave #480)
- Jefferson's Fireworks' card: its name, then **"Go in"** (no "Shop" / "Coming soon").
- Inside: the header "Jefferson's Fireworks", the room from the art with its floor mask, lights at every placement.
- **The shady dealer giraffe** is the shopkeeper in his corner by the taped "SHOP" sign: tag and card "Shopkeeper", "Talk";
  baked with `scripts/bake-sidekicks.ts` (update town-bots' count). Jefferson's town kid (if any) stays as is.
- **Jefferson's Boss Crate** in `BOSS_CRATES`: `bossCrate("grex", "Jefferson's Boss Crate", "jefferson-giraffe")` (Giraffe Gallop,
  already drawn and wired as a ride; take it out of NO_CRATE_YET); in the Crates tab and the FAQ; boss-tokens test gains
  `["grex", "jefferson-giraffe"]` (check the id).
- **The moving crew (new for shops: keep it simple):** the lift guy on his barely-raised scissor lift and the forklift guy on their
  loops (`SHOP_GREX_LIFT_PATH`, `SHOP_GREX_FORK_PATH`), at a slow walking pace, the forklift's pick-up / raise / stack / back-off as
  beats on its loop (the pallet handed between floor, forks and shelf slot). **If your figure (or any figure) stands on or right in
  front of the next square of a path, that worker stops and waits; when it's clear, he goes on.** That's all (Eric: "If you block it,
  it stops. If you move out of the way, it starts moving again"). They block your walking where they are (you can't walk through them).
  Every number in the shop feel. No server state: each client runs them from the room's clock.
## 2. His challenge intro (custom; boss LEFT, you RIGHT; about 13–15 s)
- Walk on to the marks; **his call, one at random** (placeholder lines until Eric's Gemini lines; the big bubble):
  - "Boys! We got a challenger!"
  - "Take five, everybody. We're playing chess."
  - "Who wants a fifteen-minute break?"
  - "Forks down, boys. Somebody wants a game."
- **The crew stop and come over**: the lift guy and the forklift guy step off (their machines stay parked where they were), the dealer
  leaves his corner, and they stand round the table behind, watching. After the match (back in the room) they're on their loops again
  (no walk-back needed: Eric).
- The table is already there: the board on its wobbly crate stack (the real board is the game's on top).
- **Your lift**: the floor tile at your mark rises on its piston and lifts you level with the board. He stands (no stool).
- Then his God King attack swing (as the others), then **the wipe**: sparklers and fireworks (`INTRO_GREX_STORM` + `_FRONT`).
- Wire as Wrangler's/Timber's (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, `grex-intro-art.ts`); every beat a feel number;
  lazy-loaded; nothing pops in at the end; his sounds for every cue (synthesized ones must pass `boss-sounds-finite.test.ts` and the
  no-chimes test if it applies to him).
- **Sprites always on screen (Eric, Nov 4).**

## Done
- Unit (room/mask, crate, dealer sheet, the crew's paths: clear of racking/table/marks, they stop when a square ahead is taken and go on
  when it's free; intro beats in order, every cue a sound, the crew's spots round the table, the lift ends level with the board's slab).
- e2e: `e2e/shop.spec.ts` (go in, the dealer, the crate, a worker stops when you stand in his way and goes on when you step aside),
  `e2e/boss-challenge.spec.ts` (his challenge to the board and back), the town card test updated; any ride/crate counts updated.
- Stills `docs/jefferson-home/` (room, dealer corner, the crew blocked, intro start, the crew round the table, you lifted, the wipe),
  phone and computer. No GIFs.
- PR body `docs/jefferson-home/pr-body.md` (every player-visible change and new text, changed checks old → new, lane full e2e: the
  crate is shared). Push; no PR. Short report.

## Addition (Eric, Nov 4): the extra crew (about 8 giraffes in all)
- Place the two wall leaners (sparklers in their mouths, one lifting it from his side with a smoke puff) and the two extra crew as
  idle figures (no paths) where the art puts them; they block walking where they stand.
- **All the crew come over in the intro** to their spots round the table, and are back in place after the match.
- **Frame rate:** measure the warehouse (phone 390x844 and computer 1440x900, headless, walking 5 s, medians of a few runs) against
  Wrangler's barn; if it's more than ~3 fps slower, cut cost (shared/baked frames, fewer idle frames) before trimming any giraffe.
  Report the numbers.
