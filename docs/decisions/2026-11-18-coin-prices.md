# Coin prices and 1 crate a level (Nov 18, 2026)

Eric, Nov 18: "One crate per level seems fine"; crates 50-75 "as long as it's something we can easily tweak later"; key 100 coins = $1.
Changed (the payments design's table 8, PR 1 of its build): `SHOP.prices` key 250 → 100, HunChess/Gift/Beta 100/150/150 → 50/75/75,
boss 400 → 200, bundle 900 → 400; `XP.levelCrates` 2 → 1. The beta's 50% discount stays until real money turns on.
Call made: the design gave ranges only, so God King effects (moved from `core/shop.ts` into `SHOP.godKing`) map each old price p to
p / 2 + 100 (400 → 300, 500 → 350, 600 → 400), and chat packs (`QUICK_CHAT.packPrices`) are halved (200 → 100, 250 → 125, 300 → 150).
