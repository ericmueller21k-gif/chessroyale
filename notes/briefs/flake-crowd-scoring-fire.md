# Flake at its cause: crowd-scoring.spec.ts:96 (Nov 26). Opus medium. Branch `claude/flake-scoreboard-fire` from main.

CI on PR #970 (an unrelated change) failed this once, then it passed on the retry: `[phone] › e2e/crowd-scoring.spec.ts:96:1 › the
scoreboard's fire from 3 in a row on the rank square: every tier, names keep their room, steady rows, nothing cut short; still under
reduce…`, error "360px, scoreboard: a name's room with and without the fire" (run 45767... on head 3869568b, shard 3; find it with
`gh api "repos/ericmueller21k-gif/chessroyale/actions/runs?head_sha=3869568b451c2a1b8ba931f8c9f2e9f1571006a7"` and its kept report).
On main a retry-pass turns the run red (CLAUDE.md). Find why it differs run to run (a measurement before fonts or layout settle, an
animation frame, a rounding edge at 360 px) and fix the cause, in the test if the test measures at the wrong moment, in the CSS if the
layout really shifts. Never loosen the check's meaning or add a retry. Prove it: run the test 20 times locally under the shared e2e lock
(`--repeat-each 20 --project phone -g "scoreboard's fire"`) green, and say what was wrong. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md` (if the check guards one of Eric's rules, flag it, don't change its meaning). Write `.pr-body.md` (cause, fix,
checks changed old → new); commit and push it and an empty `.done`, stop. About 45 minutes. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
