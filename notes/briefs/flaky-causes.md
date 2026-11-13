# Flaky tests: fix the causes (Eric, Nov 13: "fix the cause, not add a checker")

Effort high. New branch `claude/flaky-causes` from `origin/main`. Read CLAUDE.md's new rule "Fix the cause, not add a checker" and
`.claude/LESSONS.md` first.

These e2e tests failed once and passed on CI's retry (on main a retry-pass turns the run red):
town-desktop:36, crate-banner:44, friends:40, global-chat:46, desktop-board:260, live-window:114 (ECONNRESET), hidden-boss-room:242,
town-street:226 (the Alfil tap). Line numbers are from main around Nov 13 and may have moved; read each test's failure from the
latest main runs' `result` job if you need it (GitHub MCP actions tools).

For EACH one, first answer: **is the game wrong, or the test?** A tap that's sometimes lost or a screen that sometimes doesn't open is a
game bug to fix in the game, not a wait to add. Only when the game is right and the test is at fault, fix the test.
The common test-side cause seen so far (shop:875, statue zoom, crowd power-up row): the test grabbed something still moving (a camera
glide, a zoom, a layout after a resize) and tapped where it used to be. Fix that once: add one shared helper in `e2e/helpers.ts`
(e.g. `settled(page, read, ms = 300)`: polls `read()` until its value holds still for `ms`) and use it in these tests instead of fixed
`waitForTimeout`s or one-off loops. Don't sweep the whole suite; just these tests and any helper they share.

Off limits: `e2e/town-leave.spec.ts` and any guard test listed in `docs/rules/eric.md` (Eric's OK needed). If a cause lives in one,
write it up in the PR body instead of changing it.

Prove each fix: run that test 10 times locally (`--repeat-each 10`, the project it failed in), under the shared e2e lock; before and
after numbers in the PR body where you could reproduce it. Typecheck; unit tests of any app package you touch.
Push at each real step; `.pr-body.md` (per test: the cause, game or test, the fix; checks changed old -> new); `.done`. No PRs, no CI
waits, no model names in commits (end commits with the Claude-Session line only). About an hour.
