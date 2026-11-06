# The shop, crates, the locker and the icon builder

Lane: `item-builder` (crate items and shop cosmetics; its checklist for adding a crate item is in
`.claude/agents/item-builder.md`). The icon builder sits in the profile (`hub`).

## How it works today

- **Nothing here changes how a match is played or scored.** Everything is cosmetic.
- **Its kill switch** (`PAUSE_SHOP`, [ops.md](ops.md) "Kill switches"): while it's set, the Shop and Crates tabs say
  "The shop is resting for a bit. Back soon." and the server refuses getting items and opening crates; the locker
  (wearing what you have) stays.
- **The shop** (`core/shop.ts`): God King effects (the color of his bolts, beam and halo; one is always on, Holy
  Light the free starter) and chat packs (not equipped: you use every pack you own). Prices in coins; `SHOP_FREE` is
  on (everything free while testing). The pawn hats it used to sell are Beta crate items now (Oct 11, 2026); the shop
  is kept for God King packs and, later, things like boss and attack animations.
- **Buying with coins is one transaction** (`buyItem`, one D1 batch: all of it or none): the item goes in only if the
  coins are there (an item owned by then fails the batch), and the coins come off with it, so two taps or two devices
  at once never charge twice or take the coins below zero (`docs/decisions/2026-10-16-atomic-shop-purchase.md`).
- **Crates** (`core/crates.ts`): two series, **Beta Crate · Series 001** (listed first; it ships in batches, the plan
  is in the history: complete since Oct 14, 28 items: the Classics, the secret agent, the pirate, the ninja and a
  one-off Smiley Face) and
  **Winter Crate · Series 1**. Each lists its items once; an item's tier says where it is.
  Every drop rolls three things independently:
  1. **its tier**, which decides the item: the opening strip lands on a tier's box (Common to Epic, color-coded:
     Winter's presents, Beta's supply boxes), which opens to one of that tier's items evenly, or on **Fischer Random**
     (Legendary and Mythic items only, by tier: Legendary 80, Mythic 20, shared evenly). Both crates: 40/26/18/14/2.
     A tier with no items is left off the strip, and a test keeps every live crate's tiers filled;
  2. **its color** (red and yellow common, Pearl the rarest; some items roll a second color, and the Gift-Wrap Tube's
     second stripe color comes from its seed instead, `secondColor`, so it's never stored);
  3. **its purity**: 100% minus a blemish of 0–100% (blotches over that share of its color); shiny at 90%+.
  Crates are opened on the server, so nobody can make themselves a Pearl crown. `CRATES_FREE` is on while testing.
- **Items** have a slot (head, face, skin, weapon, ride: `ITEM_SLOTS`, the server's check too), are drawn on the pawn's 100 × 100 square, and fit by anchors
  (head, face, eyes, neck, mouth: each piece's own lines; a mustache sits at the mouth, under a snowman's carrot).
  Every face item is tagged above or below a hat (`faceLayer` in crates.ts; Eric, Oct 30): goggles and shades are drawn
  over a hat, every other face item under it (a smiley under a pirate hat's brim). A new face item must say which.
  Weapons don't move with the piece: they're drawn where every piece's side (or shoulder) is. Your
  pawn wears your equipped items on the vote board, the cut screen and your profile; other players' looks come with
  them into a lobby; bots wear simple seeded outfits (`BOT_LOOKS`).
- **Rides** (Oct 31: [2026-10-31-rides.md](../decisions/2026-10-31-rides.md); Nov 1, every boss's:
  [2026-11-01-rides-v2.md](../decisions/2026-11-01-rides-v2.md)): items in the `ride` slot, one at a time, that your pawn sits on,
  all Mythic, with a color, a purity and shine like every item: **Riding Chirp**, **Moon's Ride**, and (Nov 1) **Hollow's Bulb** (two
  colors: the glass and its glow), **Brush Ride**, **Alfil's Howdah**, **Balloon Pup**, **Big Boy's Buggy**, **Boingo's Pogo**, **Paper
  Crane**, **Candy Cane Sled**, **Giraffe Gallop**, **Puddles's Mower**, **Sawyer's Dozer**, **Rodeo Bull**, **Cheetah Shoes** (Dash's, in his crate since Nov 3:
  twice as fast in the town), **The Log Roller** (Timber's) and **Pen Pony** (Wrangler's, Nov 4, in his crate from the start: a pen
  knight saddled, the knight your pawn's color, only its blanket the item's color). Their names and lines are the drawings' own. **In no crate yet** (the
  crate comes later): only admins have them, as admin copies (red, emerald second color, 100%: "Admins own one of every item", below).
  **Where the drawings came from:** copied as drawn from `claude/boss-art` (`scripts/boss-art/out/<ride>/<ride>.tsx`; their
  `summary.md`, `views-summary.md` and `trail-summary.md` there have the artist's notes; Moon's Ride Oct 30, the rest Nov 1) into
  `components/rides/` (`kit.ts`: the types; `load.ts`: each drawing its own chunk, loaded when a ride is drawn, Nov 1: town-square.md,
  "Rides"); only their import lines changed and the `!`s the app's typecheck asks for, and
  Hollow's Bulb's green cord was taken out of every view by hand (Eric, Nov 1: "we don't really need that"). Moon's Ride stays as it
  was (its side only; its redraw is on hold) and the old cat, `hollow-steed`, isn't one. Each is a `Back` and a `Front` with the pawn
  between them, raised onto its seat, maybe tilted and hidden below the seat (`pose`), and two animations: `idle` and `move` (one
  square of the town's walk): its side; all but Moon's Ride also have `views` (its back, walking up the screen, and its front, walking
  down) and a `trail` mark (town-square.md, "Rides"). Drawn: the locker's tile (`ItemArt`: the ride with a white pawn on it), the
  locker's preview and the profiles' pawn (`Avatar`'s `ride`: the pawn and its items on its ride's side, its idle playing, fitted into
  the same box, so a box never grows), the profile's Wearing rows (last), the town square (town-square.md, "Rides"), and **home** (Nov 1:
  the big pawn on your card, your ring and the side menu's Profile item; hub.md, "Your ride on home"). Each of those boxes, and where the
  pawn sits in it, comes from the ride's measured numbers (`town/ride-cells.ts`), so while its drawing loads the pawn sits in place and
  the ride appears under it (`data-drawn` says when it has; Nov 1, [2026-11-01-rides-lazy.md](../decisions/2026-11-01-rides-lazy.md)).
  **Each ride's size** under its pawn (Nov 1): every ride 0.75 (`RIDES.defaultScale` in core's settings; Eric: "0.75 is good"), a ride
  listed in `RIDES.scale` its own, everywhere a rider is drawn but the item's own tile; an admin's `?rideScale=K` tries one size for
  every ride (town-square.md, "Rides"; [2026-11-01-ride-scale.md](../decisions/2026-11-01-ride-scale.md)).
  **Not drawn** (the pawn alone, as before): a match's screens, the Colosseum's crowd, the
  queue's and Squads' cards, the boss stage, the town's person card, and the public profile's Equipped Cosmetics row (four tiles at
  most; its View all lists the ride). Changing a ride's drawing or the paint (`item-paint.tsx`): `npx tsx scripts/measure-rides.ts`
  (the town's cells for it; a test fails until it's run).
- **A boss's crate, sold inside the boss's home** (Nov 2, round 1: Babur's and Puddles'; since, Alfil's, Big Boy's, Timber's, Dash's and, Nov 3, Hollow's with Hollow's Bulb, shown to everyone; Nov 4, Wrangler's with Pen Pony and Jefferson's with Giraffe Gallop, everyone's; Nov 5, Ginger's with the Candy Cane Sled, everyone's (its id `boss-gingerbread`: his boss id is also the Gingerbread Man skin's item id, and nothing confuses the two), and Folio's with the Paper Crane, everyone's; Nov 6, Smudgy's with the Brush Ride and Boingo's with Boingo's Pogo, everyone's; town-square.md, "Inside a shop"): the
  Shopkeeper's card shows the crate, its prizes (the boss's ride first), its price (`BOSS_CRATE_PRICE` in core's settings: 3 of the boss's
  tokens, or 1 token and 1 crate key) and what you have. Since round 2 (below) buying is real.
- **Boss tokens, crate keys and buying a boss crate** (Nov 2, round 2; [2026-11-02-boss-tokens.md](../decisions/2026-11-02-boss-tokens.md);
  `BOSS_TOKENS` in core's settings, the rules in `core/boss-tokens.ts`, the server's side in `server/boss-tokens.ts`):
  - **Earning** (Eric's rules): a boss battle (a Boss raid online, a Boss Battle party, a Solo raid, Boss alone; not the Crowd's boss
    final), won or lost, **counts once it reaches 10 of your moves or 5 minutes**. Per account, over a **rolling 24 hours**: the first
    counted battle with no token in the window always drops one; after that 25% a battle, up to 3 in the window. Which boss's token:
    one of the live bosses (`dropBosses`: playable for players, not the Hidden Boss, not Timber while he's admins first, not one resting),
    each as likely. Where sign-in is set up, only signed-in accounts earn them (a guest's things move to the account it signs in to, so
    many guests could fill one account past the cap); locally and in e2e (no sign-in) guests do.
  - **Decided by the server only.** An online battle by its match room: `LobbyCore` counts each person's picks that went in (`picked`,
    at each turn's lock) and knows when the match began; `bossBattleSpan` gives their moves and time (to the end, or to when they left),
    and the Durable Object's `saveResults` counts the battle (`countBossBattle`) as it saves their result (once). A **solo** battle runs on
    the device, so the server can't see its moves: it counts by **the server's clock alone**: `POST /api/boss/solo/start` as the battle
    begins (App.tsx's `startSolo`, `noteSoloBattle`: the server notes the time in `solo_battles`, one open per account, a new start
    replacing it), `POST /api/boss/solo/finish {battle}` from its result screen (taken off in one statement, so it's finished once): it
    counts when 5 minutes or more passed between the two. Its 10-moves path isn't there (the device's word). The drop itself is one
    transaction: the drop row goes in only while the window (counted in the same statement) has room, and the token with it.
  - **The result screen** (`components/TokenBox.tsx`, on `ResultsScreen` for any boss battle): when the server says the battle dropped
    you a token, a square box in the gambling warning's look (the locker's dialog), the token turning in it, **"You got a Babur token!"**
    (`tokenGotLine`: "an Alfil token", "a Boingo token") and **OK** (Escape or a tap outside close it too). Solo: the finish's answer.
    Online: `GET /api/boss/token?battle=CODE`, asked at 0.7, 2.2, 5.2, 11 and 21 s after the results while the room writes them.
  - **The inventory** (the Crates tab, `TokenStock`): under Keys and Crates, **"Boss tokens"**: every live boss's token with "× N",
    greyed at none (shown, not hidden), an admin's admins-first boss's too; "From boss battles. Spend them on a boss's crate in its shop
    in the town." **Keys are counted now** (`wallets.crate_keys`; the Crates tab's "Keys × ∞" became the real count), and a boss crate
    takes one; the Crates tab's own crates stay free while testing ("Crates are unlimited while we test.").
  - **The token pictures** are the drawings from `claude/boss-art` (`scripts/boss-art/out/token-<name>/`), copied into
    `components/tokens/` (only their import lines changed, and the `!`s the app's typecheck asks for), one chunk loaded the first time a
    token shows (`TokenArt.tsx`: 40 × 40 crisp; `animate` plays its idle, the result box's; a plain gold coin for a boss with none). Every
    live boss, Timber and Dash have one (Dash's is the art's `TOKEN_BLITZ`).
  - **The crates** (`BOSS_CRATES` in core's crates.ts, beside `CRATES` but never in it, so the Crates tab can't open one free; Timber's and
    Dash's, Nov 3, listed to admins and whoever holds one while they're in the game for admins first, and not in the FAQ; Dash's ride
    is Cheetah Shoes): Babur's
    and Puddles', each the boss's ride (the only Mythic, the only item behind Fischer Random: 2%) and the Beta Crate's 24 Common to
    Epic items in its boxes, at the existing crates' odds; rolled on the server as every crate.
  - **Buying** (`POST /api/shop/boss-crate {crate, way}`, `buyBossCrate`): one D1 batch, as the coin shop's: the crate goes into your
    inventory (a `boss_crates` row, unopened) only if the tokens (and the key) are there, then they come off only if that row went in; the
    counts can't go below zero (a CHECK on `boss_tokens.n`, and the guards). A double tap or two devices are two buys, each paid in full or
    refused. The shop's kill switch refuses it. Answers `{crate, locker}`. The shop card's answer: **"Babur's Boss Crate is in your
    inventory."** (Eric, Nov 2; until then a buy opened it at once into the Locker), or "You need 3 Babur tokens." / "You need 1 Babur
    token and 1 crate key.".
  - **Boss crates you hold** (Eric, Nov 2: "Buying a boss crate from shopkeepers adds the crate to your inventory … they open and shuffle
    the same way normal crate animations work"; [2026-11-02-nov2-fixes-b.md](../decisions/2026-11-02-nov2-fixes-b.md)): the Crates tab
    lists every boss crate under **"Boss crates"**, below the others, its boss's token on the crate's corner, its blurb and **"You have
    2"** (greyed with **"You have none"**: shown, not hidden; a tap still shows what's inside). Its page says **"You have 2."** or
    **"You have none. Babur's shop in the town sells it."**; **"▶ Open"** (greyed at none; no test switches for these) opens it with the
    Crates tab's own strip, unwrap, Fischer Random and reveal, from the crate's own pool (`BOSS_CRATES`); "▶ Open another" greys when none
    is left. The locker's `bossCrates` (crate id → how many). **Opening** (`POST /api/locker/open {crate}` with a boss crate's id:
    `openBossCrate`): one D1 batch: the item goes in only if you hold one of those crates, then the oldest of them comes off only if that
    item went in; so each opens once, never twice, a double tap or two devices open two only if you hold two, and nobody opens one they
    haven't got ("You have no Babur's Boss Crate to open."). The roll is the server's, never a test switch's. The shop's kill switch
    refuses it too.
  - **Admins' test grants** (the Crates tab's "Admin: test grants", admins only: "+1 crate key"; a boss, "+1 token", "+3 tokens";
    `POST /api/locker/grant`, "Not found" for anyone else; at most `grantMax` (10) at once). Never a drop: the window doesn't count them.
  - **Stored** (each an account's: `account-data.ts`, "bossTokens"; the privacy page's "Boss tokens"): `boss_tokens` (counts),
    `boss_token_drops` (each drop: when, which battle; kept 30 days, the Worker's schedule clears older), `solo_battles` (the open one),
    `boss_crates` (Nov 2: each crate bought and not opened yet, its crate id and when; a new table, so older data reads as none), and
    `wallets.crate_keys`. A guest signing in to an account brings them along (added up; the drops and the crates too, so the window
    counts the drops).
- **Boingo's claw machine** (Nov 6; [2026-11-06-claw-machine.md](../decisions/2026-11-06-claw-machine.md); `CLAW`): its coin slot in his Funhouse opens `openClawMachine()`. One boss
  token in, 25% of the time that boss's Boss Crate, unopened: `POST /api/shop/claw {boss, request}` rolls it through the ledger (`clawOp`, keyed by `request`).
- **The HunChess Welcome Crate** (Eric, Nov 6; [2026-11-06-welcome-crate.md](../decisions/2026-11-06-welcome-crate.md); core's
  `welcome.ts`, the server's `welcome.ts`, `WELCOME_GIFT` in settings):
  - **Two, earned** each once per account, ever, at 5 and then 25 finished games (Eric: "the first one you get after 5 games, the next
    one you get after 25"; `WELCOME_GIFT.milestones`) in any mode or against any boss (a `results` row not marked `abandoned`, or a
    ranked 1 v 1 game), by the server only: one statement inserts a `welcome_crates` row per milestone reached (keyed by account and
    milestone) only while it's signed in, and does nothing for one that's there. The second's ride is never the first's. The app's
    `welcomeProgress()` answers `{ next: 5 | 25 | null, done }`. Checked on every `/api/me` (the backfill) and after every
    saved result, ranked game and Squads placement. Guests and bots never get one. A match room marks a player gone too long, idle or
    removed mid-match as `abandoned` (not counted); a resignation counts.
  - **The notice** (`components/WelcomeNotice.tsx`): **"You earned a Welcome Crate!"**, "Thank you for being an early tester!", "It's in
    your inventory's Crates. Not tradeable." and OK, once (`POST /api/locker/welcome/seen`), on home and the result screen.
  - **In the Crates tab**, first: its art (`HunchessCrateArt`: black and the logo's gold, an idle glint), **"HunChess Welcome Crate"**,
    "Thank you for being an early tester!", a **"Not tradeable"** tag and where yours is: "Finish 5 games to earn your Welcome Crate:
    3/5" (greyed until earned; a guest's adds "Sign in to earn it."), "You have 1. Open it!", "Opened. Its ride is in your locker.".
    Its page lists every ride it can give (each as likely), no purity; "▶ Open" (greyed unless yours is waiting) opens it with the
    usual strip, Fischer Random ("A HunChess ride") and the reveal ("Not tradeable", no purity, no "Open another").
  - **The prize:** one ride, any of the game's rides, each as likely, in the **HunChess colorway** (`<ride>-hunchess`, its own item:
    `HUNCHESS_RIDES` in crates.ts, made from every ride; "HunChess Balloon Pup"), rolled and stored by the server
    (`POST /api/locker/open {crate: "welcome-hunchess"}`: one transaction, opened once; again answers the same ride). Drawn from its
    ride's drawing, cells, size and pace (`components/rides/hunchess.tsx`: an SVG filter remapping each ride layer to black, gold and
    cream, with a gold trim; `HUNCHESS_LEVELS` lifts a ride whose remap fails: the Rodeo Bull). No purity shown, no shine.
  - **Never tradeable or listable:** `tradeable()` in core says no for the crate and its rides (there's no trading or listing yet: any
    path that comes asks it on the server). The locker's tile shows "HunChess" and "Not tradeable" in place of its color and purity.
  - **Stored:** `welcome_crates` (`user_id`, `milestone`, `granted_at`, `games`, `seen_at`, `opened_at`, `item_id`, `def`), `results.abandoned`; the ride is
    an `items` row (crate `welcome-hunchess`). Older data reads as not earned yet. In the account's download ("welcomeCrate") and erased
    with it.
- **The gambling warning** (Eric, Nov 1; `components/GamblingWarning.tsx`): a small red ring, see-through in the middle, with a bubbly
  solid-red "!" in it, always at the top right of the crate pages: the Crates tab and each crate's own page (not the opening or the
  reveal). It sits over the page's corner (`gamble-ring` in `styles.css`: out of the flow, a 40 px tap target round a 30 px ring), so it
  takes no room and moves nothing. A tap opens a short message box (the locker's dialog look, `role="dialog"`): **"Crates are chance, like
  gambling. Only spend money you're okay losing."**, with a Close button (Escape and a tap outside close it too). Eric approved the
  wording; the ring and the box are the same in light and dark. Guard: `e2e/crate-banner.spec.ts`, "the gambling warning's red ring…".
- **The locker** keeps each item you own (its color, blemish and seed) and what's equipped in each slot; it can
  delete items. God King effects from the shop are worn there too.
- **Admins own one of every item** (`ADMIN_EMAILS`; Oct 31): every crate item and God King effect they don't really own,
  as an admin copy (`core/admin-copies.ts`: red, emerald second color, 100% purity, id `admin:<item>`), tagged "Admin" in
  the locker. Never stored: the server adds them in `lockerState` and `shopState`, accepts them in `equipLocker` and
  `equipItem`, and shows them worn in `publicProfile`, `looksOf` and `duelEntrant` (a worn copy of an item they've since
  really got shows the purest real one). Deleting ignores them and buying goes by what's really owned. A new item in `ITEM_DEFS` or a new worn shop slot is covered with no change; a new catalog
  needs its line in `admin-copies.ts`. Chat packs are left out
  ([2026-10-31-admin-owns-all.md](../decisions/2026-10-31-admin-owns-all.md)).
- **The icon builder** (the profile): a 48 × 48 pixel drawing with a paint bucket and undo (`UNDO_STEPS`), saved as a
  small PNG data URL (at most 16 KB, checked by the server).

## Where the code is

| What | Where |
| --- | --- |
| Item list, tiers, colors, crate odds, rolls | `packages/core/src/crates.ts` |
| The Welcome Crate: the crate, its roll, `tradeable`, its text; the grant, opening and notice | `packages/core/src/welcome.ts`; `packages/server/src/welcome.ts`; `components/WelcomeNotice.tsx`; the colorway `components/rides/hunchess.tsx` |
| Shop cosmetics | `packages/core/src/shop.ts`; drawn by `packages/app/src/components/Cosmetics.tsx` |
| Item drawings, fit, cards (`ItemArt`, `Avatar`); crate and box art (`WinterCrateArt`, `PresentArt`, `BetaCrateArt`, `SupplyBoxArt`) | `packages/app/src/components/Items.tsx` |
| The paint every item uses (color, shine, `Region`, `LINE`) and its blemish's blotches | `packages/app/src/components/item-paint.tsx` and `blotches.ts` (moved out of Items.tsx, Oct 31) |
| Rides' drawings (`RIDES`) | `packages/app/src/components/rides/` (`draw.tsx`: one layer as SVG); their town cells: `scripts/measure-rides.ts` |
| Crate page, opening strip, reveal, locker UI (`CRATE_LOOKS`: each crate's art and box) | `packages/app/src/screens/Crates.tsx`; the shop `screens/Shop.tsx`; the gambling warning `components/GamblingWarning.tsx` |
| Server rolls and storage (D1 `items`, `equipped_items`) | `packages/server/src/locker.ts`; the shop's API in `api.ts` / `accounts.ts` |
| Boss tokens, crate keys, the boss crate purchase, solo battles, admins' grants | `packages/server/src/boss-tokens.ts`; rules `packages/core/src/boss-tokens.ts`; the crates `BOSS_CRATES` in `crates.ts` |
| The ledger: the only writer of coins, crates, keys, tokens, shop items, items, boss crates and Welcome Crates, each change an op with its legs, append-only (Nov 6; a buy, an open or a grant keyed by the app's request id, so its retry applies once; an open's every attempt answers the item as stored, never its own roll) | `packages/server/src/ledger.ts`; `docs/decisions/2026-11-06-ledger.md`, `2026-11-06-ledger-2.md` |
| The token pictures, the inventory's tokens, the result box | `packages/app/src/components/tokens/`, `TokenArt.tsx`, `TokenBox.tsx`; `boss-tokens.ts` (the app's asking); `screens/Crates.tsx` (`TokenStock`, `AdminGrants`) |
| Boingo's claw machine (the play, its log `claw_plays`; the app's machine, flow and sounds) | `packages/server/src/claw.ts`; `packages/app/src/claw/` (`index.ts`: `openClawMachine`; `flow.ts`; `ClawMachine.tsx`; `sounds.ts`) |
| Admins' copies of every item (never stored) | `packages/core/src/admin-copies.ts`; added in `locker.ts` and `accounts.ts` (`shopState`) |
| Bots' outfits | `packages/core/src/bot-looks.ts`, `packages/app/src/looks.ts` |
| The icon builder | `packages/app/src/components/PixelIcon.tsx`, `icon-pixels.ts`; server check `isPixelIcon` in `accounts.ts` |

## Settings

`crates.ts` (`ITEM_DEFS`, `CRATES`, `BOSS_CRATES`, `ITEM_COLORS`, `PURITY_BANDS`, `CRATES_FREE`), `BOSS_TOKENS` and
`BOSS_CRATE_PRICE` in settings.ts, `shop.ts` (`SHOP_ITEMS`,
`SHOP_FREE`), `BOT_LOOKS` and `QUICK_CHAT.packPrices` in settings.ts.

## Tests and tools

- Unit: `packages/core/test/crates.test.ts` (rides: their slot, no crate, a look keeping its ride), `bot-looks.test.ts`, `packages/server/test/accounts.test.ts` (a ride in the ride slot only),
  `shop-buy.test.ts` (buying with coins, `SHOP_FREE` off), `claw.test.ts` (the claw machine: one token a play, refused with none, about 25%, the crate on a win, a retry, plays at once, guests, the seed only with TEST_SWITCHES, the admins' grant), `boss-tokens.test.ts` (the drop rule and its window, a race for the
  window's first place, which boss, guests where sign-in is set up, 10 moves / 5 minutes, solo timed by the server and counted once,
  the match room's count of picks, buying both ways, not enough, twice at once, admins' grants admin-only, a guest's sign-in), `admin-copies.test.ts` (admins own one of every item, a ride too), `packages/app/test/blotches.test.ts`, `gift-tube.test.ts`,
  `icon-pixels.test.ts`.
- Unit (Nov 6): `packages/server/test/ledger.test.ts` (an op replayed or raced applies once; each path's key; a 500-op reconciliation with merges and deletes; append-only; each request id replayed; an open raced at each step, held by the test's SQL wrapper, answers one stored item byte for byte; the backfill twice is once; the static guard: no balance write outside `ledger.ts`, the claw's TODO); `ledger-do.test.ts` (a match room stopped between D1 and its storage drops once; Squads retried).
- Unit (Nov 6): `packages/server/test/welcome.test.ts` (the Welcome Crate: 5 not 4, abandoned games, races, the backfill, opening once, never tradeable, no purity, old lockers), `packages/app/test/hunchess-rides.test.ts` (every ride's colorway draws).
- e2e: `e2e/welcome-crate.spec.ts` (the Welcome Crate end to end, Nov 6); `e2e/shop.spec.ts` (round 2: an admin's grants and both buys, the counts following; a counted Boss alone battle's token box,
  its start pushed back in the local database by `backdateSoloBattle`), `e2e/icon-editor.spec.ts`, `crate-banner.spec.ts`, `profile.spec.ts` (an admin's locker too; rides: the locker's Ride tab, the preview
  riding in boxes that don't move, the profile's pawn riding and Wearing; `giveItems` in `e2e/helpers.ts` gives items no crate holds,
  straight in the local database).
- The Fischer Random banner (`.fischer-stage` in styles.css): its band slants but the words stay level, so its padding
  must clear the words' ends (about 0.06 of their width); `crate-banner.spec.ts` measures that every frame.
- The fitting sheet: `npm run preview:items -- <scratch>/sheet.png items=<id>[,<id>]` (read the PNG; keep it out of
  the repo). `sheet=1` gives a short sheet to show a batch (cards, both pawns, `colors=`, `outfits=a+b;c`). `scale=1` or `scale=2`
  renders at that display scale, to look for stray pixels. A ride shows ridden on every skin (`with=pirate-hat` for a hat on the rider).

## Rules for this area (from `.claude/LESSONS.md`)

- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a swatch, emoji or icon in its place.
- When a number describes a drawing (a purity), measure the drawing against the number over many cases, then test it.
- A packed pixel value compared with a typed array's is made unsigned (`>>> 0`) first; a flood fill has a bound it
  can't pass; test a tool many times in a row on its own result.
