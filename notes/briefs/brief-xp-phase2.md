# Build brief: XP phase 2 — the daily reward, level-up rewards, crates need keys (Eric, Nov 9: "go with phase two")

Design (approved): notes/briefs/design-xp-quests.md (v2): sections 2 (daily reward) and 4 (level-up rewards and the crate economy).
Lane: FULL (wallets, odds, stored data): the full-e2e label, an independent review, effort xhigh.

## Build
1. **The daily reward:** your first counted game of the XP day (08:00 UTC, as phase 1) with at least `XP.dailyMinMoves` (15) of
   your own moves: +200 XP (`XP.dailyBonus`) and 1 series crate (the newest series: Winter). Once a day, server-decided, the ledger.
   Shown in the result's XP box as a part ("Daily reward +200") and the crate as a line/toast ("+1 Winter Crate").
2. **Level-up rewards:** each level reached: 2 series crates + 1 key (`XP.levelCrates`, `XP.levelKeys`); every 10th level also a
   boss crate the player PICKS among the live bosses (a pick that waits in the inventory until chosen: "Choose your boss crate").
   Granted once per level (op `level:<n>:<ledger id>`), including several levels at once. Shown on the level-up pop and in the
   locker.
3. **Crates need keys:** `CRATES_FREE` off for EVERYONE (Eric: "get rid of all that. Make it actually ready to go"): a series crate
   takes 1 key to open (boss crates keep their prices). Remove "Crates are unlimited while we test." and every "free during beta /
   while we test" line (Crates.tsx, FAQ, the shop, account.ts comments). Admins get NO free opening (Eric: "I don't need admin
   special ability anymore to open up, or like the Fisher random testing on items"): remove the admins' free opening and the admins'
   ?fischer / ?shiny forced rolls (keep them only where TEST_SWITCHES is "1", the e2e servers).
4. **Eric's keys:** raise the admin test grant so an admin can grant themselves 100 keys at once (BOSS_TOKENS.grantMax, or a keys-
   specific max), through the ledger as today. Never put Eric's email or id in the repo (it's public). Tell the director how Eric
   does it (the admin page's button).
5. **`PAUSE_REWARDS` kill switch** (ops.md "Kill switches"): pauses XP grants, the daily reward, level-up rewards (they're owed,
   not lost? decide and record) without breaking games; the result box says "Rewards are paused for a moment."
6. **Admin inventory (doc only, no removal beyond 3):** docs/decisions/2026-11-09-admin-abilities.md listing EVERY admin-only
   ability in the app and server (file:line, what it does, safe to remove?) so "clean up the admin stuff" later is one quick job.
7. FAQ: the daily reward, level-up rewards, keys open crates; no "free while testing".

Tests (full lane): unit + server tests (once per day/level, several levels at once, the boss crate pick, keys spent once, the
pause), e2e for the daily reward line, a level-up with its crates/key, opening a crate with a key and refused without one, the
boss-crate pick; account merge/delete/download include the new rows. Stills: the level-up pop with rewards, the boss-crate pick,
the crates page with keys (phone + computer).
