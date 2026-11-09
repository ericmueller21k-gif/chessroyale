# XP phase 2: crates need keys, and crates have a series (Nov 9, 2026)

Eric (Nov 9): "get rid of all that. Make it actually ready to go"; "I don't need admin special ability anymore to open up, or like the
Fisher random testing on items". Full lane: stored data, wallets.

- **`CRATES_FREE` is gone.** A series crate (Beta, Winter) opens for everyone, admins too, only with one of that crate held and one
  crate key: one ledger op (the item in, the crate and the key out), its guard checking both in the same transaction. Two opens at once
  with one key open one. Refused: "You need a Winter Crate and a crate key to open it." Boss crates keep their prices.
- **Crates are held by series** (a new table `series_crates (user_id, crate, n)`, ledger asset kind `series_crate`, as boss tokens are
  held by boss), because the design names which series drops (the newest, `XP.rewardCrate`) and keeps older ones openable. Considered:
  one count for all series, opened as any series (no new table); it loses "a new series comes out with a push", so not taken.
- **Old crates** (the wallet's `crates`: Squads' placements since Oct 10, never spendable) become Winter Crates as the locker is read
  (`seriesFromWallet`: one op guarded by the count, so two reads move them once). Squads' placements now give Winter Crates.
- **The test switches `?fischer=1` and `?shiny=1`** force a roll only where `TEST_SWITCHES` is "1" (local, e2e, staging), never an
  admin's on production; the crate page's "Testing:" boxes likewise.
- **On screen:** every series crate shows "You have N" and a padlock while it can't be opened (none, or no key), greyed at none;
  its Open is greyed without both, and its page says why. Every "free while we test" line is gone (Crates, the shop, the FAQ). The coin
  shop's own `SHOP_FREE` stays as it is (God King effects, not crates; not in this brief): its buttons still say "Get · Free".
