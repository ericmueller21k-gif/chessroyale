# The shop, crates, the locker and the icon builder

Lane: `item-builder` (crate items and shop cosmetics; its checklist for adding a crate item is in
`.claude/agents/item-builder.md`). The icon builder sits in the profile (`hub`).

## How it works today

- **Nothing here changes how a match is played or scored.** Everything is cosmetic.
- **Its kill switch** (`PAUSE_SHOP`, [ops.md](ops.md) "Kill switches"): while it's set, the Shop and Crates tabs say
  "The shop is resting for a bit. Back soon." and the server refuses getting items and opening crates; the locker
  (wearing what you have) stays. Buying coins has its own switch, `PAUSE_PAYMENTS` ([payments.md](payments.md)): `PAUSE_SHOP`
  doesn't stop it.
- **The shop** (`core/shop.ts`): God King effects (the color of his bolts, beam and halo; one is always on, Holy
  Light the free starter) and chat packs (not equipped: you use every pack you own). Prices in coins (God King effects `SHOP.godKing`, 300-400; chat packs `QUICK_CHAT.packPrices`, 100-150; both since Nov 18); `SHOP_FREE` is
  on (its items are free: "Get · Free"; the "free while we test" note is gone since Nov 9). The pawn hats it used to sell are Beta crate items now (Oct 11, 2026); the shop
  is kept for God King packs and, later, things like boss and attack animations.
- **Earning coins: play coins** (Nov 25; [2026-11-25-play-coins.md](../decisions/2026-11-25-play-coins.md); the payments design's
  section 6, PR 2 of its build): every counted game pays coins with its XP, the same rules and the same batch (`PLAY_COINS` in
  settings.ts, core's `play-coins.ts`, server `play-coins.ts` via `xp.ts grantXp`; the storage and guards: [accounts.md](accounts.md),
  "Play coins"). 1.8 a counted minute (at most 54 a game) until 300 an XP day; a bonus past that for a win 15, a ranked draw 5, a
  50 v 50 team's top 3 +10, Squads 1st 40, 2nd 25, 3rd-4th 15, 5th-8th 5, paid by the day's steps (full, half, a quarter, none past
  550 earned): 600 a day at most. Solo: the minutes XP paid under its solo cap, no bonus. Ranked's and Squads' own coins are gone (Squads'
  crates stay). **The coin strip** (Nov 25, PR 3; [2026-11-25-coin-strip.md](../decisions/2026-11-25-coin-strip.md);
  `components/CoinStrip.tsx`, timings `END_SCREEN.coins`, the view core's `coinStripView`): every end screen with an XP box shows the
  game's coins in one place, right under the XP bar, its width and height from the first paint. After the XP fill, coins drop into a
  pile (one a 5, at most 10), "+52" rolls like a gas pump, the parts show as the count reaches them ("Play +27 · Win +15"), "PLAY TODAY
  186/300" (or "300/300 · FULL"); `clawCoin` per landing, `sell` at the end; a tap or reduced motion: the end at once. No coins: greyed,
  with why (`COIN_NONE_LINES`). Ranked's and Squads' coin lines are gone. The 1 v 1's computer column has the compact strip (44 design
  px, two rows, at the column's scale); a computer's boss result scales its whole column with a short window so Play again and Home stay
  whole ([2026-11-25-coin-strip-fit.md](../decisions/2026-11-25-coin-strip-fit.md)). Tests: `e2e/xp.spec.ts` ("the coin strip under the XP box",
  the test game's, 320 px), `e2e/perf.spec.ts` (the end screen on a slow phone), core `play-coins.test.ts`. The day's table by player and hours: `reports/coin-report.md`
  (`npx tsx packages/sim/scripts/coin-report.ts`, from the settings). The FAQ's "Coins" (in "XP and levels") follows the settings.
- **The coin boost and the Crate Bonus** (Nov 26, PR 4; [2026-11-26-coin-boost.md](../decisions/2026-11-26-coin-boost.md); `COIN_BOOST`, `LEVEL_CRATE_BONUS`; core and server `coin-boost.ts`; storage and guards: [accounts.md](accounts.md), "Quests" and "Play coins"): a daily quest finished drops a Coin Boost Crate 4% or a Crate Bonus 4%; never sold. The crate opens free in the Crates tab (`POST /api/locker/boost`; `components/BoostCrate.tsx`, placeholder art `BoostArt.tsx`): 2.5x coins over 120 minutes of games that pay play coins (base coins toward the day's caps; another crate adds 120, never stacks; each game uses the minutes that earned its play coins, so the game reaching the day's 300 uses only part of its own, and at least `COIN_BOOST.minGameMinutes`, 5). The Crate Bonus doubles the crates of the next 5 paying levels. Shown: the Crates tab's two lines ("Coin boost: x2.5 coins · 95 min of play left", "Crate bonus: 4 level-ups left", greyed while off) and the crate's row and dialog, the reward card ("Coin Boost Crate!", "+2 Winter Crates (Crate bonus)"), the strip's "x2.5 BOOST · N MIN LEFT" badge and "Boost" part. Tests: core and server `coin-boost.test.ts`, `e2e/shop.spec.ts` ("the coin boost in the Crates tab").
- **Buying with coins is one transaction** (`buyItem`, one D1 batch: all of it or none): the item goes in only if the
  coins are there (an item owned by then fails the batch), and the coins come off with it, so two taps or two devices
  at once never charge twice or take the coins below zero (`docs/decisions/2026-10-16-atomic-shop-purchase.md`). **Earned coins go first** (Nov 26, payments PR 5; [payments.md](payments.md)): the spend goes through
  `applySpend` (purchases.ts), which takes earned coins and then the oldest bought coins in the same batch, guarded on what it read and
  planned again once if something changed meanwhile ("That didn't go through. Try again." if it changes twice). Coins bought with money
  (none yet: Stripe is PR 8) are a balance of their own in the ledger, beside the wallet's coins.
- **The inventory layer** (Nov 22; [2026-11-22-inventory-layer.md](../decisions/2026-11-22-inventory-layer.md); `InventoryLayer` in `components/PageLayer.tsx`, the page layer Chess Town's side menu pages use on a computer too, [town-square.md](town-square.md)):
  the same `ShopScreen` (opened on Crates) in the shop page's own frame (it looks the same as from the main menu; on a computer the
  same middle column, without the side menu and chat rail, whose links would leave), opaque, over whatever screen you're on, from the end screen's reward card ("Go to inventory"), so
  you stay in a Battle Tower run or a party. Opening crates and equipping work in it as on the page. Back, Escape or the phone's back
  gesture close it (one history step of its own: App.tsx's popstate asks `layerTakesPop` first); no key reaches the screen under
  it (a capture-phase guard), and the pop-ups inside it (the delete dialog, the gambling warning, the shop's note) take their own Escape
  in the capture phase too. Its opener owns it: when that screen goes, so does the layer.
- **The Shop tab's page** (Eric's mockup, Nov 9; [2026-11-09-shop-page.md](../decisions/2026-11-09-shop-page.md); `ShopPage` in
  `screens/Shop.tsx`). **Look only: no purchase is wired**; a price tapped shows the pop-up "Buying opens soon." (Stripe and coin
  purchases come next; who may buy coins is decided on the server since Nov 26, `GET /api/buy`: [payments.md](payments.md)). Under the tabs: "Everything in the shop is 50% off during beta." (from `SHOP.discount`). Then the **special
  offer** banner (dark with gold, same in both themes): "SPECIAL OFFER", **Crate + Key Bundle**, "3 Keys + 3 Random Crates", "Includes a
  chance at a [Mythic Crate icon] Mythic Crate.", its price pill; its art `BundleArt` (three mystery crates and three keys on a gold glow).
  Then the **cards** (2 a row on a phone, the page scrolls; 4 on a computer): Boss Crate (`BossCrateArt`, "?" seal), HunChess Crate,
  Gift Crate (`WinterCrateArt`), Beta Crate, Crate Key, each with art, name, one line and a price pill. **The discount**
  (`SHOP.discount`, 0.5; `shopPrice` and `discountLabel` in `core/shop.ts`, whole coins, half up): a red "50% OFF" ribbon on every card
  and the bundle, the full price struck through beside the discounted one; at 0 no ribbons and no strike. **Limited items**
  (`SHOP.limited`: Gift, Beta): a gold clock in the card's top-left corner; its tap opens "Limited: a rotating shop item. It leaves the
  shop when its time is up." (OK, Escape or a tap outside close either pop-up; nothing moves). Prices: `SHOP.prices` (full, in coins; Nov 18, the payments design's table 8: key 100, HunChess 50, Gift and Beta 75, boss crate 200, bundle 400; [2026-11-18-coin-prices.md](../decisions/2026-11-18-coin-prices.md)). The coin is
  `Coin` (components/Coin.tsx: a king's head on a boss-token-style gold coin, Nov 17), in the top bar, price pills and Buy buttons. **The Mythic Crate** (`MythicCrateArt`: purple and black, gold crown, the HunChess crate's glint tinted lilac) is
  defined only in the decision note for now (a Fischer Random pull; each of the bundle's crates `SHOP.bundleMythicChance` likely).
  `BossCrateArt({ boss })` lays a boss's token over the seal (for the inventory, not wired there yet).
- **Crates** (`core/crates.ts`): two series, **Beta Crate · Series 001** (listed first; it ships in batches, the plan
  is in the history: complete since Oct 14, 28 items: the Classics, the secret agent, the pirate, the ninja and a
  one-off Smiley Face) and
  **Winter Crate · Series 1**. Each lists its items once; an item's tier says where it is.
  Every drop rolls three things independently:
  1. **its tier**, which decides the item: the opening strip lands on a tier's box (Common to Epic, color-coded:
     Winter's presents, Beta's supply boxes), which opens to one of that tier's items evenly, or on **Transcendent** (called
     Fischer Random until Nov 24; still `FISCHER` / `fischer` in the code; its tile a prismatic crate, `TranscendentArt`)
     (Legendary and Mythic items only, by tier: Legendary 80, Mythic 20, shared evenly). Both crates: 40/26/18/14/2.
     A tier with no items is left off the strip, and a test keeps every live crate's tiers filled;
  2. **its color** (red and yellow common, Pearl the rarest; some items roll a second color, and the Gift-Wrap Tube's
     second stripe color comes from its seed instead, `secondColor`, so it's never stored);
  3. **its purity**: 100% minus a blemish of 0–100% (blotches over that share of its color); shiny at 90%+.
  Crates are opened on the server, so nobody can make themselves a Pearl crown.
- **Crates need keys** (Nov 9, XP phase 2; [2026-11-09-xp-phase2-crates.md](../decisions/2026-11-09-xp-phase2-crates.md)): a series crate
  opens, for everyone (admins too), only with one of that crate held (`series_crates`, by series; ledger kind `series_crate`) and one crate
  key, in one ledger op ("You need a Winter Crate and a crate key to open it."). Crates come from the daily reward, every other level (1 and a key, `XP.levelCrates`: 2 until Nov 18; every level until Nov 20),
  some quests (a win quest's crate; the weekly's crate and key: [accounts.md](accounts.md), "Quests") and Squads' placements, all of the newest series (`XP.rewardCrate`); a crate held before (the wallet's old `crates`) became a Winter
  Crate as the locker was read. The Crates tab shows each series crate's count and a padlock while it can't open; its Open is greyed
  without both. `?fischer=1` / `?shiny=1` only where `TEST_SWITCHES` is "1". Every 20th level's boss crate (every 10th until Nov 20) is picked in the Crates tab's
  "Boss crate choice" (`POST /api/locker/pick`; [2026-11-09-xp-phase2-boss-pick.md](../decisions/2026-11-09-xp-phase2-boss-pick.md)).
- **The bonus crate** (Eric, Nov 24: "like League of Legends does this ... 25% of the time ... every crate possible that exists, even ones
  that have been retired, just evenly spread"; [2026-11-24-bonus-crate.md](../decisions/2026-11-24-bonus-crate.md); `CRATE_BONUS` in
  settings, core's `bonus-crate.ts`): every crate opening (a series crate's; a boss crate's, bought, picked or won) has
  `CRATE_BONUS.chance` (25%) of a bonus crate, any crate in `CRATES` or `BOSS_CRATES`, each as likely (`bonusPool`: not the Welcome
  Crate, whose own opening rolls none either; not an admins-first boss's crate, except for admins), into the inventory unopened, with a
  crate key when it opens with one (`opensWithKey`: series crates). Rolled by the server with the item's own roll, in the open's one
  ledger op (`bonusLegs`; a retry answers the stored item and bonus, `openedBonus`). **A bonus crate never rolls a bonus** (Eric: "you
  can't just keep crating into other crates"): it's held under its crate's id with a `bonus:` prefix (`series_crates` "bonus:winter-1",
  a `boss_crates` row "bonus:boss-tiger"; no migration: the ledger, a guest's sign-in, erasing and the download carry it as any crate);
  holding both kinds, the ordinary ones open first. The locker counts it with its crate's and lists `bonusCrates`; the crate's page:
  "You have 2 (1 bonus)". **Shown:** a beat after the item's card, a second card over it on a short gold beam (`BonusStage` in
  `crate-open/`, `BonusCard` in Crates.tsx; its beats `BONUS` in `timeline.ts`): "BONUS!", the crate (a boss crate's with its token),
  its name, "+1 crate key", OK (back to the item's card; the item's stage dims and its buttons are inert meanwhile and `BONUS.calmMs`,
  300 ms, after OK, so a double tap on OK, which sits over "Open another", opens nothing; the dialog takes the focus and gives it back to
  the item's first button). It can't be skipped: Done or Open another before its beat shows it first, and the crate stays unseen (comes
  back on return) until its OK (the review, Nov 25). Each crate's odds panel and the FAQ (`bonusOddsLine`, N and each share from
  `bonusPool()`): "Opening a series or boss crate: 25% chance of a bonus crate, one of N crates chosen evenly (about X% each, so about Y%
  of openings for each), with its key if it needs one. The Welcome Crate and crates of bosses not yet released aren't in it. Opening a
  bonus crate never gives another." An empty pool gives none. Where `TEST_SWITCHES` is on, only when asked (`?bonus=1`,
  `?bonus=<crate>`, the "Bonus crate" box; `?bonus=0` or empty: none).
- **Items** have a slot (head, face, skin, weapon, ride, outfit: `ITEM_SLOTS`, the server's check too), are drawn on the pawn's 100 × 100 square, and fit by anchors
  (head, face, eyes, neck, mouth: each piece's own lines; a mustache sits at the mouth, under a snowman's carrot).
  Every face item is tagged above or below a hat (`faceLayer` in crates.ts; Eric, Oct 30): goggles and shades are drawn
  over a hat, every other face item under it (a smiley under a pirate hat's brim). A new face item must say which.
  Weapons don't move with the piece: they're drawn where every piece's side (or shoulder) is. Your
  pawn wears your equipped items on the vote board, the cut screen and your profile; other players' looks come with
  them into a lobby; bots wear simple seeded outfits (`BOT_LOOKS`).
- **Item animations and the Smiley's expressions** (Nov 25; [2026-11-25-item-polish.md](../decisions/2026-11-25-item-polish.md)): the Fire & Ice
  Crown's flames, the Candy Cane's strand, the Gift-Wrap Tube's confetti, the Parrot's flap and the Tommy Gun's key and puff play (CSS `ia-`
  classes in styles.css, SVG transforms and opacity, no frame loop) only under `.ia-live`: `live` on `ItemArt` / `Avatar`, set where the
  item is the focus (your pawn on screen, the locker's preview, a crate's reveal, a profile's Wearing rows and tiles), and only inside
  `prefers-reduced-motion: no-preference`. Grids, lists and the power banner stay still. A Smiley Face's expression (`SMILEY_EXPRESSIONS`:
  Smile, Wink, Tongue, Cool, Surprised, Laughing) comes from its seed (`smileyExpression`, its own stream; never stored); `itemName(it)`
  names it ("Smiley Face · Wink") on the reveal card, the locker tile and its label, the delete dialog and the profile; `stackKey` keeps
  each expression its own stack.
- **Outfits** (Nov 10; [2026-11-10-outfit-slot.md](../decisions/2026-11-10-outfit-slot.md)): the `outfit` slot. One on, every other worn item is
  hidden (core's `shownLook`: only the outfit, and eyewear, `eyewear: true` (goggles, shades) while `OUTFIT.eyewear`), everywhere a look is
  drawn (`Avatar`, the town, the profiles' rows); the rest stay equipped underneath. **Secret** (Eric's exception to "nothing hidden"): the
  locker's Outfit tab shows only once you own an outfit (`ownsOutfit`); with one on, other items greyed with "Hidden by your outfit"
  (`hiddenByOutfit`). Drawn with the rides' kit (`components/rides/banana-suit.tsx`, the pawn's head in its face hole), in every view, even
  where rides aren't. **Banana Suit**: Mythic, the Mythic Crate's secret item (`MYTHIC_CRATE_ITEMS`; the crate is still look-only: no roll yet).
- **Rides** (Oct 31: [2026-10-31-rides.md](../decisions/2026-10-31-rides.md); Nov 1, every boss's:
  [2026-11-01-rides-v2.md](../decisions/2026-11-01-rides-v2.md)): items in the `ride` slot, one at a time, that your pawn sits on,
  all Mythic, with a color, a purity and shine like every item: **Riding Chirp**, **Moon's Ride**, and (Nov 1) **Hollow's Bulb** (two
  colors: the glass and its glow), **Brush Ride**, **Alfil's Howdah**, **Balloon Pup**, **Big Boy's Buggy**, **Boingo's Pogo**, **Paper
  Crane**, **Candy Cane Sled**, **Giraffe Gallop**, **Puddles's Mower**, **Sawyer's Dozer**, **Rodeo Bull**, **Cheetah Shoes** (Dash's, in his crate since Nov 3:
  twice as fast in the town), **The Log Roller** (Timber's), **Pen Pony** (Wrangler's, Nov 4, in his crate from the start: a pen
  knight saddled, the knight your pawn's color, only its blanket the item's color) and **Birdie's Train** (Nov 23, in his crate from the
  start: his little diesel, long and low, its body the item's color, Yellow his train's own; its moving sound his own train run, made in
  code: [2026-11-23-birdie-ride-crate.md](../decisions/2026-11-23-birdie-ride-crate.md)). Their names and lines are the drawings' own. **In no crate yet** (the
  crate comes later): only admins have them, as admin copies (red, emerald second color, 100%: "Admins own one of every item", below).
  **Where the drawings came from:** copied as drawn from `claude/boss-art` (`scripts/boss-art/out/<ride>/<ride>.tsx`; their
  `summary.md`, `views-summary.md` and `trail-summary.md` there have the artist's notes; Nov 1; Moon's Ride redrawn as a rounded star Nov 17, from `out/star-ride/`, its id kept; the same day its pawn sunk into a hollowed-out seat, cut 70, and the edge round the seat curved so nothing beside the pawn is cut straight; then the star drawn once, behind the pawn, which a ride's `pose.hide` clips below the seat's lip: nothing of a ride's drawing over the pawn, [2026-11-17-star-seat-one-layer.md](../decisions/2026-11-17-star-seat-one-layer.md)) into
  `components/rides/` (`kit.ts`: the types; `load.ts`: each drawing its own chunk, loaded when a ride is drawn, Nov 1: town-square.md,
  "Rides"); only their import lines changed and the `!`s the app's typecheck asks for, and
  Hollow's Bulb's green cord was taken out of every view by hand (Eric, Nov 1: "we don't really need that"). The old cat, `hollow-steed`, isn't one. Each is a `Back` and a `Front` with the pawn
  between them, raised onto its seat, maybe tilted and hidden below the seat (`pose`), and two animations: `idle` and `move` (one
  square of the town's walk): its side; all also have `views` (its back, walking up the screen, and its front, walking
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
- **Crate riders** (Nov 27; Eric: "5 riders... crate exclusives"): the Shopping Cart, Robo Vac, Magic Carpet, Skateboard and Rocket, rides
  with no boss, drawn like the others (`components/rides/<id>.tsx`), in the Beta Crate's Fischer Random (Mythic) and nowhere else: no
  boss crate, no HunChess colorway (`CRATE_RIDES` in crates.ts). [2026-11-27-crate-riders.md](../decisions/2026-11-27-crate-riders.md).
- **A boss's crate, sold inside the boss's home** (Nov 2, round 1: Babur's and Puddles'; since, Alfil's, Big Boy's, Timber's, Dash's and, Nov 3, Hollow's with Hollow's Bulb, shown to everyone; Nov 4, Wrangler's with Pen Pony and Grex's with Giraffe Gallop, everyone's; Nov 5, Ginger's with the Candy Cane Sled, everyone's (its id `boss-gingerbread`: his boss id is also the Gingerbread Man skin's item id, and nothing confuses the two), and Folio's with the Paper Crane, everyone's; Nov 6, Smudgy's with the Brush Ride and Boingo's with Boingo's Pogo, everyone's; Nov 23, Birdie's with Birdie's Train, admins first as he is, on his bar since the same day; town-square.md, "Inside a shop"): the
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
    and the Durable Object's `writeResult` counts the battle (`countBossBattle`) as it saves their result (once). A **solo** battle runs on
    the device, so the server can't see its moves: it counts by **the server's clock alone**: `POST /api/boss/solo/start` as the battle
    begins (App.tsx's `startSolo`, `noteSoloBattle`: the server notes the time in `solo_battles`, one open per account, a new start
    replacing it; each of the two asked once more a second later when it fails on the way or on the server: `askTwice`, account.ts), `POST /api/boss/solo/finish {battle}` from its result screen (taken off in one statement, so it's finished once): it
    counts when 5 minutes or more passed between the two. Its 10-moves path isn't there (the device's word). The drop itself is one
    transaction: the drop row goes in only while the window (counted in the same statement) has room, and the token with it.
  - **The result screen** (`components/TokenBox.tsx`, on `ResultsScreen` for any boss battle): when the server says the battle dropped
    you a token, a square box in the gambling warning's look (the locker's dialog), the token turning in it, **"You got a Babur token!"**
    (`tokenGotLine`: "an Alfil token", "a Boingo token") and **OK** (Escape or a tap outside close it too). Solo: the finish's answer.
    Online: `GET /api/boss/token?battle=CODE`, asked at 0.7, 2.2, 5.2, 11 and 21 s after the results while the room writes them.
  - **The inventory** (the Crates tab, `TokenStock`): under Keys and Crates, **"Boss tokens"**: every live boss's token with "× N",
    greyed at none (shown, not hidden), an admin's admins-first boss's too; "From boss battles. Spend them on a boss's crate in its shop
    in the town." **Keys are counted now** (`wallets.crate_keys`; the Crates tab's "Keys × ∞" became the real count), and a boss crate
    bought with one takes one; since Nov 9 every series crate takes one to open too.
  - **The token pictures** are the drawings from `claude/boss-art` (`scripts/boss-art/out/token-<name>/`), copied into
    `components/tokens/` (only their import lines changed, and the `!`s the app's typecheck asks for), one chunk loaded the first time a
    token shows (`TokenArt.tsx`: 40 × 40 crisp; `animate` plays its idle, the result box's; a plain gold coin for a boss with none). Every
    live boss, Timber, Dash and Birdie (Nov 23, from `claude/boss-art` at 0746234e) have one (Dash's is the art's `TOKEN_BLITZ`).
  - **The crates** (`BOSS_CRATES` in core's crates.ts, beside `CRATES` but never in it, so the Crates tab can't open one free; Timber's and
    Dash's, Nov 3, and Birdie's, Nov 23, listed to admins and whoever holds one while they're in the game for admins first, and not in the FAQ; Dash's ride
    is Cheetah Shoes): Babur's
    and Puddles', each the boss's ride (the only Mythic, the only item behind Fischer Random: 2%) and the Beta Crate's 24 Common to
    Epic items in its boxes, at the existing crates' odds; rolled on the server as every crate.
  - **Buying** (`POST /api/shop/boss-crate {crate, way}`, `buyBossCrate`): one D1 batch, as the coin shop's: the crate goes into your
    inventory (a `boss_crates` row, unopened) only if the tokens (and the key) are there, then they come off only if that row went in; the
    counts can't go below zero (a CHECK on `boss_tokens.n`, and the guards). A double tap or two devices are two buys, each paid in full or
    refused. The shop's kill switch refuses it. Answers `{crate, locker}`. The shop card's answer: **"Babur's Boss Crate is in your
    inventory."** (Eric, Nov 2; until then a buy opened it at once into the Locker), or "You need 3 Babur tokens." / "You need 1 Babur
    token and 1 crate key.". Since Nov 12 a buy also pops up **"You got Babur's Boss Crate!"** with **Open now** (the Crates tab's own
    opening, `CrateOpening`, over the room) and **Later** ([town-square.md](town-square.md), "The crate's card";
    [2026-11-12-boss-crate-bought.md](../decisions/2026-11-12-boss-crate-bought.md)).
  - **Boss crates you hold** (Eric, Nov 2: "Buying a boss crate from shopkeepers adds the crate to your inventory … they open and shuffle
    the same way normal crate animations work"; [2026-11-02-nov2-fixes-b.md](../decisions/2026-11-02-nov2-fixes-b.md)): the Crates tab
    lists the boss crates under **"Boss crates"**, below the others, its boss's token on the crate's corner, its blurb and **"You have
    2"**. Beside the title, **"Show unowned"** (Eric, Nov 24, his exception to "nothing hidden"; [decision](../decisions/2026-11-24-quests-gap.md),
    `boss-crate-rows.ts`): unchecked by default, only the ones you hold (none: "You have no boss crates yet. Check Show unowned to see them
    all."); checked, every one, greyed with **"You have none"** at none (a tap still shows what's inside); remembered on this device. Its page says **"You have 2."** or
    **"You have none. Babur's shop in the town sells it."**; **"▶ Open"** (greyed at none; no test switches for these) opens it with the
    Crates tab's own strip, unwrap, Fischer Random and reveal, from the crate's own pool (`BOSS_CRATES`); "▶ Open another" greys when none
    is left. The locker's `bossCrates` (crate id → how many). **Opening** (`POST /api/locker/open {crate}` with a boss crate's id:
    `openBossCrate`): one D1 batch: the item goes in only if you hold one of those crates, then the oldest of them comes off only if that
    item went in; so each opens once, never twice, a double tap or two devices open two only if you hold two, and nobody opens one they
    haven't got ("You have no Babur's Boss Crate to open."). The roll is the server's, never a test switch's. The shop's kill switch
    refuses it too.
  - **Admins' test grants** (the Crates tab's "Admin: test grants", admins only: "+1 crate key", "+100 crate keys" (Nov 9); a boss,
    "+1 token", "+3 tokens"; and a crate, any series or boss crate, "+5 crates" (Nov 25: [2026-11-25-admin-crate-grant.md](../decisions/2026-11-25-admin-crate-grant.md)); "+1 Coin Boost Crate", "+1 Crate Bonus" (Nov 26); `POST /api/locker/grant`, "Not found" for anyone else; at most `keysGrantMax` (100) keys and `grantMax` (10)
    tokens at once, `cratesGrantMax` (10) crates). Never a drop: the window doesn't count them. Every admin-only ability: [2026-11-09-admin-abilities.md](../decisions/2026-11-09-admin-abilities.md).
  - **Stored** (each an account's: `account-data.ts`, "bossTokens"; the privacy page's "Boss tokens"): `boss_tokens` (counts),
    `boss_token_drops` (each drop: when, which battle; kept 30 days, the Worker's schedule clears older), `solo_battles` (the open one),
    `boss_crates` (Nov 2: each crate bought and not opened yet, its crate id and when; a new table, so older data reads as none), and
    `wallets.crate_keys`. A guest signing in to an account brings them along (added up; the drops and the crates too, so the window
    counts the drops).
- **Boingo's claw machine** (Nov 6; [2026-11-06-claw-machine.md](../decisions/2026-11-06-claw-machine.md); `CLAW`): its coin slot in his Funhouse opens `openClawMachine()`. One boss
  token in, 25% of the time that boss's Boss Crate, unopened: `POST /api/shop/claw {boss, request}` rolls it through the ledger (`clawOp`, keyed by `request`).
- **The Crates tab's order** (Eric, Nov 25: "refactor this page a bit ... put the admin stuff all the way at the bottom";
  [2026-11-25-crates-page-tidy.md](../decisions/2026-11-25-crates-page-tidy.md)), top to bottom: Keys × N and Crates × N; **Ready to
  open** (a ready Welcome Crate, "Choose your boss crate" when one waits, the series and boss crates you hold; none: "Nothing to open right
  now."); **Boss tokens**; **More crates** with "Show unowned" beside its title (Welcome Crates still to earn, with their meters; the series
  crates you don't hold, greyed with a padlock; "Boss crate choice" greyed with none to choose; with the box checked, the boss crates you
  don't hold); and, admins only, **Admin: test grants** last. Each crate is in one place: Ready to open while you hold it. **A used
  Welcome Crate's row is gone** (Eric's own exception to "nothing hidden": `welcomeRowsShown` in `welcome-rows.ts`): once opened and its
  reveal seen; its page and its ride stay.
- **The HunChess Welcome Crate** (Eric, Nov 6; [2026-11-06-welcome-crate.md](../decisions/2026-11-06-welcome-crate.md); core's
  `welcome.ts`, the server's `welcome.ts`, `WELCOME_GIFT` in settings):
  - **Two, earned** each once per account, ever, at 5 and then 25 finished games (Eric: "the first one you get after 5 games, the next
    one you get after 25"; `WELCOME_GIFT.milestones`) in any mode or against any boss (an online `results` row not marked `abandoned`,
    a solo one only with `XP.minMoves` (10) moves and `WELCOME_GIFT.soloMinSeconds` (60) of the server's own time (`play_ms`; Nov 10:
    empty posts had earned crates; idle open timers still count, accepted while items aren't traded), or a ranked 1 v 1 game), by the server only: one statement inserts a `welcome_crates` row per milestone reached (keyed by account and
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
  - **The prize:** one ride, any of the game's rides but an admins-first boss's (Nov 23, `welcomeRide`: Timber's, Dash's and Birdie's for
    now, 15 rides at 6.67%; each back by itself when its boss goes live; holders keep theirs;
    [2026-11-23-welcome-crate-admin-first.md](../decisions/2026-11-23-welcome-crate-admin-first.md); a boss's ride goes in with its boss
    crate, or the Welcome Crate can't tell it's an admins-first boss's and lists it), each as likely, in the **HunChess colorway** (`<ride>-hunchess`, its own item:
    `HUNCHESS_RIDES` in crates.ts, made from every ride but the crate riders (`CRATE_RIDES`); "HunChess Balloon Pup"), rolled and stored by the server
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
  ([2026-10-31-admin-owns-all.md](../decisions/2026-10-31-admin-owns-all.md)). Nov 7: the locker's preview is one pawn in your default color (W/B picker, bottom right, `Crates.tsx` `LockerPanel`), and the God King tab is gone (its effects stay under All).
- **The icon builder** (the profile): a 48 × 48 pixel drawing with a paint bucket and undo (`UNDO_STEPS`), saved as a
  small PNG data URL (at most 16 KB, checked by the server).

- **The crate opening** (Nov 24; [2026-11-24-crate-open-build.md](../decisions/2026-11-24-crate-open-build.md); `crate-open/`): every
  crate opens the same way (its page's Open, the Welcome Crate, a boss crate's "Open now" in its shop, Boingo's claw machine), on its own
  layer over the screen it came from (`OpenLayer`): the whole phone screen, or a computer's middle column, top to bottom, on a blue-black
  background; the screen under it stays as it was. On a computer the stage (its phone layout, 430 × 540) is scaled up whole to the
  column's width and height, at most 1.5× (Nov 25, Eric: "on the desktop, the present is too small"); the phone's is as it was (scaled
  down only on a short window). The bonus card's OK takes a tap only once it has faded in (`data-ready`). The strip (46 tiles, landing on the 39th) spins `CRATE_OPEN.spinMs` (4 s) with a
  cubic slowdown, a blurred copy fading as it slows, and stops just past the winning tile's near edge, runs a few pixels over and settles.
  Then the winning tier's box drops in, shakes (light leaking from its lid), and its lid bursts off with a beam in the item's tier color;
  the item rises out of the beam into the reveal card, which forms round it (Legendary and Mythic: more rays, light over the whole stage,
  a flash, a jolt). Transcendent: its banner ("TRANSCENDENT!") with its own sound, then a second strip among its items, whose winner's beam comes up without a box. All of it
  is Web Animations on transform and opacity, set up while "Opening…" waits for the server and started together two frames after the
  answer; reduced motion drops the blur, shake and jolt and fades the beam. The sound (made in code: `crate-open/sounds.ts`; Eric's
  mix, Nov 24: the mockup's slot reel spinning, its "card in the spokes" ending) is made ahead in the sound worker as a crate's page opens
  and as Open is tapped, and laid on the audio clock (`timeline.ts` `cues`, sound.ts `playCrateCues`): a metal tick at each tile edge
  crossing, heavier as it slows, and a clunk as the reel locks (no swell, no charge: Eric); the box's thud and knocks, then a glassy
  chord, each tier its own (Nov 24, [2026-11-24-crate-tier-stings.md](../decisions/2026-11-24-crate-tier-stings.md): Common and
  Uncommon one shared; Rare a shimmer; Epic a rising arpeggio; Legendary bright, a choir above and a chime run; Mythic a fanfare's
  chord change and a sparkle cascade), and Transcendent's own as its banner comes up (`T.bannerAt`). Every ending plays a few dB
  under the ticks (Eric: they "hurt my ears"): `ENDING_DB` in sounds.ts, measured with EBU R128; `scripts/render-crate-stings.ts`
  renders each tier's opening as audio to listen to and re-measure. The roll, the odds and what's won are the server's, unchanged.

## Where the code is

| What | Where |
| --- | --- |
| Item list, tiers, colors, crate odds, rolls | `packages/core/src/crates.ts` |
| The bonus crate: its pool, roll and odds line; its legs, storage and stored answer; its card | `packages/core/src/bonus-crate.ts`; `server/src/ledger.ts` (`bonusLegs`, `openedBonus`, `foldBonus`), `locker.ts` (`openCrate`, `BonusMode`), `boss-tokens.ts` (`openBossCrate`); `crate-open/CrateOpenStage.tsx` (`BonusStage`), `screens/Crates.tsx` (`BonusCard`) |
| The Welcome Crate: the crate, its roll, `tradeable`, its text; the grant, opening and notice | `packages/core/src/welcome.ts`; `packages/server/src/welcome.ts`; `components/WelcomeNotice.tsx`; the colorway `components/rides/hunchess.tsx` |
| Shop cosmetics | `packages/core/src/shop.ts`; drawn by `packages/app/src/components/Cosmetics.tsx` |
| Item drawings, fit, cards (`ItemArt`, `Avatar`); crate and box art (`WinterCrateArt`, `PresentArt`, `BetaCrateArt`, `SupplyBoxArt`; the shop page's `BossCrateArt`, `MythicCrateArt`, `BundleArt`) | `packages/app/src/components/Items.tsx` |
| The paint every item uses (color, shine, `Region`, `LINE`) and its blemish's blotches | `packages/app/src/components/item-paint.tsx` and `blotches.ts` (moved out of Items.tsx, Oct 31) |
| Rides' drawings (`RIDES`) | `packages/app/src/components/rides/` (`draw.tsx`: one layer as SVG); their town cells: `scripts/measure-rides.ts` |
| The crate opening's picture, layer, timeline and sounds | `packages/app/src/crate-open/` (`CrateOpenStage.tsx`, `timeline.ts`, `sounds.ts`, `crate-open.css`); its preview `/crate-open-preview.html` (`dev/crate-open-preview.tsx`); `scripts/crate-open-frames.ts` (stills, frames, an MP4 with sound), `scripts/crate-open-perf.mjs` (frame times at 4x) |
| Crate page, the opening's flow (`CrateOpening`), reveal, locker UI (`CRATE_LOOKS`: each crate's art and box) | `packages/app/src/screens/Crates.tsx`; the shop `screens/Shop.tsx`; the gambling warning `components/GamblingWarning.tsx` |
| Server rolls and storage (D1 `items`, `equipped_items`) | `packages/server/src/locker.ts`; the shop's API in `api.ts` / `accounts.ts` |
| Boss tokens, crate keys, the boss crate purchase, solo battles, admins' grants | `packages/server/src/boss-tokens.ts`; rules `packages/core/src/boss-tokens.ts`; the crates `BOSS_CRATES` in `crates.ts` |
| Play coins: the rules (`gameCoins`, the steps); the grant beside XP's; the report | `packages/core/src/play-coins.ts`; `packages/server/src/play-coins.ts`, `xp.ts`; `packages/sim/scripts/coin-report.ts` → `reports/coin-report.md` |
| The ledger: the only writer of coins, crates, keys, tokens, shop items, items, boss crates and Welcome Crates, each change an op with its legs, append-only (Nov 6; a buy, an open or a grant keyed by the app's request id, so its retry applies once; an open's every attempt answers the item as stored, never its own roll) | `packages/server/src/ledger.ts`; `docs/decisions/2026-11-06-ledger.md`, `2026-11-06-ledger-2.md` |
| The token pictures, the inventory's tokens, the result box | `packages/app/src/components/tokens/`, `TokenArt.tsx`, `TokenBox.tsx`; `boss-tokens.ts` (the app's asking); `screens/Crates.tsx` (`TokenStock`, `AdminGrants`) |
| Boingo's claw machine (the play, its log `claw_plays`; the app's machine, flow and sounds) | `packages/server/src/claw.ts`; `packages/app/src/claw/` (`index.ts`: `openClawMachine`; `flow.ts`; `ClawMachine.tsx`; `sounds.ts`) |
| Admins' copies of every item (never stored) | `packages/core/src/admin-copies.ts`; added in `locker.ts` and `accounts.ts` (`shopState`) |
| Bots' outfits | `packages/core/src/bot-looks.ts`, `packages/app/src/looks.ts` |
| The icon builder | `packages/app/src/components/PixelIcon.tsx`, `icon-pixels.ts`; server check `isPixelIcon` in `accounts.ts` |

## Settings

`crates.ts` (`ITEM_DEFS`, `CRATES`, `BOSS_CRATES`, `ITEM_COLORS`, `PURITY_BANDS`), `XP` (the crates and keys a level and the daily
reward give, `rewardCrate`), `BOSS_TOKENS` and
`BOSS_CRATE_PRICE` and `SHOP` (the Shop page's discount, prices, limited items, the bundle's Mythic chance) and `PLAY_COINS` (what play pays: Nov 25) in settings.ts, `shop.ts` (`SHOP_ITEMS`,
`SHOP_FREE`), `BOT_LOOKS` and `QUICK_CHAT.packPrices` in settings.ts. `CRATE_BONUS.chance` (settings.ts): an opening's chance of a
bonus crate (0.25, Nov 24). `CRATE_OPEN.spinMs` (settings.ts): how long the crate opening's strip
spins (4 s, Nov 24); its other beats are in `crate-open/timeline.ts`.

## Tests and tools

- The bonus crate (Nov 24): unit `packages/core/test/bonus-crate.test.ts` (the pool, built from the lists, its exclusions; 25% and
  evenness over seeded rolls; the key; the switch), `packages/server/test/bonus-crate.test.ts` (one op's legs; series and boss crates;
  2,000 seeded openings at about 25%; crypto's own; a bonus crate never rolls and opens last; retries and opens at once; a guest's
  sign-in, the download, erasing; the API: production rolls, `TEST_SWITCHES` only when asked, the kill switch),
  `packages/app/test/bonus-crate.test.ts` (the card's words, key and token; its OK; the odds line and the FAQ's from the setting); e2e
  `e2e/crate-banner.spec.ts`, "crates: a bonus crate's card after the item's…" (`?bonus=winter-1`: the card over the item's, the locker
  at once, OK, "You have 1 (1 bonus)", its own opening gives none) and "crates: the bonus card can't be skipped by a fast Done, and a
  double tap on its OK opens no other crate" (the review's M1 and M2, the focus).
- The crate opening (Nov 24): unit `packages/app/test/crate-open.test.ts` (the clicks' times, the cues, every sound piece made and
  level, every ending's loudness K-weighted under the ticks', the stings climbing); e2e `e2e/crate-banner.spec.ts`, "the opening covers the whole phone screen or the computer's middle column…" (the layer's box,
  phone and computer, on top at its corners, the side columns uncovered; Done leaves the page under it where it was; `CRATE_SHOTS=<dir>`
  saves its stills); the crate specs wait for `.crate-opening .cox-reel` and `.reveal-card` on the layer.

- Unit: `packages/core/test/crates.test.ts` (rides: their slot, no crate, a look keeping its ride), `bot-looks.test.ts`, `packages/server/test/accounts.test.ts` (a ride in the ride slot only),
  `shop-buy.test.ts` (buying with coins, `SHOP_FREE` off), `claw.test.ts` (the claw machine: one token a play, refused with none, about 25%, the crate on a win, a retry, plays at once, guests, the seed only with TEST_SWITCHES, the admins' grant), `boss-tokens.test.ts` (the drop rule and its window, a race for the
  window's first place, which boss, guests where sign-in is set up, 10 moves / 5 minutes, solo timed by the server and counted once,
  the match room's count of picks, buying both ways, not enough, twice at once, admins' grants admin-only, a guest's sign-in), `admin-copies.test.ts` (admins own one of every item, a ride too), `packages/app/test/blotches.test.ts`, `gift-tube.test.ts`,
  `icon-pixels.test.ts`.
- Play coins (Nov 25): unit `packages/core/test/play-coins.test.ts`, `packages/server/test/play-coins.test.ts`,
  `packages/app/test/squads-reward-line.test.ts`; the FAQ's words `packages/app/test/faq.test.ts`; e2e `e2e/xp.spec.ts` (a counted solo
  game's coins). The full list: [accounts.md](accounts.md), "Tests".
- Unit (Nov 6): `packages/server/test/ledger.test.ts` (an op replayed or raced applies once; each path's key; a 500-op reconciliation with merges and deletes; append-only; each request id replayed; an open raced at each step, held by the test's SQL wrapper, answers one stored item byte for byte; the backfill twice is once; the static guard: no balance write outside `ledger.ts`, the claw's TODO); `ledger-do.test.ts` (a match room stopped between D1 and its storage drops once; Squads retried).
- Unit (Nov 9): `packages/server/test/rewards.test.ts` (a crate's open takes the crate and a key, refused without, two at once with one
  key; old crates to Winter; the boss crate pick); e2e `e2e/xp-rewards.spec.ts` (the Crates tab after a level-up, in the inventory layer over the end screen since Nov 22, an open, the padlock,
  the pick, +100 keys). The test helper `stockCrates` (server) and `giveCrates` (e2e) give crates and keys.
- Unit (Nov 6): `packages/server/test/welcome.test.ts` (the Welcome Crate: 5 not 4, abandoned games, races, the backfill, opening once, never tradeable, no purity, old lockers), `packages/app/test/hunchess-rides.test.ts` (every ride's colorway draws).
- The Shop page (Nov 9): unit `packages/core/test/shop.test.ts` (the discount's rounding and ribbon); e2e `e2e/shop.spec.ts`, "the Shop
  tab's page" (the banner, the cards, ribbons and struck prices from `SHOP`, the clock's pop-up, "Buying opens soon", nothing moves; 2 a
  row on a phone, 4 on a computer; `SHOP_PAGE_SHOTS=<dir>` its stills) and "the shop page's width" (its Shop case is back).
- e2e: `e2e/welcome-crate.spec.ts` (the Welcome Crate end to end, Nov 6); `e2e/shop.spec.ts` (round 2: an admin's grants and both buys, the counts following; a counted Boss alone battle's token box,
  its start pushed back in the local database by `backdateSoloBattle`), `e2e/icon-editor.spec.ts`, `crate-banner.spec.ts`, `profile.spec.ts` (an admin's locker too; rides: the locker's Ride tab, the preview
  riding in boxes that don't move, the profile's pawn riding and Wearing; `giveItems` in `e2e/helpers.ts` gives items no crate holds,
  straight in the local database; Nov 15, "a shiny ride's shine stays inside its own shapes": a shiny pogo and crown worn, every
  shine's clip is its own Region's and no two clips on the page share an id with different shapes).
- The Transcendent banner (`.fischer-stage` in styles.css): its band slants but the words stay level, so its padding
  must clear the words' ends (about 0.06 of their width); `crate-banner.spec.ts` measures that every frame.
- Item polish (Nov 25): unit `crates.test.ts`, "a Smiley Face's expression comes from its seed…"; e2e `public-profile.spec.ts`, "four worn
  items all fit" (the smiley's tile reads "Smiley Face · Laughing"); `@perf` `perf.spec.ts`, "worn items playing on a slow phone" (local only).
  The fitting sheet's `live=1` plays the animations, `seeds=1,8,…` sets each card's seed (a smiley's expression), `width=` the page's.
- The fitting sheet: `npm run preview:items -- <scratch>/sheet.png items=<id>[,<id>]` (read the PNG; keep it out of
  the repo). `sheet=1` gives a short sheet to show a batch (cards, both pawns, `colors=`, `outfits=a+b;c`). `scale=1` or `scale=2`
  renders at that display scale, to look for stray pixels. A ride shows ridden on every skin (`with=pirate-hat` for a hat on the rider).

## Rules for this area (from `.claude/LESSONS.md`)

- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a swatch, emoji or icon in its place.
- A Region's clip id is `regionClip(p, name)` (`<paint id>-clip-<name>`, item-paint.tsx), its own namespace: any other id a drawing
  makes from `p.id` (a gradient, a mask, a clip of its own) never starts `-clip-`. Refer to a Region's clip only through `regionClip`
  (Nov 15: the pogo's "seat" region shared the rider cut's `-seat` id, and its shine slid across the preview as a rectangle).
- When a number describes a drawing (a purity), measure the drawing against the number over many cases, then test it.
- A packed pixel value compared with a typed array's is made unsigned (`>>> 0`) first; a flood fill has a bound it
  can't pass; test a tool many times in a row on its own result.

**Chat packs off (Nov 8, `CHAT_PACKS_SHOP` in settings.ts = false).** The shop has no Chat packs tab and nothing is for sale
(its Shop tab reads "Nothing is for sale right now."). The quick-chat picker offers only the free default lines. Owned packs
still send; no data is deleted. Guards: `packages/core/test/chat.test.ts`, "packs the shop stops offering"; `e2e/shop.spec.ts`,
"the shop has no … title"; `e2e/chat.spec.ts`, "quick chat picks in the profile".
