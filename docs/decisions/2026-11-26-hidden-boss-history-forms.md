# Hidden Boss forms in match history: stopped for stored data (Nov 26, 2026)

Eric, Nov 13: "in the match history, it should show the hidden boss, and then it would show like all three of his forms... gray
out the ones you beat". **Call:** not built yet. A result row records only `boss_id` and `team_won` (the whole fight won, all
three forms beaten); a lost fight doesn't say which form ended it, so the grayed forms can't be drawn from what's stored.
Recording it is a new `results` column (the full lane), proposed in the PR body: `forms_beaten`, a count 0 to 3 in
RECLUSE_FORMS order. Once it ships, the entry is a hub PR on the targeted lane.
