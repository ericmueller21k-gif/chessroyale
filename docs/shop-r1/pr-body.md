# Shop interiors, round 1: go into Babur's tent and Puddles' greenhouse

**Title:** Shop interiors r1: Go in to Babur's tent and Puddles' greenhouse, the Shopkeeper and the boss crate's card (buying stubbed)

Eric, Nov 2: walk up to Babur's home, "Go in", the camera zooms in on the door and fades into the tent; inside you start in Close, the
Shopkeeper (Stripes) sells "Babur's Boss Crate"; "Go out" by the door brings you back. Puddles' greenhouse the same way, with Drizzle.
This is round 1, the town side: buying goes through one stub, `buyBossCrate(boss, way)`, which answers "Coming soon". No server change.

## What changed

- **"Go in"** on the cards of Babur's Circus and Puddles' Botanical Garden (gold, above their greyed "Shop" and "Coming soon", which
  stay). Every other home's card is unchanged. Tapping it walks you to the door; the town zooms in on the door (a CSS scale of its
  canvas) and fades to black; the room loads then (its code and each room's art are chunks of their own); the town waits as you left it.
- **The rooms** (`packages/app/src/town/shops/`): the art from `claude/boss-art` (copied as drawn, imports fixed, the review-only parts
  left out), drawn as the approved mockup draws it through the town's camera: the floor laid flat (baked once, two triangles a 2 x 2
  block), upright pieces at their feet, Puddles' pond garden laid flat on its 5 x 8 squares with its plants' tops standing up, the
  tent's canvas or the greenhouse's glass above, the burning hoops' glow. Animated pieces loop (hoops, pond, palm, fountain, crate,
  balloon cart).
- **Close** is the camera you start in (`SHOP_FEEL.close`: h 3.2, back 2.4, 24°, cy 0.3); the town's − / + switch between Close and the
  town's zoomed-in camera. `camera.ts`'s `setView` takes the room's camera sets (optional; the town passes none, as before).
- **Walking:** tap to walk (round the walls, the counter and every solid piece), drag to look, the focus button to come back. The town
  has no joystick (checked main and every branch), so there's none inside either.
- **The Shopkeeper** (the boss's kid's sheet, idle playing, a blue "Shopkeeper" tag): standing within 3 squares, its card ("Shopkeeper",
  Talk); a tap on it walks you up in front of the counter. **Talk** opens the crate's card: its picture, prizes (the boss's ride first:
  Balloon Pup; Puddles's Mower), the price line, what you have (0 and 0 until round 2), two buy buttons through `buyBossCrate`.
- **The way out:** on the two squares just inside the door, a "Go out" card; the back button inside also goes out (not home).
- **Price** in core's settings: `BOSS_CRATE_PRICE` (3 tokens, or 1 token + 1 crate key), so round 2's server shares it.
- The town's box is never scrolled (`overflow: clip` after `overflow: hidden`): Playwright's click on a shop button once scrolled it.
- Docs: `docs/areas/town-square.md` ("Inside a shop", files, tests, not built yet), `docs/areas/shop.md` (a line on the boss crate),
  `docs/decisions/2026-11-02-shop-interiors-r1.md` (every call made). `e2e/areas.json`: `e2e/shop.spec.ts` joins the town's area.

## Player-visible changes and new text

- On Babur's Circus's and Puddles' Botanical Garden's cards: **"Go in"**. The zoom into the door and the fade (in and out).
- Inside: the rooms; **"Shopkeeper"** (its tag and its card's title); **"Talk"**; **"Go out"**.
- The crate's card: **"Babur's Boss Crate"** / **"Puddles' Boss Crate"**; **"Prizes"**; **"Balloon Pup"** / **"Puddles's Mower"** with
  **"Mythic ride"**; the price line **"3 Babur tokens, or 1 Babur token + 1 crate key"** (and **"3 Puddles tokens, or 1 Puddles token + 1
  crate key"**); **"You have 0 Babur tokens and 0 crate keys."**; the buttons **"Buy with 3 Babur tokens"** and **"Buy with 1 Babur token +
  1 crate key"** (Puddles' the same with his name); the answer **"Coming soon"**.
- Inside a shop, the back button takes you out to the town square; − / + work the room's camera.
- Not shown: other players and the town's bots don't come in (inside is just you, this round); your ride waits outside (you're on
  foot inside); the battle circle is floor art only.

## Puddles' ride

He has one: **Puddles's Mower** (`puddles-mower`), the first prize on his crate.

## Checks changed

None changed or removed; none of `docs/rules/eric.md`'s guards touched. Added: `e2e/shop.spec.ts` (2 tests, phone and computer) and
`packages/app/test/shop-room.test.ts` (17).

**The town's frame-rate rule:** the town's drawing is unchanged (`render.ts` only exports the pawn's path for the room); its frame loop
gains one check (`goingIn >= 0`) and `setView` one comparison. Not measured against main for that reason. Inside a room, headless: 60
fps median walking on a phone (390 x 844, Babur's) and a computer (1280 x 800, both rooms).

## Tests run locally

- `npx vitest run packages/app/test/shop-room.test.ts packages/app/test/town-camera.test.ts`: 31 passed.
- `npm run typecheck`: clean.
- `npx playwright test e2e/shop.spec.ts` (phone and desktop, under the e2e lock): 4 passed.

## Stills (`docs/shop-r1/`)

`phone-1-door-card.png` (Babur's card with "Go in"), `phone-going-in.gif` (the zoom, the fade, inside), `phone-2-inside.png` (Close, a step
in from the door), `phone-3-counter.png` (at the counter, the Shopkeeper's card), `phone-4-crate.png` (the crate's card after a buy:
"Coming soon"), `phone-5-zoomed-out.png` (−: the town's camera), `phone-6-hoops.png` (the burning hoops), `phone-7-puddles-pond.png` (the
pond garden laid flat), `phone-8-puddles-crate.png`, `computer-1-babur.png`, `computer-2-puddles.png`.

## Lane

Targeted (a new screen with logic in the town's area): `check` and the PR's e2e run, which selects the town's area specs (with
`e2e/shop.spec.ts`) plus the smoke set, and the town's WebGL jobs. No stored data, money or server change in this round.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
