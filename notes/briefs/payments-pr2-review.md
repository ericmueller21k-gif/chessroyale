# Independent review: Payments PR 2, play coins (#950) (Nov 25). Opus xhigh, READ-ONLY. Full lane.

PR ericmueller21k-gif/chessroyale#950, branch `claude/pay-play-coins` (head a4de7fcc). Read its PR body (the `.pr-body.md` was on the
branch until the director stripped it: `git show 8d9d4ac5:.pr-body.md`), the approved design `docs/decisions/2026-11-17-payments-design.md`
section 6 and "Calls made here", and this PR's `docs/decisions/2026-11-25-play-coins.md`. Review the diff against origin/main
(`git diff origin/main...origin/claude/pay-play-coins`) as an independent reviewer: you did not write it.
Focus, in order:
1. **Money correctness:** can any game pay twice (retries, a second tab, a room restart, a reconnect, a replayed recording, races of many
   games at once, the XP day's boundary)? Can a player get more than 300 play / 600 total a day, or be starved of what they earned? Is
   the bonus's step math exact under races, and is the "last retry held to the 300 only" fallback safe?
2. **Eligibility:** exactly XP's (guest, test game, leaver, fair-play hold, under 10 moves, server-timed minutes, maxMinutes, solo cap);
   solo pays no bonus; the friends'-lobby once-a-day win rule.
3. **Removed paths:** ranked's and Squads' old coins truly gone, nowhere paying both, queued old rewards never paying old coins; old apps
   still fine (the "placed" message's `coins: 0`).
4. **Stored data:** `results.coins` via `ensureSchema` (safe on the live D1, nullable, no migration needed?), the download/erase, the
   anonymous kept rows.
5. **Tests:** do they prove the above (not just the happy path)? Any checks weakened or removed without cause?
6. Docs/FAQ words match settings.
Write `REVIEW.md` on a new branch `review/pay-play-coins` (from the PR head): findings ranked **blocker / major / minor / nit**, each with
file:line, a concrete failure scenario, and a suggested fix. Run the core and server unit tests and any focused test you need to prove a
finding (you may add a throwaway test locally; don't push code to the PR branch). Push `REVIEW.md` only, then stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About 45-60 minutes.
