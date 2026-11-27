# Nov 27, 2026: PRs sample boss-kit-side's pairs; main plays every pair

Eric, Nov 26: "anytime we can ever do cleanup or find better ways of doing these things... it needs to just be very efficient."
The pipeline audit (N2) found `boss-kit-side.test.ts` (about 280 s, 182 s of it the 166 pairs) setting `check`'s chess half 1.

The call: on `pull_request` events `check.yml` sets `KIT_PAIR_SHARE=4` and `KIT_PAIR_ROTATE` (the PR number); a PR plays the pairs at
places `number mod 4` of `kitPairs()` (the rest show as skipped), so any four PRs in a row play every pair. Main (env unset) plays
every pair, as before; known breaks (`PAIR_BREAKS`), audit 1's seeds and the threes always play. Measured locally: 263 s → 92 s.
