# Review: PR #1007, exactly 100% and exactly 0% purity at 1 in 5,000 each (full lane: odds)

Independent, read-only review of `origin/main...origin/claude/purity-zero` at `2f96912d`. The roll is right: the bands, the
odds and the server paths all check out. The text players see does not all read plainly. One blocker, three should-fix, three nits.

## Blockers

1. **The crate page's shiny chips show raw floating-point numbers.** `packages/app/src/screens/Crates.tsx:813` prints
   `${b.weight}%` for every band with more than one value, and two of the new weights are computed. What the panel shows (the
   same template run against the head's bands):
   - `Purity 99-99.9% ✨: 0.0036363636363636364%`
   - `Purity 90-98.9% ✨: 0.37636363636363634%`

   Before this PR those chips read `0.004%` and `0.396%`. The PR body quotes only the two one-value chips. Fix: round the shown
   percent. The tiny band reads best as "1 in 27,500", which is exact (100 / (0.04/11) = 27,500). Add one check to the existing
   crate-page test in `e2e/shop.spec.ts:2065` (it already opens "Colors and purity"): every chip's text matches a short pattern,
   such as `/: (about )?1 in [\d,]+$|: \d+(\.\d{1,3})?%$/`.

## Should-fix

2. **The FAQ overstates 99% to 99.9% by about 10%.** `packages/app/src/faq/content.ts:1185` shows that band through
   `pct(…, 3)` as **0.004%**. Its real chance is 0.00364% (exactly 1 in 27,500). Before the PR, the old 99-100 band really was
   0.004%. The bonus crate's note (`docs/decisions/2026-11-24-bonus-crate.md:23`) says "an odds disclosure must be exact". Fix:
   show bands under 0.01% as "1 in N", as the PR already does for the one-value bands, or use 4 decimals ("0.0036%"). Use the
   same rule as the fix for the chip in 1.
3. **The 100% chip loses its ✨.** In `Crates.tsx:813` the branch for one-value bands skips the `b.low >= 90 ? " ✨"` that every
   other 90%+ chip gets, so the panel reads as though exactly 100% isn't shiny. It is shiny (`isShiny(0)`). The chip also says
   "about 1 in 5,000", but the odds are exactly 1 in 5,000, which is what the FAQ and the paragraph above say. Drop "about" or
   keep it everywhere.
4. **A stale odds comment.** `packages/core/src/crates.ts:538` still says "99%+ 1 in 25,000". 99%+ is now 0.02 + 0.04/11 =
   0.0236%, about 1 in 4,230. The FAQ's numbers come from this block, so a stale figure here is likely to be copied.

## Nits

5. "1 in 5,000" is typed into the FAQ text (`content.ts:1219`) and the crate paragraph (`Crates.tsx:801`). Every other number
   in that FAQ section, including the table next to it, comes from `src.purity`, so a later change to `PURITY_EXACT` would leave
   these two sentences wrong. Derive them from the one-value bands. `packages/app/test/faq.test.ts` ("the crates' odds") has no
   check for the new rows; one line with a moved `PURITY_EXACT` would prove they follow it.
6. The new test (`packages/core/test/crates.test.ts:302-312`) doesn't pin the PR's two "unchanged" claims: each tenth of
   99.0-99.9 is 0.004/11 %, and each tenth of 0.1-4.9 is 0.02%. A changed formula there would still pass. That's one
   `toBeCloseTo` each.
7. For the director, not a defect: **rarity no longer rises all the way to 100%.**
   - Exactly 100% (1 in 5,000) is 55 times as likely as any single value from 99.0% to 99.9% (1 in 275,000 each).
   - It is about 4.7 times as likely as any single value from 90% to 98.9% (about 1 in 23,650 each).
   - The whole 99-99.9 band (1 in 27,500) is rarer than exactly 100%.

   That is what the brief asked for (99.x unchanged per tenth). Eric's "that should probably be the max anyway" could mean that
   1 in 5,000 should be the rarest a purity gets. If he asks why 99.9% is rarer than 100%, this is the reason.

## Checked

- **`PURITY_BANDS`.** I ran the roll over 20 million evenly spaced draws covering its whole range.
  - The weights add to exactly 100, with no floating-point error.
  - The 8 bands run 100 | 99.9-99 | 98.9-90 | 89.9-70 | 69.9-30 | 29.9-5 | 4.9-0.1 | 0 with no gap or overlap: exactly 1,001
    distinct values come out, all tenths within 0-100.
  - Shiny (90%+) is 0.4% (1 in 250). Under 5% is 1%.
  - Exactly 100% and exactly 0% are each 0.02% (1 in 5,000).
  - Each tenth from 99.0 to 99.9 is 0.004/11 % (unchanged, 1 in 275,000). Each tenth from 0.1 to 4.9 is 0.02% (unchanged).
  - Each tenth from 90 to 98.9 drops from 0.00445% to 0.00423%; that band pays for exactly 100%'s new share. 70-89.9, 30-69.9
    and 5-29.9 are unchanged.
- **`rollBlemish`** (code unchanged).
  - A one-value band has `steps = 1`, so it rolls that value. Draw 0 gives blemish 0, and the last draw gives 100.
  - At a band edge, `r === weight` moves on to the next band, whose top value then comes out, so there is no off-by-one.
  - `Math.round(low*10)` is right for 0.1, 4.9, 98.9 and 99.9.
  - Floating-point drift past the end lands in the last band and is clamped to 0%.
- **Server.** Every random purity goes through `rollCrate` → `rollBlemish`:
  - `locker.ts:215`: series crate openings, and bonus crates, which open through the same path.
  - `boss-tokens.ts:331`: boss crates.
  - `residents.ts:193`: the town's residents.
  - The Welcome Crate (`rollWelcome`) is fixed at `HUNCHESS_FINISH` with blemish 0 and shows no purity, so it is unaffected.
  - The `force.shiny` test switch (only where `TEST_SWITCHES` is "1") is unchanged.
  - The strip's decoys (`Crates.tsx:925`) use `rollBlemish`.
- **Nothing relies on the old band count or order.** The only users are the crate page's chips (`map`; `key={b.low}` stays
  unique), the FAQ (`map`; shiny found by `low >= 90`) and `crates.test.ts` (first band's high is 100, last band's low is 0,
  contiguous). The sim doesn't use purity, and no code is keyed to blemish 0 or 100 or to purity ≥ 99.
- **The FAQ as players see it** (rendered with `FAQ_DEFAULTS`): exactly 100% 1 in 5,000 / 99% to 99.9% 0.004% / 90% to 98.9%
  0.376% / 70% to 89.9% 9.6% / 30% to 69.9% 80% / 5% to 29.9% 9% / 0.1% to 4.9% 0.98% / exactly 0% 1 in 5,000. The text matches
  ("each 1 in 5,000"), and "Shiny comes about 1 time in 250" still holds. Only the 99-99.9 row is off (finding 2).
- **Tests.** I ran the purity tests with main's `crates.ts` swapped in: the new checks fail (`TypeError: Cannot read properties
  of undefined (reading 'weight')`, because there's no 100-100 band). At the head they pass (4 of 4). The diff only adds lines
  to `crates.test.ts`, so no existing check changed and the PR's "Checks: none changed" holds. `docs/rules/eric.md` has no rule
  on crates, purity or odds, so no guard test is touched.
- **CI at `2f96912d`.** `check` is green, and the full e2e (label `full-e2e`, 15 shards, `result`) is green.
- **Docs.** The decision note is 6 lines and 116 words, within its limits. `docs/areas/shop.md` lists no purity odds, so
  nothing on it is stale.

## Not reached

- I didn't open the crate page in a browser and made no still. The chip text in 1 comes from the head's own template
  expression, run against the head's bands. Chips wrap (`.color-odds` uses `flex-wrap`), so the long ones shouldn't overflow a
  phone, but I didn't confirm that by eye.
- I didn't look at how D1 stores a blemish. That code is unchanged, and the values are still tenths within 0-100.
