# Review 2: PR #1007, the fixes to the first review (full lane: odds)

Read-only delta review of `2f96912d..origin/claude/purity-zero` at `47115708`: one commit, five files, +30/-5. The blocker and
should-fix 2 and 3 are fixed, and so are nits 5 and 6. The new formatter shows every band short, and correct to the digits it
shows. Should-fix 4 is fixed in the wrong number. No blockers. Two should-fix (one of them is only the PR body) and three nits.

## Blockers

None.

## Should-fix

1. **The comment's new 99%+ figure is off.** `packages/core/src/crates.ts:538` now reads "99%+ about 1 in 4,240". 99%+ is
   0.02 + 0.04/11 = 0.0236364%, which is 1 in 4,230.77. I computed it from the head's own `PURITY_BANDS`. It should read "about
   1 in 4,230", as the first review said. First-review finding 4 asked for this comment because its figures get copied into the
   FAQ, so a near-miss here is the same risk. It's a two-digit change.
2. **The PR body is stale for this commit.** Players see these changes, and the body doesn't list them:
   - The chips (`Crates.tsx:815`) are now "Purity 100% ✨: 1 in 5,000" and "Purity 0%: 1 in 5,000". The body still quotes
     "about 1 in 5,000" and shows no ✨.
   - "Purity 99-99.9% ✨: 1 in 27,500" (was `0.0036363636363636364%`).
   - "Purity 90-98.9% ✨: 0.376%" (was `0.37636363636363634%`).
   - The FAQ's 99% to 99.9% row is "1 in 27,500" (was 0.004%).

   The new checks aren't listed either: the formatter's `toEqual` and two per-tenth `toBeCloseTo` in core `crates.test.ts`, and
   the chip pattern in `e2e/shop.spec.ts`. "Checks: none changed" still holds, because both files only gain lines. This is for
   the director, since the director wrote the body.

## Nits

3. **The new e2e check passes if it finds no chips.** `e2e/shop.spec.ts:2082` loops over `allTextContents()`. If the chips'
   class or their "Purity" label ever changes, the loop runs zero times and passes. Fix: assert the count first, for example
   `toHaveLength(PURITY_BANDS.length)`. The spec already imports from `@chessroyale/core`.
4. **The formatter's doc says "exact", but it rounds.** `crates.ts:558-559`:
   - The percent path rounds to 3 decimals. 90-98.9% shows 0.376%, and its real chance is 0.37636…% (about 1 in 265.7). That is
     the same rounding the FAQ already used (`pct(…, 3)`), 0.0004 points off, so I'm not asking for a change to what players see.
   - The "1 in N" path rounds too when 100/p isn't a whole number. A future 0.07% band would read "1 in 1,429" (really
     1,428.57). Today's three "1 in" values are whole numbers, so they are exact.
   - A weight of 0 prints "1 in ∞". No band has a weight of 0.

   Fix: "short; to 3 decimals or the nearest 1 in N" would describe it truly.
5. **First-review nit 5 is mostly done.** Both sentences now use `purityOddsText(PURITY_EXACT)` (`Crates.tsx:803`,
   `faq/content.ts:1222`), so a change to `PURITY_EXACT` now carries through to both, which was the risk. Two loose ends:
   - The FAQ sentence reads the core constant over the default total of 100. The table next to it reads `src.purity` over
     `pTotal`. If the FAQ is ever built from other bands, the two can disagree.
   - `packages/app/test/faq.test.ts` still has no check on the purity rows.

   Both bands are built from the one constant, so the risk is low. Fix (optional): take the sentence's value from the one-value
   band in `src.purity`.

## Checked

- **Each first-review finding:**
  - 1, the blocker: fixed. The chips use `purityOddsText`, and none prints a long float.
  - 2: fixed. The FAQ row reads "1 in 27,500", which is exact.
  - 3: fixed. `b.low >= 90` now applies to the one-value bands too, so exactly 100% gets its ✨ and exactly 0% doesn't. "about"
    is dropped, so the chips match the paragraph and the FAQ.
  - 4: fixed, but with the wrong number (should-fix 1).
  - 5: mostly done (nit 5).
  - 6: fixed. `b99.weight / 10` = 0.004/11 and `0.98 / 49` = 0.02, both inside `toBeCloseTo(…, 12)`. The 0.1-4.9 band holds 49
    tenths and the 99-99.9 band holds 10.
  - 7 was for the director, not a defect, and this commit leaves it as it was.
- **The formatter over every band.** I ran the head's `crates.ts` with Node's type stripping.
  - The weights add to exactly 100 (`=== 100`), so the chips' default total and the FAQ's `pTotal` give the same text.
  - The bands, top to bottom, read: 1 in 5,000 / 1 in 27,500 / 0.376% / 9.6% / 80% / 9% / 0.98% / 1 in 5,000. That is the
    test's `toEqual` list.
  - The true values are 1 in 5,000 / 1 in 27,500.000 / 0.376364% / 9.6 / 80 / 9 / 0.98 / 1 in 5,000.
  - Edge inputs give: 0.1 → "0.1%", 0.0999 → "1 in 1,001", 0.12345 → "0.123%", 0 → "1 in ∞" (nit 4).
- **The text players see, built from the head's template and bands:**
  - Chips: "Purity 100% ✨: 1 in 5,000", "Purity 99-99.9% ✨: 1 in 27,500", "Purity 90-98.9% ✨: 0.376%", "Purity 70-89.9%: 9.6%",
    "Purity 30-69.9%: 80%", "Purity 5-29.9%: 9%", "Purity 0.1-4.9%: 0.98%", "Purity 0%: 1 in 5,000". All 8 match the e2e pattern;
    a long float or "∞" would fail it.
  - The chip's text is a single template expression, so its `textContent` has no stray spaces before the `$` anchor.
  - FAQ rows: "exactly 100% | 1 in 5,000" … "exactly 0% | 1 in 5,000". Both sentences read "each 1 in 5,000".
- **Grep: does anything else print a band's raw weight?** No.
  - The only other place that prints a weight is the color chips (`Crates.tsx:808`, `{c.name} {c.weight}%`). Those weights are
    typed numbers (30, 30, 14, 9, 7, 4.5, 3, 2, 0.5), not purity bands.
  - The server and admin pages print no purity odds. `docs/areas/shop.md` lists none either.
  - `docs/history/shop-and-crates.md:85-92` still shows the old "99-100% 0.004% (1 in 25,000)". It's the word-for-word history,
    not a current page, so it stays.
  - The decision note is unchanged and still right.
  - Not a finding: shiny reads "about 1 in 250" on the crate page and in the FAQ, though it's exactly 1 in 250. This PR didn't
    add that wording, and the two places agree.
- **Exports and types.** `purityOddsText` reaches the app through core's `export * from "./crates.ts"`. `PURITY_EXACT` was
  already exported, and both app files import both names.
- **The roll is untouched.** This commit changes only the comment in `PURITY_BANDS`'s block and adds a new function. So the
  first review's checks of the roll and the server paths still stand.
- **Guards.** `docs/rules/eric.md` has no rule on crates, purity or odds. Its only `shop.spec.ts` guard is the "up is up" test,
  which this PR doesn't touch. Both test files only gain lines.
- **CI at `47115708`:** `check` (typecheck, unit, chess 1 and 2) is green. The full e2e (15 shards) was still running when I
  wrote this.

## Not reached

- I didn't run vitest locally: this container has no `node_modules`. I ran the formatter and the per-tenth arithmetic straight
  from the head's `crates.ts`, and CI's `unit` job passed.
- I didn't build the FAQ page: it needs the chess package's dependencies. Its rows come from the same formatter with the same
  total.
- I made no browser still, and I didn't wait for the full e2e result.
