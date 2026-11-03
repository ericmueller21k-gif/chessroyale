# Brief: Dash round 2: his home (Dash's Kicks), Tick in the town, his sneaker store (intro later)

Worktree `/home/user/cr-dashhome`, branch `claude/dash-home` (from main, AFTER #476 Dash round 1 is merged). Opus high.
Include notes/briefs/rules-common.md. Push as you go.

The cheetah is **Dash** (renamed from Blitz, Nov 3). Art file and export ids keep `blitz`; every player-visible text says Dash.
Follow how Timber's home round did it (`docs/timber-home/`, PR #472, merge de2f6d16): same structure, same checks.

Art on `origin/claude/boss-art` (read with git show; copy into the app as Timber's house/shop did):
- House: `scripts/boss-art/out/house-blitz-nov3.md` (+ `house-blitz/`): HOUSE_BLITZ 144x134, foot (72,128), a 3x3 plot;
  HOUSE_BLITZ_SIGN, _LIGHTS, _POOLS. Its name on the sign and card: **"Dash's Kicks"**. Add it to `town/houses/index.ts` and
  **find it a free 3x3 plot on the town square** (the art note pictures it beside the circus tent and the lumber lodge; use that
  if it's free and fits the paths; else say where and why, with a still). The hanging sneakers' wire runs to a pole on its
  right: keep that pole clear of paths and other homes. Dash is admins-first (`BOSS_ADMIN_FIRST`): his house shows exactly as
  Timber's did while Timber was admins-first (match that; say which).
- **Tick's town sheet**: Tick the tortoise (`sidekicks/sidekick-blitz.ts`) needs a town sheet like Rivet's got
  (`town/sidekick-sheets.ts`, `town/sidekicks/*.png`): make it the way Rivet's was made, so Tick walks in the town like the
  other kids and stands as the Shopkeeper. Update `packages/app/test/town-bots.test.ts` with care, old → new.
- Shop: `scripts/boss-art/out/shop-blitz-nov3.md` (+ `house-shop-blitz/`): built like Timber's (Go in, room, chat tone,
  Tick the Shopkeeper, "Dash's Boss Crate" in BOSS_CRATES with his ride first if he has one), marks
  `SHOP_BLITZ_MARKS = { boss: [8,10.5], you: [11,10.5] }`, the counter 30 px tall so Tick shows over it, the crate at
  `SHOP_BLITZ_CRATE_AT`, the showpiece the halfpipe (4x2, `RoomArt.upright` if it reads deep). Starting zoom: the further-out
  one, like every home. With his home in, his challenge is offered (round 1 left it off while he had no home): check it works
  from his card and his shop, solo and lobby.
- No custom intro yet (round 3): his challenge uses the default intro (table pops, attack swing) for now.

Rules: phone first; lazy-loaded art; the town's frame loop unchanged (a new house on the map adds to the town's drawing:
check frame rate against main per docs/rules/eric.md); list every player-visible text; changed checks old → new.
Done: unit tests (the plot is free and walkable around it, Tick's sheet frames, the shop's walkable squares); e2e: Dash's shop
(as an admin) and his house card, his challenge starting from the shop. Stills: the town with his house (phone + computer, day
and night so the neon shows), inside at the counter with Tick, the halfpipe. PR-body file `docs/dash-home/pr-body.md`.
Push; no PR.
