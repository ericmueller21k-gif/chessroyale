# #676 (the street town for everyone): make its town e2e taps reliable on CI, plus the review's deferred minors

Effort high, full lane (the PR keeps `full-e2e`). Branch `claude/street-for-everyone` (`git pull` first). Read CLAUDE.md, `.claude/LESSONS.md`.
## The failures (CI only; each passes locally)
Since players moved onto the street town, tests that tap a far figure or home after a camera glide fail on CI's software WebGL under a
full shard, each on its first try and often its retry:
- `e2e/boss-challenge.spec.ts:155` (Alfil: `alfilAt` null, "drawn", card never opens in 20 s), run 43470292666 shard 4;
- `e2e/town-leave.spec.ts:202` (Sawyer's card), flaky in run 43466523939;
- `e2e/shop.spec.ts:251` and `:521` (Puddles, Hollow: "comes into view"; the director gave the glide wait 15 s, which passed once).
- run 43470292666 shard 14 too: `e2e/town.spec.ts:510` (Folio's house), `:1362` (rides), `:1590` (Folio's door: "drawn" null for 30 s),
  `:1239` [desktop] (a test player "is drawn" null). Read the whole run's failures first (`result` job), not just these.
Find the cause, don't just lengthen waits: e.g. `glideTo` re-fired on every retry keeps the camera moving; `__townAt` returns null while
a figure is covered by a house from the chase camera; the park's zoom step changes the frame mid-tap; the camera never "rests" on slow
frames. Fix the shared approach once (one helper in `e2e/helpers.ts` if several specs need it), so taps on a figure or home are reliable
in the street town. If the game itself has a real problem (a boss covered so a player can't tap him), fix the game and say so.
## Also (the review's deferred minors, `review/street-for-everyone`)
m1 the guest's 30 s clock starts when the town is drawn; m2 a loose perf bound on a player's `loaded` (about 8 s on the slowed phone);
m3 "Back to me" check moved (glide away, tap, focus within ~2 squares of you); m4 delete the dead 2D branch in `Town.tsx` (~2391) and
`render.ts` `softenBand` for 2d; m5 leave as is.
## Tests
Run each touched spec 3 times locally on both projects (`--repeat-each 3`), with CPU throttling 4x if it helps reproduce. Typecheck,
app unit tests you touch. Append a short "CI round" section to the PR body (start from the director's copy:
`notes/briefs/street-for-everyone-pr-body.md`). Push work in progress at each step; `.pr-body.md`, then `.done`, and stop. No PRs, no
waiting on CI. No model names in commits. Never stop silently.
