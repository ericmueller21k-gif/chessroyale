# Hollow's cave: Hollow Peak gets an inside, his dog keeps the shop

## What changed

- **"Go in" on Hollow Peak's card**, into his cave: the same shop flow as the other homes (the room, the chat's tone, Talk, the
  crate, the challenge from his card in town played on his pond). Hollow is live, so this is in everyone's town (as Big Boy's).
- **The art**, copied in as Dash's was: `town/shops/hollow-art.ts` from `claude/boss-art` a53eba78 (`house-shop-hollow`), and the dog
  `characters/sidekicks/hollowdog.ts` (`sidekick-hollow-dog`), baked by `scripts/bake-sidekicks.ts` (`town/sidekicks/hollowdog.png`,
  `sidekick-sheets.ts`). Only the import lines changed; the room still and review strips stay on the art branch.
- **The first room that isn't a box.** `makeRoom` takes the art's floor mask (`SHOP_HOLLOW_FLOOR`) and blocks every `#` square;
  walking, taps and paths keep to the floor. A box room passes no mask and is unchanged.
- **The camera in a cave:** a drag stays over the floor (`camFocus`); past the room's squares the rock goes on (one fill in the rock
  tile's own tone), and past the mouth the snowy night; a piece nearer the camera than you and drawn over you is see-through
  (`SHOP_FEEL.seeThrough` 0.35, caves only), so the passage's walls and the mouth's arch never hide you. A cave roof of dark stone and
  stalactites (the mockup's).
- **Lights at every placement (every shop):** a light shines on every place its piece stands (`lightsAt`, built once), mirrored with
  a mirrored piece, moved with the crate, fading with its piece near the camera. Hollow's five lanterns all glow; it also lights Alfil's
  second brazier and Dash's repeated shelves and windows, which lit at one place each before.
- **The dog keeps the shop** on (5, 2) and (6, 2), drawn at (5.5, 2.4), behind the 30 px counter round the bend; not a town bot (Glim
  stays Hollow's kid in the town). In the cave his tag is drawn with him, so nearer rock covers it.
- **Hollow's Boss Crate** in `BOSS_CRATES`, Hollow's Bulb (his ride) first, at `SHOP_HOLLOW_CRATE_AT`; in the Crates tab and the FAQ
  for everyone (he's live).
- **His challenge:** the default intro for now (his own, the lanterns going out, is next round). Across on the rings in his ice
  (`SHOP_HOLLOW_MARKS`); his own hop-back place (`BossIntro.clear` 2.92) because his lash lies 1.6 squares in front of his feet and
  reached his stool at the usual 2.6.
- Docs: `docs/areas/town-square.md` ("Hollow's cave", "Lights at every placement", "Hollow's challenge"), `docs/areas/shop.md`,
  `docs/decisions/2026-11-03-hollow-shop.md`. Stills: `docs/hollow-shop/`.

## Player-visible changes and new text

- Hollow Peak's card: his line (as before, the next each time) and **"Go in"**; "Shop" (greyed) and "Coming soon" are gone from it.
- Inside: the header **"Hollow Peak"**; the dog's tag and card **"Shopkeeper"**, **"Talk"**; **"Go out"** at the mouth.
- The crate's card: **"Hollow's Boss Crate"**, **"Hollow's Bulb"** / **"Mythic ride"**, "+ 24 Beta Crate items, Common to Epic",
  **"3 Hollow tokens, or 1 Hollow token + 1 crate key"**, **"You have 0 Hollow tokens and 0 crate keys."**, **"Buy with 3 Hollow
  tokens"**, **"Buy with 1 Hollow token + 1 crate key"**, after a buy **"Hollow's Boss Crate is in your inventory."**
- The challenge from his card: **"Challenge Hollow?"**, **"You'll fight Hollow in Boss Battle, then come back here."**, **Fight** /
  **Stay** (it was "Leave the town square?", "You'll fight Hollow in Boss Battle.", Leave / Stay, to the Boss raid screen). His line in
  the bubble: **"Did you leave a light on?"** (his entrance's). The town chat's challenge lines now go out for him too ("Ann challenged
  Hollow!", "Ann beat Hollow in 34 moves!" and so on, the server's existing words).
- The Crates tab shows Hollow's Boss Crate; the FAQ's crates section adds "**Hollow's Boss Crate** holds Hollow's Bulb (2% of the time:
  the only item behind its Fischer Random) and 24 Common to Epic items".
- The canvas's label inside: "Inside Hollow's shop".
- Other shops: lights now glow at every place their pieces stand (Alfil's second brazier, Dash's shelves and windows), and a lit piece's
  glow fades with it near the camera. Nothing else in them changes.

## Changed checks (old → new)

None guards a rule in `docs/rules/eric.md`.

- `packages/app/test/boss-challenge.test.ts`
  - "every boss whose home has an inside has an intro…": the list `[alfil, bigboy, dash, gardener, tiger, timber]` →
    `[alfil, bigboy, dash, gardener, hollow, tiger, timber]`; `introOf("hollow")` null → his default intro (line, layout, cues);
    added `introOf("folio")` null (a boss still without a home inside).
  - "the layout: across for all six" → "all seven" (adds hollow).
  - "across: the boss west of the table, you east…": the table always at (9.5, 10.5) → each room's middle (Hollow's pond (12.5, 11.5),
    the others as before), every offset as before; hollow added to the rooms.
  - "once the stools are in, no figure near the floor is in front of a stool…": hollow added; the marks' numbers `F` →
    `marksFeel(null, F, introOf(id).clear)` (the same `F` for every boss but Hollow).
  - New: "Hollow's start marks (SHOP_HOLLOW_MARKS…)".
- `packages/app/test/shop-room.test.ts`: "only … homes have an inside" adds hollow; "the crates' words" adds Hollow's; "each shop
  sells its boss's crate" adds Hollow's.
- `packages/app/test/town-bots.test.ts`, "each sidekick's baked sheet is its sprite as drawn": 16 files → 17; the art's ids add
  `hollowdog: "sidekick-hollow-dog"`.
- `packages/server/test/boss-tokens.test.ts`, the crates' rides: adds `["hollow", "hollow-bulb"]`.
- `e2e/town.spec.ts`, "Hollow's card: one of his three lines…": "Shop" disabled and "Coming soon" visible → its only button "Go in",
  no "Coming soon" (his lines' checks unchanged).
- New: `packages/app/test/shop-hollow.test.ts` (the mask: walkable, connected, no one-square pinches, the pond and counter on floor,
  every `#` blocked; the rock placement; lights at every placement; the camera kept over the floor and you never hidden by rock; the
  dog's sheet and squares; the crate; the pond fitting the table, stools and both figures); `e2e/shop.spec.ts` "Hollow Peak (Nov 3)…"
  (Go in, the walk round the bend to the counter, the dog's card, the crate); `e2e/boss-challenge.spec.ts` "challenging Hollow in the
  town…" (the town to his pond and back).

## Measured

- Shop frame rate (headless, walking 5 s, four runs in turn, medians): phone 390 × 844 Dash's 56.7 fps, Hollow's 53.2; computer
  1440 × 900 Dash's 57.3, Hollow's 54.9. The town's frame loop is unchanged (only the home card's markup), so no town measurement.
- Lanterns in view at the challenge's start: 4 of 5, phone and computer (`docs/hollow-shop/intro-start-lanterns-*.png`).

## Lane

Targeted (shop logic, a shared drawing change, boss content); `packages/core` (the crate) runs the whole e2e suite anyway. Specs:
`e2e/shop.spec.ts`, `e2e/boss-challenge.spec.ts`, `e2e/town.spec.ts`. The director decides.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
