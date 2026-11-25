# Fix main: two retry-passes after #942 (Nov 25). Opus high, targeted. Branch `claude/fix-flakes-3` from origin/main

Main fdf8787f (#942 merged: stale.ts reloads only for a deploy or a SECOND failure on the same build; Boss Battle a "place" via
setPlace/takePlace("raid")/dropPlace in App.tsx) went FLAKY_RED, run 45584074647. Both passed only on their retry. Fix each at its cause
(CLAUDE.md: "Fix the cause, not add a checker"; a flake is fixed at its cause, never hidden; no guard in docs/rules/eric.md edited).

1. **[phone] e2e/xp.spec.ts:381** "a solo battle left mid-game: the reload's card…" (shard 13). After `playOwnMoves(minMoves - 1)` and
   `page.reload()`, `getByTestId('game-in-progress')` never appeared in 30 s. FIRST decide whether #942 caused it (it's new right after
   #942; it touches reloads and kept places): e.g. a kept "raid" place or the second-failure reload landing somewhere the card isn't shown,
   or the card waiting on something the reload changed. A player who reloads mid-battle must always see that card: if this is a real bug,
   it's the priority. Reproduce (repeat the test, try CI's Chromium 141 as #942's helper did), find the cause, fix it.
2. **[phone] e2e/crowd-play.spec.ts:256** "the scoreboard box is built once…" (shard 9): `done(b.seq)` false; seq shows scoring/reveal/
   watching/stageBreak/play cycles. Find why the sequence didn't complete (test timing vs the app), fix the cause.

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/ops.md` ("CI e2e"). The PR body (`.pr-body.md`): cause and fix for each, player-visible
changes, checks changed old → new, tests run. A short decision note per real cause in `docs/decisions/`. Push at each real step, write
`.done`, stop. Don't open PRs or wait on CI. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
(no Co-Authored-By). Budget about an hour; run only these two specs (repeated) and the units you touch.
