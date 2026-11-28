# Two flaky e2e tests: fix each at its cause. Opus, medium. Light lane (tests), unless the cause is in the app.

Read `notes/briefs/rules-common.md` first. Branch `claude/flakes-xp-bossresult` from `origin/main`.
1. `[phone] e2e/xp.spec.ts:228` "the coin strip under the XP box (Nov 25)…": failed once, passed on the retry, on PR #1027's run of
   head 94e47a77 (shard 11): `Error: phone 390×844: a clink a coin`. #1027 doesn't touch it. Get the trace from that run (the `result`
   job lists it; `gh` only for search, the GitHub MCP for runs and logs) and find why the clink is sometimes missed or counted wrong.
2. `e2e/boss-result.spec.ts:133` "above him": flaked on PR #1030's run (Nov 28). Same: the trace, the cause.
If the cause is the app (a real race a player could hit), fix the app and say so; if it's the test, fix what it waits on (never a longer
timeout or a retry). Run each spec a few times locally under the e2e lock to show it holds. Short PR body (what was wrong in plain words,
changed checks old → new). Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop. About 45 minutes.
