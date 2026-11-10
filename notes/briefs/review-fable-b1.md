# Independent review: PR #601 (device trust), read-only

You review PR #601 (branch claude/fable-b1) in the full lane: fair play, the lobby protocol, judges and scoring. Read
CLAUDE.md, then the PR's diff (`git diff origin/main...origin/claude/fable-b1`), then the outside review it answers
(`notes/fable-audit-findings.md` findings 1 and 5; `-2.md` rules items 3 and 6, branch claude/director-notes).

Look for: a reconnect, a party, a guest or a spectator that one-seat-per-account breaks (a second tab, a reload mid-match,
a guest merging into an account, a seat token after sign-in); a judge draw that can now find no judge, or always the same one;
an honest host whose scores now fail `hostBoardOk` (Chess960 starts, promotions, a board with no legal move, bots that
didn't pick); anything the new door check on messages drops that the app really sends; Squads' cache or token changes that
break a real flow. Also: does it close the attacks the proof tests show, and is anything still open that the PR says is closed?

Don't fix. Write `review.md` on an orphan branch `review/fable-b1`: findings ranked (blocker / major / minor), each with file:line,
a concrete failing case, and the fix you'd make; then "checked, fine" in a few lines. Run the server unit tests and any you
write to show a finding. About 45 minutes; no fuzz marathons. Push the orphan branch and stop.
