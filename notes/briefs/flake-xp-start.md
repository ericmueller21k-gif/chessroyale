# Main FLAKY_RED at d4cf40be: [phone] xp.spec.ts:223 "each other No XP line" passed only on retry (Nov 25). Opus high, targeted

Run 45559755980, shard 10. Error: `locator.click: Test timeout of 240000ms exceeded` waiting for `getByRole('main').getByRole('button', { name:
'START' })` at helpers.ts:754 (`bossAloneFromHome`, called from xp.spec.ts:238). The renderer-hang note: "the page still answering ... not a
renderer hang" (url `/?debug&pace=quick&mate=1&boss=gingerbread`). The page snapshot at the timeout (report data .md) shows HOME (the RANKED row
with the new LADDER button, PLAY disabled, Chess Town, Boss Battle card): so `openSoloBoss` saw the Boss Battle heading, then the page went back
to home before START was clicked. Find what sends it home (a reload? the service worker's update? a quests or notice pop-up's close? a test's own
faked route? a race with the loop's previous case?), reproduce it (`--repeat-each`, phone), fix the cause (app or test), and prove it (the test
passes N repeats where it failed before). Download the report: `gh api repos/ericmueller21k-gif/chessroyale/actions/artifacts/14998346974/zip`.
Start from main. Short decision note, `.pr-body.md`, `.done` on `claude/fix-xp-start`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high. ~1 hour.
