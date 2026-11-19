# Battle Tower PR 9 (#812): the review's fixes (Nov 19). Opus, xhigh, alone. FULL lane (then a delta re-review)

Branch `claude/tower-saving` (pull first). The review: `git fetch origin review/tower-saving && git show origin/review/tower-saving:.review.md`.
Read it in full, then CLAUDE.md and `docs/decisions/2026-11-19-tower-saving.md`. Fix at the cause, the review's fixes as the start;
each fix's test fails before it (show it):
- **M1:** a stop is free when the floor's bosses no longer pass the pool now (`sideRefusal(floorBosses, pool)` → `leaveFloor(before, 0)`);
  the `under` answer marks it (`resting: true`) so PR 10 can offer a free leave. One test beside "a boss resting since the deal".
- **m1:** finish's 409 carries `run` (the open run's view or null) and `best`, as stop's does; a same-id, same-outcome replay answers
  the stored result if that's a few lines (keep the last finished `{ id, outcome }`), else the 409 with state. Record PR 10's contract.
- **m2 (the director's call: the code matches the policy):** a confirmed new run deletes the replaced run in its batch after `soloBest`
  has counted it; `abandoned` stays for the sign-in merge only, and the policy line covers that case too (one plain sentence).
- **m4:** a `met` that doesn't parse answers 409 `{ confirm: true }` (start a new run), not the resting 503.
- **m5:** cap the best at `BATTLE_TOWER.floors`, and a comment on `floors`: only ever raised.
- **m3:** a decision-note line (the director's call): a solo best is the device's word, so it stays off any leaderboard and out of
  anything that pays; solo emblems are marked "solo" (the design). m6: leave.
- The review's "Notes for PR 10" go into the area page's PR 10 list (one line each).
Done: update `.pr-body.md` (a short "Review fixes" section, changed checks old → new; under 70 lines in all) and `.done`; push and end.
No PRs, no CI waits. Commits end with the `Claude-Session:` line only.
