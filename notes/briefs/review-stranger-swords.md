# Quick review: the Stranger's swords, PR #1002 (boss lane), Nov 27

Read `notes/briefs/rules-common.md` first. Read-only, about 30 minutes, Opus, effort high. Review `git diff origin/main...origin/claude/stranger-swords`
(the PR body on GitHub says what it claims; Eric's words are in `notes/briefs/stranger-swords.md`). One pass, no fix loops.
Look hardest at:
- the finisher's move hold (`bossMoveMoment`, `STRANGER_FX.finisher`, `finisherLeadMs`): solo and online show the same thing at the same
  time; the server holds the move as Chandy's lock does; a reconnect or a late join mid-finisher; the clock during the hold;
- the new core event kind (`finisher`): optional for other bosses, nothing else changes; the protocol;
- the helper's own flag: Grex's `pieceBurn` reused "with its sound off" may bleed Grex's burn sound into the Stranger's existing
  Frostfire burn moment (or the other way): check and say;
- every frame whole on screen (Eric's guard boss-side.spec covers his kit), `OVER_BOARD.stranger`, the reach tables;
- the frame rate claim (frostfire 4x slower: 16.7 ms median, 39 ms worst on a phone) vs. the other bosses' moments;
- `gkHyuah` exception in his sound test (Eric asked for the God King's recorded shouts: fine), no other sound or kit changed.
Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; "Checked"; "Not reached") on branch
`claude/stranger-swords-review` (from the PR head), push, then push `.done`. Don't fix code, open PRs or comment on GitHub.
