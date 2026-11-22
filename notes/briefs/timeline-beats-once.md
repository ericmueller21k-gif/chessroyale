# Follow-up to #885: each timed power's beats written once. Opus, xhigh, alone

#885 (merged) made a kept solo battle keep before it shows anything ("keep before show"; `.claude/LESSONS.md`, "Three review rounds,
one cause"). Its last review (`review-885-delta-3.md` on branch `review/solo-resume`, finding F1) found the one beat still missed:
Dash's Scramble Rush keeps only as its sweep starts, so a second window's Resume or a crash replays the whole sweep (700 to 4,200 ms).
Lights out's drop has the same shape. The review named the cause: each power's "what the screen shows by the clock" is written twice,
once in its screen (`DashRush.tsx`, the Dodge's and Lights out's views) and once in `SoloMatch.moment()` (`solo.ts`), and the walk
test (`solo-resume.test.ts`, `beats()`) copies `moment().reveals`, so it checks the code against itself.

Fix the cause, the smallest way: each timed power's timeline (`dashTimeline`/`rushTimeline`, `dodgeTimeline` in `chandy.ts`, Hollow's
in `hollow.ts`) exports its beats once (when each thing first shows, and where a sweep or drop runs, its end), and the screens,
`moment().reveals` and the walk test all read that one list. A sweep's beats include its end, so a rejoin after the sweep never replays
it (director's call: inside the sweep, keep at the sweep's end as soon as it starts is too harsh; keep at each piece's landing if
that's how the screen draws it, otherwise the sweep's start and end). Also F2: the stale `resumeTurnMs` comment at `solo.ts:544`.
Keep player-visible timing exactly as it is (a frame-by-frame look with `npm run frames:boss` for Dash's Rush, before and after).
Lane: targeted (+ the boss kit). Prove it with typecheck, app unit tests, the walk test (flip the review's F1 case from
`review-885-delta-3.test.ts`), `e2e/dash.spec.ts` and `e2e/hollow.spec.ts` (phone) under the e2e lock. Write `.pr-body.md` (what
changed, player-visible changes: none, changed checks old → new), `.done`, push to branch `claude/timeline-beats-once` and stop.
Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only.
