# Flaky batch 5 (Nov 10): main run 42768777492 (f80f5e0)

Method as #590/#597/#600: cause from the retry's trace (artifacts `e2e-report-shard-4/11/15` of that run), fixed where it
lives; never a longer timeout, retry, skip or looser number. Prove each with `--repeat-each 10` (`--workers 1` for specs
that share one lobby).

1. `chat.spec.ts:280` [desktop]: the board check right after the first `tapMove` read `null` (the Crowd moved past its
   board screen). #596 fixed the same thing at the end of this test (`untilMyTurn` before measuring): apply the right
   equivalent here without weakening "the board never moved or resized for chat".
2. `desktop-board.spec.ts:300` [desktop], crowd screen: after "reveal" it polls for "play" and got "simulating" for 30 s.
   #590 (F6) replaced fixed waits with these polls; what are the real phases after a reveal in this match (simulating?
   the end?), and what should the test wait for so it checks the board's size through the game as before?
3. `town-afk.spec.ts:54` [desktop]: `canvas.town-canvas` not found 5 s after `goto("/town?…")`, same as colosseum:42 and
   shop:1094 (the town's first load on a cold runner). #598 (lazy boss art) and #599 (phone load 2) are in main now:
   measure the town's ready time on CI-like load; if it's still near 5 s, find what the town waits on before it mounts
   (the account wait, `ACCOUNT_WAIT_MS` 3 s, then its code) and fix it in the app if a player would feel it, else make the
   specs wait on the town's own ready signal with the same budget their other waits use.

Lane: targeted. Effort high. Decision note docs/decisions/2026-11-10-flaky-batch-5.md (≤ 120 words). Push to
claude/flaky-nov10c at each real step; when done write .pr-body.md and push. Don't open the PR. Read CLAUDE.md and
notes/briefs/rules-common.md first.
