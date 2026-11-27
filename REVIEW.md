# Review: PR #998, the Mythic Crate opens on the server (FULL lane; head `05352ee`)

No blockers. Two should-fix, three nits.

1. **should-fix** `packages/app/src/screens/Crates.tsx:644`: with none held, the page says "The shop's Crate + Key Bundle has a chance at
   one." Nothing can buy the bundle yet, and no code rolls `SHOP.bundleMythicChance`, so the only way it names doesn't exist (honest
   odds first). Say that none can be earned yet, or that it comes with purchases.
2. **should-fix** (Eric's rule) `Crates.tsx:277`: an unowned Mythic Crate shows only with "Show unowned". Unowned series crates always
   show, greyed with a padlock (`:271`). Eric's Nov 24 exception to "nothing hidden" names only the boss crates (`docs/areas/shop.md:205`),
   and the decision note doesn't record this call. Either show it with the series crates, or get Eric's OK and note it. Also, the line
   shown with the box unchecked still mentions only boss crates.
3. **nit** `Crates.tsx:668`: its one odds row still says "A second spin", but this crate makes no first pick.
4. **nit** `packages/core/src/crates.ts:383-386`: a `bananaSuit` above the Mythic share is quietly capped. If the suit is its tier's
   only item, it gets the tier's whole share. The roll and the shown odds still agree (both read `fischerOdds`); only the setting's
   number is off. Fine at 2 of 20.
5. **nit** `packages/server/test/mythic-crate.test.ts:22`: "refused and nothing changes" checks only the message. There's no case for a
   crate held with no key, or for a retry of the same request. Both use the shared `openCrate` path, which the locker tests cover.

**Checked and correct.** (1) The roll and the shown odds and FAQ all read `fischerOdds`. Run under node: Legendary 4 × 20%, Mythic
3 × 6%, the suit 2%, total 100. The pool is beta-001's and winter-1's items only (8; no boss crate items or HunChess rides), as the
note says. The roll is the server's (`openingRng`, a crypto seed), as for other series crates; `force` only applies with TEST_SWITCHES.
(2) Other crates: with no prize, the expression is the one used before. The bonus pool is still `CRATES` + `BOSS_CRATES` (a forced
"mythic" falls back to a pool roll). Daily, level and quest rewards give `XP.rewardCrate`. The only new grant is `grantTestItems`,
behind the admin check (`api.ts:737`), and no other `crateDef` caller grants. (3) The same op: it needs the crate and a key and is
keyed by request id, so a retry or race opens one. The kill switch covers the open. Refund holds only stop buying, as for every crate.
Guests and the guest merge work as for other crates. (4) A duplicate is stacked as a new item. (5) The odds shown are 100% and 2.0%,
the row is greyed with a padlock at none, and nothing shifts beyond what the boss crates' rows already do.

**Not reached:** I ran no tests (no `node_modules` here), and CI `check` and e2e were still running at 02:20 UTC. I didn't watch the
opening animation frame by frame or read the payments page in depth.
