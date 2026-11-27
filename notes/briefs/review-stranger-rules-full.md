# Independent review: the Stranger's rules, PR #1000 (FULL lane: stored data)

Read `notes/briefs/rules-common.md` first. Read-only review, effort xhigh, Opus. Branch `claude/stranger-rules` at its head (PR #1000;
read the PR body on GitHub for what it claims). Base: `origin/main`. Review the diff (`git diff origin/main...origin/claude/stranger-rules`),
not the whole codebase. About an hour; no fuzz marathons, no fix loops. You don't fix anything.

Focus, in order:
1. **Stored data:** the new `boss_unlocks (user_id, boss, at)` table in `TOWER_SCHEMA`: does the schema run add it safely on the live D1
   (idempotent, no table rebuild, no data loss)? Written only server-side on a real win of his floor (solo, a party copy alone, the
   party room per member still present)? The sign-in merge, the download and the delete (`account-data.ts`): complete and correct?
2. **Never trusting the device:** every pick of the Stranger online (raid, party, Boss alone over the network) is re-checked on the
   server against `boss_unlocks`; nothing the client sends can unlock him or deal his floor to a non-admin.
3. **Admins first:** for a non-admin nothing changes (tower floors 10/30/50 deal as before, his card isn't shown, the FAQ hides his
   lines, no unlock written from a floor that didn't deal him); for an admin it all works. A party with a non-admin never deals him.
4. **The loophole Eric closed** ("you have to beat him to unlock him"): a life spent on his floor, then a later floor won, never unlocks;
   a retry; floors 30/50.
5. Frostfire's rules (freeze one turn, thaw, burn): legal positions, kings, solo/online parity, the judge and fair-play exemptions.
6. Tests: do the new checks fail without their fix? Any guard test (docs/rules/eric.md) touched besides banners.test.ts (Eric OK'd)?

Write `REVIEW.md` (blockers, should-fix, nits, each with file:line and a failing scenario; "Checked and correct" list; "Not reached")
on branch `claude/stranger-rules-review` (from the PR head), push it, then push `.done`. Don't open PRs or comment on GitHub.
