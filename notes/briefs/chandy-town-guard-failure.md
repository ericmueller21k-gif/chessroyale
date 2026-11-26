# Why the night town guard fails on Chandy's PR in CI (Nov 26). Opus high. Investigate and fix at the cause.

PR https://github.com/ericmueller21k-gif/chessroyale/pull/973, branch `claude/chandy-mate-dodge` (head f5c73378). Its e2e run's shard 13 fails
`e2e/town-street.spec.ts:428` (the night town guard added by #969) on both tries, twice in two separate runs (runs 45791252709 and
45795042926; job logs via `gh api repos/ericmueller21k-gif/chessroyale/actions/jobs/<id>/logs`, kept reports via the run's artifacts:
see `notes/tools/flaky-of.py` on `claude/director-notes` for how to fetch them). The error: on the first visit's `roam`, the town
report's Done button stays disabled for 15 s at line 493: the report never left "wait", i.e. no frame with walking, turning or zooming
reached `frame-report.ts`. The same test passes locally on this branch (`npx playwright test e2e/town-street.spec.ts:428 --project phone
--retries 0`: 1 passed, 2.1 min), and it passes on main's full runs and on #971/#972/#974's runs today. The PR changes no town code
(it touches `speech.tsx`'s `Say`, `Chandy.tsx`, `ChandyDodge.tsx`, `solo.ts`, the runner, the lobby, settings).

Find the cause from the evidence (the kept trace/report from the failing runs, which tests ran before it in that worker, what the
branch changes that the town could feel: a shared module's side effect at import, the speech voices, a timer left running, the
shard's ordering), reproduce it locally the way CI runs it (the same shard: `npx playwright test --shard=13/15 --project phone` with
CI's env, under the shared e2e lock), then fix it at its cause on the PR branch (never loosen the guard, never add a retry). If the cause
is in the guard test itself (it can fail this way on any branch), fix the test and say why it only showed here. Push the fix to
`claude/chandy-mate-dodge` with a short note appended to `.pr-body.md` (cause, fix, checks changed old → new) and an empty `.done`, stop.
About an hour. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By.
