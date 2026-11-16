# The power-up's hints: 2 moves instead of 3 (multiplayer.spec:18 [desktop]). Opus, high. Targeted lane

Branch `claude/hint-two-moves` from main. About 1-2 h. Read CLAUDE.md, `docs/areas/engine.md`, `.claude/LESSONS.md`.

**Seen** on main three times (Nov 11 2d6471f, Nov 12, Nov 16 c17703c, shard 8, a retry-pass): `e2e/multiplayer.spec.ts:58`
`expect(.hints li).toHaveCount(3)` read **2** for 13 polls, then 0 (the round ended: `net.ts` clears `hint`). The guest's first play
phase, an early position (20-ish legal moves), so the top-moves search returned only 2 lines.
- Path: `packages/app/src/net.ts` `usePowerUp` → `this.top.get(engines[0], fen)` (`TopMovesCache`, n = `botCandidateMoves` 8,
  `packages/chess/src/runner-tools.ts`, maybe the round's prefetch) → `UciEngine.topMoves` → `search` (`go nodes`, MultiPV) →
  `searchLines` (`packages/chess/src/uci.ts`) → `hintsFrom` (top 3).
- A player could get 2 hints for a power-up: a game bug, not only a test one.

**Do.** Find why a top-8 search can come back with 2 lines (e.g. a prefetch started by another consumer with fewer lines, a search cut
short or interleaved on a busy engine, the web worker's engine restarted, `searchLines` dropping slots, the CI run's trace: the
`e2e` run 43895... artifacts if you can reach them). Reproduce it (a unit test on `searchLines`/the cache with the real output, or
the engine under load), fix the cause, and add one focused check that fails without the fix. No fuzz marathons.
If the cause can't be found in about 2 h: write what you ruled out, and stop.

Push at each real step; at the end `.pr-body.md` (short: cause, fix, changed checks old → new) and `.done`. Commits end with the
`Claude-Session:` line only, no model names. No PR, no waiting on CI.
