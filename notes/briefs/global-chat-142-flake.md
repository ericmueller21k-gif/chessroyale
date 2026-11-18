# global-chat.spec.ts:142 [desktop] passed only on its retry on main (Nov 18). Opus, high

Branch `claude/global-chat-142` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/chat.md`, `docs/rules/eric.md`
(check whether this spec is a guard: if it is, an edit to the test needs Eric's OK; fix the app's cause instead or stop and write `.question`).

**What failed:** main's full run on c4c49be (run 44272453982, shard 3), first try, line 149: after Ann's `field.fill("typed hello")` and
Enter, the field still held "typed hello" after 5 s (`toHaveValue("")`). It passed on the retry. In this chat the field keeps its
text when the server refuses the line (the earlier test's "Chat is busy, try again." path), so the send was refused or never went.
Unrelated to that day's merges (Chandy rules, comments).

**Find the cause, don't guess (CLAUDE.md, Nov 13):** reproduce (`--repeat-each` on that test, desktop, under the shared e2e lock),
read the trace if you can get the shard's e2e-report, and find what refused or dropped the first send right after `player()`
(sign-in via `asSignedIn` then reload, `turnOn`, the test chat's per-room line (3 s), a rate limit shared across rooms or across
parallel workers, the send's handler not ready yet, a stale chatroom state). Fix the app if it can drop or refuse a player's first
line wrongly (a real player would see their line not go). If the app is right and the test raced it, make the test wait for the
thing that makes a send possible (as the earlier test does for "busy"), not a longer timeout.

Prove it: the failure reproduced (or the cause shown in code), then the same run passing. Typecheck; touched units. Done:
`.pr-body.md` (under 25 lines, changed checks old → new) and `.done`; push and end. No PRs, no CI waits.
