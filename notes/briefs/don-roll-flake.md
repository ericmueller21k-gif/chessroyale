# #1026 (Don Dough fixes): the timer's roll from 8 sometimes not drawn on a phone. Opus, medium. Targeted

Read `notes/briefs/rules-common.md` first. PR #1026, branch `claude/don-dough-fixes` (head e128beb). Its CI (phone, `e2e/zebra.spec.ts:106`)
passed only on the retry: line 162 `expect(s.frames.some((f) => f.startsWith(`pRoll08:`))).toBe(true)` was false on the first try. That
check is on main and was reliable there; this PR added `shownLeft` (Zebra.tsx: each timer shows a minute off while your move is judged,
`crowdMoved = phase.kind === "scoring"`). Suspects: the shown count bouncing (P → P-1 while scoring, back to P for a frame as the phase
leaves scoring before the view counts the move, then P-1 again: a restarted or skipped roll), or the two rolls (yours, his) colliding
under `?pace=quick`. Find it frame by frame (record shown and the roll's frames each rAF; CPU slowed), fix the cause in the app if the
shown count ever bounces or a roll is cut, otherwise in the test (and say which). Push to `claude/don-dough-fixes`, then `.done2` with a
5-line note. Commits end only with your Claude-Session line.
