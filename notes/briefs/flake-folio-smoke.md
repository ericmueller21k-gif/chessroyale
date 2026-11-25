# Fix main's red: Folio's boss smoke (Nov 26). Opus high, boss lane (test fix at its cause), one PR, branch `claude/flake-folio-smoke`

Main's full run on f9caf556 (run 45680679144, shard 12) went red (FLAKY_RED): `[phone] e2e/boss-smoke.spec.ts:98` "Folio (folio): ...
his passive and his ultimate" failed once, passed on retry. The failure: `{ passive: false, ultimate: true }`: his passive's event never
showed within the deadline. The PR merged (#953: computer layout, rank pill) touches no boss rule, so this is the test's or Folio's.

Do:
1. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md` (or the boss kit's page), Folio's passive (`powers.passive`) and the
   smoke spec. Find WHY his passive can fail to fire in a seeded quick game: which board state it needs, and why it sometimes isn't
   reached (the engine's replies vary, the "knight to an empty square" policy, a timing race in `watchPowers`, his passive firing
   before the watcher starts, …). Reproduce it (`--repeat-each`, phone project, under the shared e2e lock) before changing anything.
2. Fix the cause: e.g. a `SMOKE_FIRST` line for Folio that reaches his passive's condition for sure (as Chandy's does), or start the
   watcher before the first move, whichever the evidence shows. Never loosen the assertion, skip, or retry. If it's a real Folio bug
   (his passive should have fired and didn't), fix that instead and say so.
3. Show it: the repro failing before, then `--repeat-each=20` passing after (phone). Typecheck.
4. `.pr-body.md` (cause, fix, evidence, checks changed old → new), a five-line decision note, a line in `docs/history/lessons.md` if it's
   a new kind. COMMIT and push `.pr-body.md` and an empty `.done`, then stop. Don't open a PR.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). American English.
Wait with one foreground `timeout 590 bash -c 'until ...; do sleep 30; done'`, never Monitor. Big output to files.
