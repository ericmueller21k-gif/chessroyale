# Delta review: PR #998's fix commit `4e546b4` (FULL lane)

One blocker, one should-fix, two nits. The first review's findings 1 and 3 are fixed; finding 2 is fixed in behavior but breaks another spec.

1. **blocker** `e2e/crate-banner.spec.ts:17,55,68,129`: these expect exactly 2 `.series-crate-row`s with "Show unowned" off (its default, `packages/app/src/boss-crate-rows.ts:20`). The unowned Mythic Crate's row (`packages/app/src/screens/Crates.tsx:278`) now makes 3, so those 3 tests fail in this PR's e2e run (crate-banner is a shop-area spec) and on main. Expect 3, or scope the count to beta-001 and winter-1, and list the changed checks in the PR body.
2. **should-fix** (nothing shifts) `Crates.tsx:278`: the row sits after `moreBoss`, so ticking "Show unowned" pushes it down by every unowned boss crate's row. Put it right after the series crates (`:271`), which is what its comment says ("as the series crates"); then only what's below the boss rows moves, as before.
3. **nit** `Crates.tsx:645`: "it comes with the shop's bundles" is present tense, but nothing sells a bundle and nothing rolls `SHOP.bundleMythicChance`. "it will come with the shop's bundles" matches the note (`docs/decisions/2026-11-27-banana-suit-prize.md:8`).
4. **nit** `e2e/shop.spec.ts:1424-1428`: the comment and the title say "with a padlock", but only `none` is checked. Add `row.locator(".crate-lock")` visible.

**Checked and correct.** Finding 1: the page no longer names a bundle as a way to get one, and the e2e reads the new line. Finding 3: the label uses the same all-Transcendent test as the paragraph above it (`:655`), so only the Mythic Crate's row reads "Legendary or Mythic"; beta and winter still read "A second spin". Finding 2: listed at none whether the box is ticked or not, greyed (`none`) and padlocked (`locked`, since `!n`), and the e2e checks it both ways. Once held, it's under Ready to open only (`heldSeries`), so each crate is still in one place. Nothing else changed: the diff is 3 files. Core, the server, the odds, the roll, `moreBoss` (the boss crates' "Show unowned" behavior) and the no-boss-crates line are untouched, and `docs/areas/shop.md` matches the code.

**Not reached:** I ran no tests (no `node_modules` here) and didn't read CI for `4e546b4`.
