# The Hidden Boss's phase 2: the scoreboard shows who's still playing (Eric's playtest, found Nov 14)

Effort xhigh (match logic: core/server). Targeted lane (rules/standings), plus the touched e2e. New branch
`claude/recluse-phase2-standings` from `origin/main`. Read `docs/areas/bosses.md` (the Hidden Boss), `docs/areas/crowd.md` (the
scoreboard), `.claude/LESSONS.md`. Never write the Hidden Boss's name in player text, commits or PRs.

Found by the same-frame job (#703, merged): "from phase 1's end the match places everyone, so the scoreboard reads 'out' for all,
and a phone's Players tab is empty in phase 2." Its still: the crowd table in phase 2 with all four players "out" and their points
blank, while all four are playing their boards (`stills/recluse-same-frame`, after/four-boards-1280x800.png).

- Find where phase 1's end places everyone (core `match.ts` / `boss.ts`, the server's lobby for online, solo's runner) and why that
  marks them out. In phase 2 everyone on a board is still in the fight: the scoreboard (computer's crowd table, phone's Players tab)
  must show them as playing (their board's state: playing / won / lost / drawn as each ends), with points as phase 2's rules give
  them, until the result. Who is truly out (left, kicked, gone) shows out.
- Online and solo alike; a Crowd final against him too, if it uses the same path (say what you find).
- The result screen and rewards must not change (stored results, XP, rank: if the placing feeds them, keep their final values exactly
  as now and change only what's shown during phase 2; list which fields you touched).
- Tests: unit (core/server) for the standings through phase 1's end and phase 2; one e2e check in an existing spec (the room fight's
  phase 2: no "out" for a player on a board; the phone's Players tab lists the four).
Typecheck; unit tests of packages you touch; the touched e2e specs. Push at each real step; `.pr-body.md` (cause, fix, player-visible,
anything stored or rewarded touched: none expected; checks old -> new); `.done`. No PRs, no CI waits, no model names in commits (end
commits with the Claude-Session line only). About an hour.
