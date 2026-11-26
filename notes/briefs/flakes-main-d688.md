# Three retry-pass flakes on main d68874aa (Nov 26). Opus medium. One branch `claude/flakes-main-d688` from main, one PR.

Main's full run on d68874aa (run 45816786113) passed these only on the retry, which turns main red (CLAUDE.md):
1. shard 4 `[phone] › e2e/birdie-home.spec.ts:35:1` "Birdie's Station … the birds at the bar …": `expect(received).toBeGreaterThan(expected)`
   (new tonight in #974: "over half the birds on show as you come in", "all 50 fled at the bartender", no uploads in the room's frames).
2. shard 11 `[phone] › e2e/hopper.spec.ts:301:1` "his fifth carrot (?carrots=5) … the fifth wins the battle, no spin": `toBe` equality.
   **Check first whether tonight's #972 (`BOSS_POWERS.ultWaitMax`, the Carrot Patch's pass guard capped by `passWaits`) changed its
   behavior** (a real regression, not timing): if so, fix the cause in the code, not the test.
3. shard 1 `[desktop] › e2e/squads.spec.ts:60:1` "a test lobby straight at the final (SQUADS_TEST) …": `toHaveLength`.
Today's pattern (#976, #977, #978, #979): CI runners are busy (two software-WebGL towns drawing at once drop frames to 3-4 fps), and a
test that reads a moment at the wrong time, or counts frames/animation states, fails now and then. For each: read the kept report and
trace (as `notes/tools/flaky-of.py` on `claude/director-notes` does), find the cause, fix it at the cause (wait for the state the check
means, measured on the page; or the app/code if it's real), never loosen a check's meaning, no retry. If a test guards one of Eric's
rules (`docs/rules/eric.md`), flag it and don't change its guarded check. Prove each: `--repeat-each 10` in CI's image
(`mcr.microsoft.com/playwright:v1.56.1-noble`) under the shared e2e lock with a second container running the town specs for load.
`.pr-body.md` (per test: cause, fix, checks changed old → new), commit and push it and an empty `.done`, stop. About 1-1.5 hours.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
