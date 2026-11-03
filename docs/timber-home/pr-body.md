Title: Timber's Lumber Lodge in the town, Rivet in the town, Timber's shop (admins first)

## What changed
- **Timber's Lumber Lodge** (the art branch's `house-timber`, 144 x 134, its sign, lights and pools) on a free 3 x 3 plot at (11, 32),
  west of the Colosseum: the one open ground left (plain board, off the park, the apron and the Colosseum, clear of every other home's
  roaming ground), between Boingo's Funhouse and Moo & Moon Meadow, 4 open squares to the Colosseum's wall (Folio's first place had 3 and
  Eric had it moved), its door facing the park. Timber roams in front of it (his approved drawing), his chip shows his face.
- **Admins only, as Timber is** (`BOSS_ADMIN_FIRST`: only an admin's boss select has him; he had no town presence at all): his lodge,
  his roaming, his chatter and Rivet are in an admin's town only (`town/admin-town.ts`: your profile's `admin`, read once as the town's
  code loads; `TownPage` now waits for your account first, up to 3 s, which is instant from home). A player's town is unchanged: the
  plot is open ground. His crate is listed in the Crates tab to admins (or whoever holds one), not in the FAQ; the server posts no
  town-chat line for an admin's challenge of a boss in the game for admins first (everyone reads that chat).
- **Rivet**, Timber's woodpecker foreman: his town sheet baked by `scripts/bake-sidekicks.ts` like every kid's (the other fourteen
  sheets came out byte for byte the same), so he walks with the bots in an admin's town (after the ladder's twenty, so seats keep their
  meaning), rated 1650 (Timber's sim, 0.18, sits between Moo & Moon's and Puddles'), and keeps the shop. The Colosseum's crowd stays
  the ladder's.
- **Timber's shop** (the art branch's `house-shop-timber`, its room still and review strips left there): "Go in" from the lodge's card
  (its name and Go in only), Rivet the Shopkeeper behind the middle of the workbench, "Timber's Boss Crate" in `BOSS_CRATES` with his
  ride, The Log Roller, first; the day tone; a lodge's ceiling (the mockup's dark planks between beams); `SHOP_TIMBER_MARKS` passed as
  Big Boy's are; the giant king being carved stands up whole (`RoomArt.upright`). The art's file gave the showpiece 3 x 2 squares while
  its picture and notes are 4 x 2 (columns 15-18): the app's copy says 4 x 2, so it stands centered on its dais and all four columns are
  solid (nothing drawn changes). Starting zoom: the further-out one, as every home.
- **His challenge: the default intro** (table pops in, his God King attack swung, flash and wipe), which every home with a shop gets,
  until his own intro art comes.
- Decision: `docs/decisions/2026-11-03-timber-home.md`. Area pages: `town-square.md`, `shop.md`.

## Player-visible changes (admins only while Timber is admins first)
New text:
- The lodge's name: "Timber's Lumber Lodge" (its sign, its card, the shop's header, its chip "Go to Timber's Lumber Lodge").
- Rivet's tag and card: "Rivet (bot)", "Timber's sidekick", "Rating 1650", "Play Rivet (bot) · 1650"; in the shop "Shopkeeper".
- The crate's card: "Timber's Boss Crate", "3 Timber tokens, or 1 Timber token + 1 crate key", "The Log Roller", "You have N Timber
  tokens and N crate keys.", "Buy with 3 Timber tokens", "Buy with 1 Timber token + 1 crate key", "Timber's Boss Crate is in your
  inventory."; the Crates tab's row "Timber's Boss Crate" with its blurb "The Log Roller, and the Beta Crate's hats, shades and gear".
- The challenge: "Challenge Timber?", "You'll fight Timber in Boss Battle, then come back here.", his line "Hard hats on. We're
  building today." (his entrance's first).
- The town chat's chatter: Timber "The Lumber Lodge is open. Mind the sawdust!", "A good board starts with good wood."; Rivet
  "Rat-a-tat! Rivet's on the job!", "Hard hats on! Rivet says so."
For players: nothing changes, except that /town opened directly waits for the account to load (up to 3 s) before the town loads.

## Frame rate (eric.md, the town square)
A player's town draws what main's does (the drawing code only gained Timber's map entries); an admin's adds one house, one boss and one
bot. Measured at the lodge, headless, 5 s walking, medians of four runs in turn: phone 390 x 844, 43.8 fps (19.2 ms a draw) as a player,
43.1 fps (18.8 ms) as an admin; computer 1440 x 900, 50.3 fps (14.6 ms) and 50.8 fps (14.1 ms). No difference beyond the noise (the
machine was shared). Nothing new per frame on the hot path.

## Stills (`docs/timber-home/`)
`town-lodge-phone.png`, `town-lodge-desktop.png` (the town round the lodge), `counter-phone.png`, `counter-desktop.png` (at the counter
with Rivet), `showpiece-phone.png`, `showpiece-desktop.png` (the carved king on its dais).

## Tests
- Unit: `packages/app/test/town-timber.test.ts` (new: an admin's town: the plot was free plain ground, its roaming ground off the square,
  walkable all round, nothing cut off; neighbors and the 4 squares to the Colosseum; Rivet among the bots, his door, Timber's start);
  `town-bots.test.ts` (Rivet's sheet against his sprite; Rivet's entry; a player's town has no lodge and no Rivet); `shop-room.test.ts`
  (Timber's room: the showpiece's 4 x 2, props, aisle, marks, Rivet's squares; the crate's words); `boss-challenge.test.ts` (his intro,
  his marks, his stance clear of the stools); `town-chat.test.ts` (chatter); server `town-chat.test.ts` (no line for his challenge),
  `boss-tokens.test.ts` (his crate's ride).
- e2e: `e2e/shop.spec.ts`, "Timber's Lumber Lodge (Nov 3)…": a player's town has no lodge and no Rivet; as an admin, the lodge's card
  is its name and Go in, inside Rivet's card and Timber's Boss Crate with The Log Roller. Passed on phone and desktop locally.

## Changed checks (old → new; none guards a rule in docs/rules/eric.md)
- `town-bots.test.ts`, the baked-sheet check: `notInTown = ["timber.ts"]`, 14 files, each id `sidekick-<file>` → every file (15), each id
  `sidekick-<file>` except Rivet's, the art's `sidekick-beaver`.
- `town-chat.test.ts`, the chatter table: over `HOMES` → over `ALL_HOMES`; "names the fourteen kids" → "names the fifteen kids (Rivet,
  Timber's, Nov 3)", Rivet added.
- `boss-challenge.test.ts`: "every boss whose home has an inside has an intro": over `HOMES`, `["alfil", "bigboy", "gardener", "tiger"]`
  → over `ALL_HOMES`, with "timber"; the stools' clearance loop and `ROOMS`/`TABLES`/`LAYOUTS` gain Timber's.
- `shop-room.test.ts`: "only Babur's, Puddles', Alfil's and Big Boy's homes have an inside" (over `HOMES`) → "… and Timber's" (over
  `ALL_HOMES`); the shops loop gains Timber's.
- `boss-tokens.test.ts` (server): the crates' rides gain `["timber", "log-roller"]`.
- `town-lights.test.ts`, "every home and the Colosseum has its lights": `toHaveLength(HOMES.length + 1)` →
  `toHaveLength(ALL_HOMES.length + 1)` (`HOUSES` holds every home's art, the admins-first lodge included).

## Lane
Targeted (screens and the town's world, a small server guard); the town square, shop and challenge specs, plus the server's.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
