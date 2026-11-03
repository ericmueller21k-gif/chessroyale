# Brief: Timber's house in the town, Rivet in the town, Timber's shop (intro later)

Worktree `/home/user/cr-timberhome`, branch `claude/timber-home` (from main). Opus high. Push as you go.

Art on `origin/claude/boss-art` (read with git show; copy into the app as the other houses/shops did):
- House: `scripts/boss-art/out/house-timber-nov3.md` (+ its folder): HOUSE_TIMBER 144x134, foot (70,128), a 3x3 plot; HOUSE_TIMBER_SIGN,
  _LIGHTS, _POOLS. Add it to `town/houses/index.ts` like the others and **find it a free 3x3 plot on the town map** that fits
  the town's layout (paths, other homes, the park); say where and why, with a still of the town around it. Timber is admins-first
  (`BOSS_ADMIN_FIRST`): decide whether his house shows to everyone or admins only (match how his card/boss shows today: if his
  town presence is admins-only, the house is too; say which). Its card: name + "Go in" (the shop card style).
- **Rivet's town sheet**: Rivet the woodpecker (`characters/sidekicks/timber.ts`, id "sidekick-beaver") has no town sheet (no
  `timber` in `town/sidekick-sheets.ts`, no `town/sidekicks/timber.png`). Generate them the way the other kids' were made (find the
  script or process that made the other sheets) so Rivet can walk in the town like the other kids (if the other kids walk in the
  town; follow `packages/app/test/town-bots.test.ts`, whose `notInTown = ["timber.ts"]` excludes him today: update it with care,
  old → new) and stand as the Shopkeeper.
- Shop: `scripts/boss-art/out/shop-timber-nov3.md`: a shop like the others (Go in, room, chat tone, Rivet the Shopkeeper,
  "Timber's Boss Crate" in BOSS_CRATES with his ride first if he has one: check rides), marks `SHOP_TIMBER_MARKS = { boss:
  [8,10.5], you: [11,10.5] }` (pass them like Big Boy's), the showpiece (the giant king being carved, 4x2, deep but UPRIGHT,
  `RoomArt.upright`). Starting zoom: the further-out one, like every home now.
- No challenge intro yet (its art comes later): Timber's challenge stays as today for now, or uses the default intro (table pops,
  attack swing) if that's simplest and reads fine; say which.

Rules: phone first; lazy-loaded art; the town's frame loop unchanged (measure if you add to the town's drawing: a new house on
the map does, so check frame rate against main per docs/rules/eric.md); list every player-visible text; changed checks old → new.
Done: unit tests (the plot is free and walkable around it, Rivet's sheet frames, the shop's walkable squares); e2e: Timber's
shop (as an admin if needed) and his house card. Stills: the town with his house (phone + computer), inside at the counter with
Rivet, the showpiece. PR-body file `docs/timber-home/pr-body.md`. Push; no PR.
