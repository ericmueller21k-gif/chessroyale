# chat.spec:80 [desktop]: the phone's two-tap move not picked in 5 s. Opus, high. Find the cause. Targeted lane

Branch `claude/chat80` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md` (line ~79: this test is
**Eric's guard**: you may not edit what it checks; a change to its steps or helpers needs Eric's OK: write the proposed diff in
`.question` on your branch and stop, unless the cause is in the app).
Seen on main: Nov 16 07:45 (`chat.spec.ts:283`, first sighting) and Nov 16 at 8721620 (shard 3, retry-pass): `expect.poll(picked)
.toEqual([first])` read `[]` for 5 s after `tapMove(phone)` (two taps, 120 ms apart, on squares computed from one fen and one board box
read before the taps). Only on the desktop project. The T1 helper's note (PR #751): "the failure's page snapshot is the computer's, so the
phone's state isn't known".
**Do:** reproduce (loop the test on desktop, CPU slowed, `--repeat-each`), get the phone's trace/state at the failure, find the cause
(a turn ending between the read and the taps, the chat tab or emoji popover taking the first tap, a re-render moving the board, the
desk's submit racing, …) and fix it at its cause: the app if it's an app bug (a real tap lost is a player bug), else propose the test
change for Eric's OK. Push; `.pr-body.md` (short) and `.done` (or `.question`). Commits end with the `Claude-Session:` line only, no model
names. No PR, no waiting on CI.
