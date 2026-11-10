# Boss art drawn when first needed, not on every page load (Nov 10)

Found by flaky batch 3 (PR #597's body, "colosseum:42"): every page load spends about 1.4 s on a fast core drawing all the
boss art (`packages/app/src/characters/*.ts`, built when the main bundle loads), before `load`. A phone likely pays more,
on every open, for bosses it won't see. Eric's rule: less lag and simpler code over all else.

## The change
1. **Measure first:** a load on a 4x-slowed phone (Playwright CPU throttle) and on desktop: time to `load` and to home's
   first paint, and a profile naming which modules' top-level work costs what. Write the numbers down.
2. Make each boss's sprite/sheet build on first use (a memoized getter, or the module imported where it's used), so a
   page builds only the bosses it shows. Prefer the least code: reuse one lazy helper for every boss, don't rewrite each.
   The art must come out pixel-identical (compare a few sheets before/after).
3. Watch for first-use hitches: a boss's first appearance (town walk-up, a battle's intro) must not stall a frame
   noticeably; if building one boss takes > ~16 ms, build it during a quiet moment just before (e.g. when its card opens
   or the battle loads), not mid-animation. `npm run frames:boss` on one boss and the town (`.claude/LESSONS.md`).
4. Re-measure; put before/after in the PR body. Also re-run `colosseum.spec.ts:42` 10× (phone, 2 workers): it timed out
   at 5 s after `goto("/town")` on cold CI runners; say whether it now comes in well under.

Lane: targeted (shared app modules; the characters area). Effort high. Tests: the touched areas' specs run in CI; locally,
the boss kit (`packages/chess/test/boss-kit.test.ts` if it covers art), any unit tests for characters, colosseum:42, and
`npx playwright test --grep @perf --project phone` (frame budgets). No sims. One set of stills only if anything looks
different (it shouldn't). Decision note docs/decisions/2026-11-10-lazy-boss-art.md (≤ 120 words); update
docs/areas/ for characters/bosses. Push to claude/lazy-boss-art at each real step; when done write .pr-body.md and push.
Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md (branch claude/director-notes) first.
