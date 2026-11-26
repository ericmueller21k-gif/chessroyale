# Flake at its cause: ranked-1v1.spec.ts:141 (Nov 26). Opus medium. Branch `claude/flake-ranked-1v1` from main.

CI on PR #976 (an unrelated town-test change, head 406ccec1) failed this once, then it passed on the retry: `[phone] ›
e2e/ranked-1v1.spec.ts:141:1 › two players: one tap to queue, the vote on the game's own board, checkmate with real taps, and both ranks
move @phone-only`, error `expect(locator).toHaveText(expected) failed` (find the run with
`gh api "repos/ericmueller21k-gif/chessroyale/actions/runs?head_sha=406ccec10aa0a27585ffa82c5cbeeba66c593acf"`, its kept report as
`notes/tools/flaky-of.py` on `claude/director-notes` does). On main a retry-pass turns the run red (CLAUDE.md). Find why it differs run
to run (a text read before the server's rank update lands, a race between the two players' pages, a timer) and fix the cause, in the
test if it reads at the wrong moment, in the app or server if the screen really shows a wrong or late text. Never loosen the check's
meaning or add a retry; if it guards one of Eric's rules (`docs/rules/eric.md`), flag it. Prove it: `--repeat-each 15 --project phone -g
"both ranks move"` in CI's image (`mcr.microsoft.com/playwright:v1.56.1-noble`) under the shared e2e lock, ideally with load alongside
(the #976 helper ran a second container with town specs to reproduce CI's contention). `.pr-body.md` (cause, fix, checks changed
old → new), commit and push it and an empty `.done`, stop. About 45 minutes. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
