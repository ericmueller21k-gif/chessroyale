# The shop, crates, the locker and the icon builder

Lane: `item-builder` (crate items and shop cosmetics; its checklist for adding a crate item is in
`.claude/agents/item-builder.md`). The icon builder sits in the profile (`hub`).

## How it works today

- **Nothing here changes how a match is played or scored.** Everything is cosmetic.
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
- **Items** have a slot (head, face, skin, weapon), are drawn on the pawn's 100 × 100 square, and fit by anchors
  (head, face, eyes, neck, mouth: each piece's own lines; a mustache sits at the mouth, under a snowman's carrot).
  Weapons don't move with the piece: they're drawn where every piece's side (or shoulder) is. Your
  pawn wears your equipped items on the vote board, the cut screen and your profile; other players' looks come with
  them into a lobby; bots wear simple seeded outfits (`BOT_LOOKS`).
- **The locker** keeps each item you own (its color, blemish and seed) and what's equipped in each slot; it can
  delete items. God King effects from the shop are worn there too.
- **The icon builder** (the profile): a 48 × 48 pixel drawing with a paint bucket and undo (`UNDO_STEPS`), saved as a
  small PNG data URL (at most 16 KB, checked by the server).

## Where the code is

| What | Where |
| --- | --- |
| Item list, tiers, colors, crate odds, rolls | `packages/core/src/crates.ts` |
| Shop cosmetics | `packages/core/src/shop.ts`; drawn by `packages/app/src/components/Cosmetics.tsx` |
| Item drawings, fit, cards (`ItemArt`, `Avatar`); crate and box art (`WinterCrateArt`, `PresentArt`, `BetaCrateArt`, `SupplyBoxArt`) | `packages/app/src/components/Items.tsx` |
| Crate page, opening strip, reveal, locker UI (`CRATE_LOOKS`: each crate's art and box) | `packages/app/src/screens/Crates.tsx`; the shop `screens/Shop.tsx` |
| Server rolls and storage (D1 `items`, `equipped_items`) | `packages/server/src/locker.ts`; the shop's API in `api.ts` / `accounts.ts` |
| Bots' outfits | `packages/core/src/bot-looks.ts`, `packages/app/src/looks.ts` |
| The icon builder | `packages/app/src/components/PixelIcon.tsx`, `icon-pixels.ts`; server check `isPixelIcon` in `accounts.ts` |

## Settings

`crates.ts` (`ITEM_DEFS`, `CRATES`, `ITEM_COLORS`, `PURITY_BANDS`, `CRATES_FREE`), `shop.ts` (`SHOP_ITEMS`,
`SHOP_FREE`), `BOT_LOOKS` and `QUICK_CHAT.packPrices` in settings.ts.

## Tests and tools

- Unit: `packages/core/test/crates.test.ts`, `bot-looks.test.ts`, `packages/server/test/accounts.test.ts`,
  `shop-buy.test.ts` (buying with coins, `SHOP_FREE` off), `packages/app/test/blotches.test.ts`, `gift-tube.test.ts`,
  `icon-pixels.test.ts`.
- e2e: `e2e/icon-editor.spec.ts`, `crate-banner.spec.ts`, `profile.spec.ts`.
- The Fischer Random banner (`.fischer-stage` in styles.css): its band slants but the words stay level, so its padding
  must clear the words' ends (about 0.06 of their width); `crate-banner.spec.ts` measures that every frame.
- The fitting sheet: `npm run preview:items -- <scratch>/sheet.png items=<id>[,<id>]` (read the PNG; keep it out of
  the repo). `sheet=1` gives a short sheet to show a batch (cards, both pawns, `colors=`, `outfits=a+b;c`). `scale=1` or `scale=2`
  renders at that display scale, to look for stray pixels.

## Rules for this area (from `.claude/LESSONS.md`)

- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a swatch, emoji or icon in its place.
- When a number describes a drawing (a purity), measure the drawing against the number over many cases, then test it.
- A packed pixel value compared with a typed array's is made unsigned (`>>> 0`) first; a flood fill has a bound it
  can't pass; test a tool many times in a row on its own result.
