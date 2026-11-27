# Review: PR #997 (`claude/crate-riders`, head 4a65abf), full lane, read-only

**Blocker**
1. `e2e/profile.spec.ts:448`: `expect(rides).toBe(36)` ("rides for an admin", @phone-only, runs in the full suite). The ride count is now 23 rides + 18 colorways = 41, so this fails on the PR's full run and on main. The comment on 446 needs the same fix. List the changed check in the PR body (old 36 → new 41).

**Should-fix (the director's or Eric's call, not a code bug)**
2. Players almost never get these rides. Every crate a player earns is a Winter Crate (`XP.rewardCrate: "winter-1"`, `settings.ts:4856`: level-ups, the daily reward, quests and Squads). Nothing gives a Beta Crate except the bonus crate (25% × 1 of 13 crates). A Beta open gives a crate rider 0.286% of the time. Together that's about **1 in 18,200 crate openings** (computed from `bonusPool`, `CRATE_BONUS` and `itemChance`). The ROADMAP's aim ("to make them worth buying", in HunChess/Gift/Beta) isn't met, and the decision note doesn't mention it. Options: put them in Winter as well (breaks "one item, one crate", which the crates test enforces), or decide which crate gets earned. Eric should decide this before they're called crate exclusives.
3. The odds of items players already own change: Tommy Gun and Parrot go from 0.2% to 0.057% (3.5× rarer). The decision note records this, but it's an odds change to existing items, so Eric should hear about it in the PR body, not only in the note.

**Nits**
4. Stale "every ride" text: `crates.ts:234` ("A new ride gets its colorway here with no change"), `welcome.ts:14` ("one of every ride's HunChess colorway") and `docs/areas/shop.md:252` ("made from every ride"). Each should now say "but the crate riders (`CRATE_RIDES`)".
5. The Beta Crate's blurb (`crates.ts:289`, "Secret agents, pirates, ninjas, classic hats and a smile") doesn't mention its five rides, which are now its headline prize.
6. `robot-vacuum.tsx`: in the back view (`endView(false)`) nothing is drawn below the shell's bottom (y 92). Its lowest row measures 93.9, against `foot: 96` (`feel.ts:545`; side 97.3, front 97). Walking up the screen, the vacuum floats about 2 units over its shadow. Fix: brushes or a base line in the back view, or accept it.
7. Displayed odds: `Crates.tsx:84` shows each Mythic item as "0.06%" (true 0.0571%), so seven items read 0.42% against the tier's 0.4%. Rounding only: the shown and rolled numbers come from the same `itemChance`/`fischerOdds`.

**Checked, fine**
- Every crate's strip and Fischer weights are untouched. `fischerOdds` sums to 100, `itemChance` to 1. Beta Mythic is 20/7 per item.
- Winter, the Welcome Crate (`HUNCHESS_RIDES` still 18, Welcome odds unchanged), the boss crates (`BOSS_CRATE_POOL` drops Mythic) and the bonus pool are unchanged.
- Admin copies get the rides, with `color2` for the carpet and the rocket.
- I re-ran `scripts/measure-rides.ts`: `ride-cells.ts` came out byte-identical, all 5 rides × 3 views.
- The drawings use no filters, gradients or randomness. Frame counts (4–8 idle, 8 move) are at or below existing rides'. They're lazy chunks only; the main bundle gains only cells, feel and item data.
- `preview:items` sheet: all five draw whole, the two-color ones in both colors; the locker uses the same `ItemArt`.
- `vitest` (core, server, app): 5,112 passed. `npm run typecheck`: clean.
- The PR's test edits check what they claim (one crate, Beta only, no colorway, 20/7 each).

**Not reached:** the town by real taps (`npm run frames:boss`), the @perf frame budgets, any e2e run locally (CI's full run was still queued), and stills of each view in the town.
