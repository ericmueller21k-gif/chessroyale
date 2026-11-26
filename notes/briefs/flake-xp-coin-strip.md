# Flake at its cause: xp.spec.ts:224 (Nov 26). Opus medium. Branch `claude/flake-xp-coin-strip` from main.

CI on PR #974 (an unrelated town change, head de120c03, run 45797983484, shard 9) failed this once, then it passed on the retry:
`[phone] › e2e/xp.spec.ts:224:1 › the coin strip under the XP box (Nov 25): there from the first frame, the XP box's width, never moving;
the grant's coins counted after the fill …`, error "laptop 1280×600: never down". On main a retry-pass turns the run red (CLAUDE.md).
Find why it differs run to run and fix the cause (a measurement taken before layout settles, an animation frame, a rounding edge), in
the test if it measures at the wrong moment, in the CSS if the strip really moves. Never loosen the check's meaning or add a retry; if
it guards one of Eric's rules (`docs/rules/eric.md`), flag it and don't change its meaning. Prove it: `--repeat-each 20 --project phone
-g "coin strip under the XP box"` in CI's image (`mcr.microsoft.com/playwright:v1.56.1-noble`) under the shared e2e lock, green; say what
was wrong. `.pr-body.md` (cause, fix, checks changed old → new), commit and push it and an empty `.done`, stop. About 45 minutes.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
