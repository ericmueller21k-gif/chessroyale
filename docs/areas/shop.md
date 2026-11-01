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
- **Rides** (Oct 31: [2026-10-31-rides.md](../decisions/2026-10-31-rides.md)): items in the `ride` slot, one at a time, that your pawn
  sits on: **Riding Chirp** (the saddle, its flap and the collar take the color) and **Moon's Ride** (the moon does), both Mythic, with
  a color, a purity and shine like every item. **In no crate yet** (the crate comes later): only admins have them, as admin copies
  (red, 100%: "Admins own one of every item", below). The drawings were copied as drawn from `claude/boss-art` (`scripts/boss-art/out/riding-chirp/` and
  `moon-ride/`, Oct 30; their `summary.md` there has the artist's notes) into `components/rides/` (`kit.ts`: the types, `RIDES`).
  Each is a `Back` and a `Front` with the pawn between them, raised onto its seat, maybe tilted and hidden below the seat (`pose`), and
  two animations: `idle` and `move` (one square of the town's walk). Drawn: the locker's tile (`ItemArt`: the ride with a white pawn
  on it), the locker's preview and the profiles' pawn (`Avatar`'s `ride`: the pawn and its items on its ride, its idle playing, fitted
  into the same box, so a box never grows), the profile's Wearing rows (last), and the town square (baked sheets: town-square.md,
  "Rides"), and **home** (Nov 1: the big pawn on your card, your ring and the side menu's Profile item; hub.md, "Your ride on home").
  **Each ride's size** under its pawn (Nov 1): `RIDES.scale` in core's settings (1 for now), everywhere a rider is drawn but the item's
  own tile; an admin's `?rideScale=K` tries one size for every ride (town-square.md, "Rides"; [2026-11-01-ride-scale.md](../decisions/2026-11-01-ride-scale.md)).
  **Not drawn** (the pawn alone, as before): a match's screens, the Colosseum's crowd, the
  queue's and Squads' cards, the boss stage, the town's person card, and the public profile's Equipped Cosmetics row (four tiles at
  most; its View all lists the ride). Changing a ride's drawing, the paint's fills and lines (`item-paint.tsx`) or the colors:
  `npx tsx scripts/bake-rides.ts` (a test fails until it's run; the blotches, `blotches.ts`, and other items don't ask for it).
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
| Shop cosmetics | `packages/core/src/shop.ts`; drawn by `packages/app/src/components/Cosmetics.tsx` |
| Item drawings, fit, cards (`ItemArt`, `Avatar`); crate and box art (`WinterCrateArt`, `PresentArt`, `BetaCrateArt`, `SupplyBoxArt`) | `packages/app/src/components/Items.tsx` |
| The paint every item uses (color, shine, `Region`, `LINE`) and its blemish's blotches | `packages/app/src/components/item-paint.tsx` and `blotches.ts` (moved out of Items.tsx, Oct 31) |
| Rides' drawings (`RIDES`) | `packages/app/src/components/rides/`; their town sheets: `scripts/bake-rides.ts` |
| Crate page, opening strip, reveal, locker UI (`CRATE_LOOKS`: each crate's art and box) | `packages/app/src/screens/Crates.tsx`; the shop `screens/Shop.tsx`; the gambling warning `components/GamblingWarning.tsx` |
| Server rolls and storage (D1 `items`, `equipped_items`) | `packages/server/src/locker.ts`; the shop's API in `api.ts` / `accounts.ts` |
| Admins' copies of every item (never stored) | `packages/core/src/admin-copies.ts`; added in `locker.ts` and `accounts.ts` (`shopState`) |
| Bots' outfits | `packages/core/src/bot-looks.ts`, `packages/app/src/looks.ts` |
| The icon builder | `packages/app/src/components/PixelIcon.tsx`, `icon-pixels.ts`; server check `isPixelIcon` in `accounts.ts` |

## Settings

`crates.ts` (`ITEM_DEFS`, `CRATES`, `ITEM_COLORS`, `PURITY_BANDS`, `CRATES_FREE`), `shop.ts` (`SHOP_ITEMS`,
`SHOP_FREE`), `BOT_LOOKS` and `QUICK_CHAT.packPrices` in settings.ts.

## Tests and tools

- Unit: `packages/core/test/crates.test.ts` (rides: their slot, no crate, a look keeping its ride), `bot-looks.test.ts`, `packages/server/test/accounts.test.ts` (a ride in the ride slot only),
  `shop-buy.test.ts` (buying with coins, `SHOP_FREE` off), `admin-copies.test.ts` (admins own one of every item, a ride too), `packages/app/test/blotches.test.ts`, `gift-tube.test.ts`,
  `icon-pixels.test.ts`.
- e2e: `e2e/icon-editor.spec.ts`, `crate-banner.spec.ts`, `profile.spec.ts` (an admin's locker too; rides: the locker's Ride tab, the preview
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
