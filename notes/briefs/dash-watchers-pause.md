# Clock pauses reach watchers; the round never locks mid-"jk bro". god-king lane. Opus, xhigh (server timing, protocol, online sync)

Branch `claude/dash-watchers-pause` from main. About 1-1.5 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md` (Dash, the
God King's strike), `docs/decisions/2026-11-17-dash-stall.md`, and the review that raised these: `git show origin/review/dash-stall:review.md`
(findings 4 and 5).

1. **Finding 4: watchers' clocks aren't told of a pause.** The server sends `stall` only to `roundHumans()`, so cut players and spectators
   watching the live board keep the round's original deadline: their clock bar and the bots' vote progress run through the slam and the
   fake move and hit 0 up to ~9.6 s early. The God King's strike pause has the same gap. Send the moved deadline (and progress
   postpone) to the watchers too, for both pauses, through whatever message the watching phase already reads (prefer extending an
   existing message's optional field over a new one), and let net.ts move the watching phase's deadline/progress. One test per pause
   (server: the watchers get it; app: the watching clock moves). Reconnect as a watcher mid-pause: right deadline.
2. **Finding 5: the round can lock during the fake move's hold** (the last waited-on player disconnects/is kicked, or a pick lands in the
   hold): the reveal cuts "Nahh, jk bro" short. When `roundDone()` happens inside an active fake window, lock at `fake.until` instead
   (`setTimer("lock", fake.until)`), as other moments hold the screen. One test.

Full lane rules for the protocol part: say in the PR which messages/fields changed and that they're optional (older apps ignore them).
Run: typecheck; server and app unit tests touched (dash-lobby, the King's strike tests, net); e2e `dash.spec.ts` + boss-smoke on phone.
Done: `.pr-body.md` (under 50 lines; changed checks old → new) and `.done`, end. Blocked on Eric only: `.question`. No PRs, no CI waits.
