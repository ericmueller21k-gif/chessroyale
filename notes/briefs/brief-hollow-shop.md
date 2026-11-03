# Brief: Hollow's cave in the game (code): Hollow Peak gets an inside, his dog keeps the shop

Worktree `/home/user/cr-hollowshop`, branch `claude/hollow-shop` (from main c7009d1a; made, pushed, `npm ci` done). Opus high.
Include notes/briefs/rules-common.md. Push as you go.

Eric approved the art (Nov 3, "pretty much everything is perfect"). Art on `origin/claude/boss-art` at a53eba78 (read with git show;
copy into the app as Dash's shop did, PR #477 merge 23a3a7d4, and Big Boy's, PR #467 merge 356dc035):
- `scripts/boss-art/out/house-shop-hollow/house-shop-hollow.ts` and its notes `scripts/boss-art/out/shop-hollow-nov3.md` (read
  them first: the piece table, `SHOP_HOLLOW_FLOOR`, `rockPiece(col,row)`, marks, lights, the calls).
- `scripts/boss-art/out/sidekick-hollow-dog/sidekick-hollow-dog.ts`: the shopkeeper.

## Build
- **"Go in" on Hollow Peak's card**, into the cave: the same shop flow as the others (room, chat tone, Talk, the crate, the
  challenge from his card in town played on his pond). Hollow is live for everyone, so his cave is too (Big Boy's, a live boss,
  shipped to everyone: match it).
- **The cave shape:** the first room that isn't a box. Walkable = `SHOP_HOLLOW_FLOOR` `.` squares only (every `#` blocks, besides
  the solid pieces); paths, taps and the camera respect it; rock pieces placed from the mask with `rockPiece`. Keep every other
  shop exactly as it is (their tests prove it). The camera must never sit inside rock or show past the cave's edge into nothing:
  check the close views all along the passage, the bend and the hollow.
- **Repeated pieces' lights:** lanterns and bulb-string pieces stand in several places; today a piece's light shows at one place.
  Make lights follow every placement (all shops), cheap per frame.
- **The dog as Shopkeeper:** bake his sheet like the other sidekicks (`scripts/bake-sidekicks.ts` reads
  `characters/sidekicks/*.ts`: copy him in as his own file; he is NOT a town bot: Glim stays Hollow's kid in the town, so keep the
  dog out of the town's bot list, and update the town/sidekick tests old → new). Stand him at the counter as the art notes say
  ((5,2)/(6,2), drawn at 5.5, 2.4). His card: "Shopkeeper". No name.
- **Hollow's Boss Crate** in BOSS_CRATES (his ride first if he has one: check rides), at `SHOP_HOLLOW_CRATE_AT`, its wording like
  the others'.
- **The challenge:** the default intro for now (his own, the lanterns going out, comes next round). The pond is smaller than the
  other circles: make sure the table, the stools and both figures fit on it and stay clear of the rock.
- Starting zoom: the further-out one, like every home.

## Rules
Phone first; lazy-loaded art (the cave loads only when you go in); the town's frame loop unchanged; the shop's frame rate on the
phone measured against Dash's shop (say both). List every player-visible text; changed checks old → new. Nothing based on or
naming a real story, its town or its lines.

## Done
Unit tests: the mask (walkable, connected, no 1-square pinches, the pond and the counter squares on floor, every `#` blocked),
the rock placement, lights at every placement, the dog's sheet and squares, the crate. e2e: going into Hollow Peak, walking to the
counter round the bend, the dog's card and the crate; his challenge from the town to the pond and back. Stills (phone + computer):
the mouth, the pond, the bend, the counter with the dog, the tree. PR-body file `docs/hollow-shop/pr-body.md`; decision note
`docs/decisions/2026-11-03-hollow-shop.md`. Push; no PR.
