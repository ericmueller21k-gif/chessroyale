# Independent review: PR #610 (rewards, records and fair play), read-only

You review PR #610 (branch claude/fable-b2) in the full lane: stored data (a new D1 table), rewards, fair play, sign-in on
the engine routes. Read CLAUDE.md, then the PR's diff (`git diff origin/main...origin/claude/fable-b2`) and its body
(the PR on GitHub, or the decision note docs/decisions/2026-11-10-rewards-and-records.md), then the outside review it
answers (`notes/fable-audit-findings.md` findings 3, 4, 6, 7, 9, 10, the guest-merge line near :184; part 2 tests item 5;
branch claude/director-notes).

Look for:
- **A match's end:** a result written twice or never (a restart mid-save, a deploy, the 24 h give-up, the lobby closing
  while results wait, a player in two lobbies); XP or rewards paid twice under a retry; a rating restored to an older
  value; a Durable Object that never closes; the per-wake cap starving a 100-player match; Squads and 1 v 1 untouched?
- **Ranked 1 v 1 retries:** the same, and a room that waits forever.
- **Engine routes:** an honest signed-in player or a match refused when it shouldn't be; the cap counting in a way a
  player can't reset but a stranger can still exhaust; guests in dev/e2e; the new `engine_calls` table in the download,
  deletion and privacy page, and created where the other tables are.
- **Fair play:** "review" truly never bans; the deep re-check on every legal move costs within the engine budget for a
  whole match; the reviewer token's ban bar can't be bypassed (another route, a clear-then-ban); no email leaks elsewhere.
- **Welcome Crate and the guest merge:** an honest player who no longer earns the crate (offline solo, a short game, the
  3-minute rule on fast games); a merge that now loses rewards it should keep.
- Does it close what the proof test shows, and is anything still open that the PR says is closed?

Don't fix. Write `review.md` on an orphan branch `review/fable-b2`: findings ranked (blocker / major / minor), each with
file:line, a concrete failing case, and the fix you'd make; then "checked, fine" in a few lines. Run the server unit tests
and any you write to show a finding. About 45 minutes; no fuzz marathons. Push the orphan branch and stop.
