# Fix round 2: PR #611 (the boss and lone devices)

The delta review is `delta.md` on branch `review/fable-b3` (`git show origin/review/fable-b3:delta.md`), proof tests in `proof/`
there (`delta-review-fable-b3*.test.ts`). The first review is `review.md` beside it. Work on claude/fable-b3 (PR #611; pull first).
Copy the delta's proof tests into packages/server/test/ and turn each into a test the fix passes.

## Do (the director's calls)
- **D1 (blocker):** the review's fixes 1-3, least code:
  1. Take `by` only where Maia could have played (`c.maia`: the request carried a Maia brain, kind `elo`/`stumble`), never on a
     share move: the server draws the share itself (its own rng, as the seed) and sends `share: true` (no brain) to both.
  2. Maia against a fallback: play the Maia move only if it's within a Maia-sized gap of the fallback's (a setting, about 0.25: four
     honest Maia moves in five), else the better one; no strike either way. Keep `throwLoss` for strikes only.
  3. No verdict (`bossDefault`): the host's move, as before the fix round, unvouched.
  Skip 4. The PR body must not claim a liar's move never plays: say exactly what a liar can still gain (at most the cap, only on
  moves where the honest device really fell back).
- **D2:** least code: the checker gets the whole request on turns that have extras (the host's request asked for any); bare otherwise.
- **D3:** a host change with no answer in restarts the window from now; no miss for a device asked less than `waitMs` ago.
- **D4:** Squads' late dispute with no server asks a referee device, as the in-time path does (`pickDevices(lm, 1, …)`).
- **D5:** calibrate `eloDraw`: measure about 200 positions at 1600, 2200, 2500 and 2800 against UCI_LimitStrength (both guarded),
  then scale T per Elo (a short table in settings) until the seeded mean loss is within about 10% of UCI's. Numbers in the PR body.
  Keep it to one measuring run (the helper testing budget).
- **D6:** leave the brain out of a bare request when `!c.maia`, and don't load Maia in `hostBoss` for a check unless saved/allowed.
- **D7:** prefetch Maia on the drawn loaders (computers only) as the raid's lobby fills, so a checker is ready by move 1; if that's
  more than a few lines, leave it and say so in the PR body.

Lane: full plus the boss kit; effort xhigh. Run locally only the tests you write or change, the server and chess unit suites, the
boss kit and `e2e/boss-smoke.spec.ts` on phone; `npm run typecheck` before your last push. Update the decision note, area pages and
the FAQ if wording changes. When completely done: write `.pr-body.md` (the full body), `.review-fixes.md` (each D finding: what you
did, or why not) and a one-line `.done`, and push them together as your LAST push. Don't push after `.done`. Don't open a PR. Read
CLAUDE.md and notes/briefs/rules-common.md first.
