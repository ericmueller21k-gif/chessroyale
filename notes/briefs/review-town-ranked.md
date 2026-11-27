# Independent review: PR #1027, Ranked at the town tables (full lane: matchmaker, the town hub's storage, a watch socket). Opus, xhigh, read-only

Read `notes/briefs/rules-common.md` first, then `notes/briefs/town-ranked-tables.md`. Review `git diff origin/main...origin/claude/town-ranked`.
Look hardest at: the matchmaker → hub → pair ordering (`seatWaitMs`: a slow or dead hub never blocks or loses a match; a pair never seated
twice or at a taken table); a seat's lifetime (end, disconnect, timeout, the backstop) so no table stays taken forever; nothing a client sends
can seat a game it isn't in or claim a table; the watch socket (`/ws?watch=1`): only a town table's game, never chat, outcomes or anything
private, `watchersMax` enforced, no way to act on the game; ranked results and ratings unchanged by the town path; load (many towns,
many seated games); old clients without the new fields. Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case;
Checked; Not reached) on branch `claude/town-ranked-review` from the PR head, push, `.done`. Don't fix code, open PRs or comment on GitHub.
