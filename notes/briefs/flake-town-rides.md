# Flake: town.spec.ts:1418 "rides" (phone), main 3d8b5ae (Nov 27 ~13:00). Opus high, targeted. Fix at the cause.

Read `notes/briefs/rules-common.md` first. Branch `claude/flake-town-rides` from main. Main is red (FLAKY_RED) until this lands.
Failure (shard 6, passed on retry): :1557 `expect(steps).toEqual(arrayContaining(["move:0:1","move:0:-1","move:1:1","move:2:1",
"idle:0:-1","idle:1:1","idle:2:1"]))`; received `["idle:1:1","move:0:1","idle:0:1","move:0:-1","idle:0:-1","move:1:1","idle:2:1"]`:
**no "move:2:1"** (the ride's front, walking down, never seen moving). Find why: the walk down too short or blocked on that run (a
bot or another rider in the way, the path choosing another way), the per-frame recorder missing it, or the ride's facing logic picking
another view for a downward step. Fix the cause (the test's walk made deterministic, e.g. a clear straight path; or the app if its
facing is wrong). Never loosen the check. Run the test 5x on phone (one worker). `.pr-body.md` at most 40 lines, `.done`.

(The director's note for later, Eric's "fix the cause" rule: three new one-off flakes surfaced on main today (shared Smudgy floor, two
Birdie, now town rides). If the next batch shows more, look at what's common: CI runners' load, per-frame recorders in tests, short timed
windows. Say in the PR body if this one shares a cause with the Birdie fix (a recorder copying a growing log each poll).)
