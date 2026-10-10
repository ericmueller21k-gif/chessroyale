# The shop, crates, the locker and the icon builder

Lane: `item-builder` (crate items and shop cosmetics; its checklist for adding a crate item is in
`.claude/agents/item-builder.md`). The icon builder sits in the profile (`hub`).

## How it works today

- **Nothing here changes how a match is played or scored.** Everything is cosmetic.
- **The shop** (`core/shop.ts`): categories that each fill one slot (God King effects: the colour of his bolts, beam
  and halo; pawn hats, worn in the pre-game votes; chat packs, which aren't equipped: you use every pack you own).
  Every slot has a free starter. Prices in coins; `SHOP_FREE` is on (everything free while testing).
- **Crates** (`core/crates.ts`): every drop rolls three things independently:
  1. **its tier**, which decides the item: the opening strip lands on a tier's present (Common to Epic, colour-coded),
     which opens to one of that tier's items evenly, or on **Fischer Random** (Legendary and Mythic items only);
  2. **its colour** (red and yellow common, Pearl the rarest; some items roll a second colour);
  3. **its purity**: 100% minus a blemish of 0–100% (blotches over that share of its colour); shiny at 90%+.
  Crates are opened on the server, so nobody can make themselves a Pearl crown. `CRATES_FREE` is on while testing.
- **Items** have a slot (head, face, skin, weapon), are drawn on the pawn's 100 × 100 square, and fit by anchors. Your
  pawn wears your equipped items on the vote board, the cut screen and your profile; other players' looks come with
  them into a lobby; bots wear simple seeded outfits (`BOT_LOOKS`).
- **The locker** keeps each item you own (its colour, blemish and seed) and what's equipped in each slot; it can
  delete items.
- **The icon builder** (the profile): a 48 × 48 pixel drawing with a paint bucket and undo (`UNDO_STEPS`), saved as a
  small PNG data URL (at most 16 KB, checked by the server).

## Where the code is

| What | Where |
| --- | --- |
| Item list, tiers, colours, crate odds, rolls | `packages/core/src/crates.ts` |
| Shop cosmetics | `packages/core/src/shop.ts`; drawn by `packages/app/src/components/Cosmetics.tsx` |
| Item drawings, fit, cards (`ItemArt`, `Avatar`) | `packages/app/src/components/Items.tsx` |
| Crate page, opening strip, reveal, locker UI | `packages/app/src/screens/Crates.tsx`; the shop `screens/Shop.tsx` |
| Server rolls and storage (D1 `items`, `equipped_items`) | `packages/server/src/locker.ts`; the shop's API in `api.ts` / `accounts.ts` |
| Bots' outfits | `packages/core/src/bot-looks.ts`, `packages/app/src/looks.ts` |
| The icon builder | `packages/app/src/components/PixelIcon.tsx`, `icon-pixels.ts`; server check `isPixelIcon` in `accounts.ts` |

## Settings

`crates.ts` (`ITEM_DEFS`, `CRATES`, `ITEM_COLORS`, `PURITY_BANDS`, `CRATES_FREE`), `shop.ts` (`SHOP_ITEMS`,
`SHOP_FREE`), `BOT_LOOKS` and `QUICK_CHAT.packPrices` in settings.ts.

## Tests and tools

- Unit: `packages/core/test/crates.test.ts`, `bot-looks.test.ts`, `packages/server/test/accounts.test.ts`,
  `packages/app/test/blotches.test.ts`, `icon-pixels.test.ts`.
- e2e: `e2e/icon-editor.spec.ts`, `crate-banner.spec.ts`, `profile.spec.ts`.
- The fitting sheet: `npm run preview:items -- <scratch>/sheet.png items=<id>[,<id>]` (read the PNG; keep it out of
  the repo).

## Rules for this area (from `.claude/LESSONS.md`)

- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a swatch, emoji or icon in its place.
- When a number describes a drawing (a purity), measure the drawing against the number over many cases, then test it.
- A packed pixel value compared with a typed array's is made unsigned (`>>> 0`) first; a flood fill has a bound it
  can't pass; test a tool many times in a row on its own result.
