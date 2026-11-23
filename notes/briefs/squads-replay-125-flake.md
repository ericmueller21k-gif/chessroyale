# main red: squads-replay.spec.ts:125 passed only on retry (Nov 23). Opus high, targeted lane

main eba5084 (#907, Birdie's whistles: unrelated), e2e run 45230830938, shard 13 of 15, [phone], first try failed, retry passed:
```
e2e/squads-replay.spec.ts:207  await expect(page.locator(".rp-over")).toHaveCount(0, { timeout: 500 * n + 1_500 });
Expected: 0  Received: 1  Timeout: 2500ms
```
The replay overlay was still up 2.5 s in (n = 2) on a loaded CI runner (that shard also ran crowd.spec for 6 minutes). Earlier flakes in this
file were fixed at their causes: `git log origin/main -- e2e/squads-replay.spec.ts`, `docs/decisions/2026-11-10-squads-replay-test.md`,
and the notes/briefs on `claude/director-notes`: `squads-replay-next-flake.md`, `brief-flaky-nov10d.md`.

Start: `git fetch origin main && git checkout -B claude/squads-replay-125 origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md` (check whether this test guards a rule: if so, a change to its check needs Eric's OK; stop and say so), and
`docs/areas/squads.md`. Effort high: timing.

Find the cause, don't widen the timeout blindly. Is the replay's end tied to wall time the test can measure (it says "ends as the extra
time does, never later, never early") while the app ends it on frame callbacks or timers that a loaded runner delays? If the app is right
and the test's clock is wrong, make the test read the app's own end (an attribute or a hook the app already exposes, as earlier fixes read
the 40 ms watcher). If the app can really end late (a player on a slow phone would see the replay overrun the extra time), fix the app.
Reproduce under load first (e.g. CPU throttling via CDP, or running crowd.spec beside it), show the failure, then the fix passing 10 times
under the same load. Phone and computer. Decision note of about five lines. PR body in `.pr-body.md` (cause, fix, changed checks old → new).
`.done`, push, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American English.
