# Ranked L1: the leave rules, 1 v 1 (Eric approved, Nov 9)

The design is `docs/ideas/ranked-ladder.md` (on main). Build **phase L1** of its section 14 exactly: section 4 (leaving: dodges,
leaves, the delayed queue), the L1 rows of section 12's "everything ranked touches" tables, section 10's stored data that L1 needs
(`ranked_conduct` only; not the per-mode tables), section 11's settings that L1 needs (`LEAVES`, under one block), section 13's L1 tests.

Eric's decisions (docs/decisions/2026-11-09-ranked-rank-per-mode-mmr-shown.md): "Quitting during time control. Yeah, that's fine.
Quitting mid-game. Yeah, full loss. Those are all fine." So, as written: a **dodge** (leaving after the match is found, before both
first moves: the time-control vote included, an abort, a no-show) = −5 RP (−10 when repeated), no MMR change, a mark, a short lockout
that grows with repeats; a **leave** (after the game starts: abandon, quick resign as the doc defines it) = a full loss plus −10 RP;
**3+ leaves in the last 20 ranked games** = the delayed queue (an extra wait before pairing), longer at each step.

Scope: 1 v 1 only (the only ranked mode today). Don't build the team modes, OpenSkill, seasons or MMR on profiles. Don't change the
rating math beyond the fees. Kill switch `PAUSE_LEAVE_PENALTIES`. Purge `ranked_conduct` after 90 days in the cron. Account
download/delete/merge cover the new table. Privacy policy and FAQ lines (must match the code exactly).

Player-visible: home's note after a dodge ("You left before the game started: −5 RP"); a lockout or delayed queue greys PLAY for 1 v 1
with its countdown in the line above PLAY (one line: home's line is now always one line, see docs/areas/hub.md; nothing hidden, nothing
shifts); the match menu's Abort/Resign confirms say what they cost in a ranked game (the words only, same box). Note: PR #581
(home modes) may still be open when you start: if it is merged by then, build on it; if not, keep your Home.tsx change small and local
to the hint line and PLAY's disabled state.

Lane: FULL (stored data, rank points): the `full-e2e` label goes on the PR, an independent review, delta re-reviews. Effort xhigh.
