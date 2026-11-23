# The 4 @perf checks red on main (Nov 22). Opus, high, alone or beside one other high/medium

`npx playwright test --grep @perf --project phone` on `origin/main` (CI leaves @perf out; it runs locally or from Actions → e2e → Run
workflow with "perf") has 11 passed and 4 failed, the same on #885's branch and its base (`review-885-delta-3.md` on branch
`review/solo-resume`, "Perf", has the numbers):
- "A long boss battle on a slow phone": DOM elements 248 (limit 232).
- "G-REX's fire on a slow phone": DOM elements 1987 (limit 391).
- "Chess Town, a player's": tap to the town's first frame 16.1 s (limit 8 s). "Chess Town, an admin's": 15.1 s.
Read CLAUDE.md (computing priorities; "Simple beats flashy"; "Fix the cause"), `.claude/LESSONS.md`, `docs/areas/ops.md` ("CI e2e",
perf) and `e2e/perf.spec.ts`. For each: is it real (players on a phone would feel it: a slower load, a leak that grows through a
battle) or a stale limit/measurement? Find when it started (the perf job's past runs, `git log -S`, or a quick bisect of the spec
alone) and the change that caused it. Fix the cause in the app where it's real (the town's load path: what's fetched and decoded
before the first frame; G-REX's fire: elements never removed). Change a limit only where the number was never right, saying why.
Prove it with the 4 specs passing locally (phone, under the e2e lock), plus the specs of whatever you change. Lane: targeted (the
app's drawing/loading); frame rate measured, since the drawing changes. Write `.pr-body.md` (what changed, what players feel,
changed checks old → new), `.done`, push to `claude/perf-main-fails` and stop. If the town's 16 s is real and the fix is big (a
redesign of what loads), stop at the diagnosis with a short plan in `.question` instead. Commits end with the `Claude-Session:` line only.
