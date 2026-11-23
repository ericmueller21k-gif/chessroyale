# #905 fix round: Birdie's ride + crate (Nov 23). Opus xhigh, full lane

PR #905, branch `claude/birdie-ride-crate`. Its independent review: `git show origin/review/birdie-ride-crate:REVIEW.md` (read it all).
Start: `git fetch origin claude/birdie-ride-crate main && git checkout -B claude/birdie-ride-crate origin/claude/birdie-ride-crate`
(this IS the PR's branch; push to it, never force). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/shop.md`.

Do:
1. **I1, option (a), the director's call:** the Welcome Crate leaves out every admins-first boss's ride, in one place (`core/welcome.ts`
   `WELCOME_CRATE.items`, filtered by the colorway's boss through `BOSS_CRATES` and `adminFirst`; check the import cycle). Timber's and
   Dash's colorways leave too (15 rides, 6.67% each now); each comes back by itself when its boss leaves `BOSS_ADMIN_FIRST`. Holders keep
   theirs; an opened crate answers its stored ride. The HunChess colorway items themselves stay defined (admins own one of every item).
   Update `e2e/welcome-crate.spec.ts:113` and `server/test/welcome.test.ts:246` to count `WELCOME_CRATE.items`; add one core check: no
   Welcome Crate ride belongs to an admin-first boss. Decision note of its own (`2026-11-23-welcome-crate-admin-first.md`: Eric's rule
   "met only by an admin until Eric says go", the review's finding, the numbers 17 → 15, 5.88% → 6.67%) and fix the PR's decision note's
   "as Timber's and Dash's" line; `shop.md` updated.
2. **CI red:** `e2e/profile.spec.ts:447` expects 34 rides; with Birdie's Train and its colorway an admin owns 36. Fix the expected count
   and its comment (18 rides and each one's HunChess colorway). Check nothing else counts rides that way (`git grep "toBe(34)"` etc.).
3. **N1:** keep the train loop's making off a moving frame (the review's small fix: warm it once the audio is made, or make the samples
   without a context). **N2:** one focused check in the existing town ride-sound e2e (wear `birdie-train`, a step, poll
   `__townRide().you.sound` for it live and decoded). **N3:** the bought pop-up's picture gets the same box check as the card's.
   N4 (the card's fallback crate picture) and N5: no change; the director shows Eric the still.
4. Prove: typecheck; core/server/app unit tests you touched; e2e `welcome-crate`, `profile` (the rides test), `shop` (Birdie), the town
   ride-sound test, phone (and computer for profile/shop). Append a "Review fixes" section to the PR body file `.pr-body.md` (what changed
   per finding, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
