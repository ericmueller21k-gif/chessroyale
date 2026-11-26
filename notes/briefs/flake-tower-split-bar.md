# Flake at its cause: battle-tower.spec.ts:723 [desktop] (Nov 26). Opus medium. Branch `claude/flake-tower-split-bar` from main.

Main's run on 227ad6a5 (the #976 merge) failed this once and passed it on the retry (a retry-pass turns main red): `[desktop] ›
e2e/battle-tower.spec.ts:723:1 › the split bar as an accordion (Eric, Nov 21): the boss to move 75%, the others folded; a turn change
slides; a tapped part opens and folds back…`, error `TypeError: Cannot read properties of null (reading 'x')` (a `boundingBox()` that
returned null: the element measured wasn't in the layout at that moment). Find the run with
`gh api "repos/ericmueller21k-gif/chessroyale/actions/runs?head_sha=227ad6a5e06e3c1141e54d4e953aaf1c00c83e24"` and its kept report as
`notes/tools/flaky-of.py` on `claude/director-notes` does. CI runners are busy (two towns drawing at once slowed frames to 3-4 fps today,
#976), so a measurement taken mid-slide or before a part is laid out is the likely shape. Fix the cause (wait for the state the check
means, measured on the page, as #976/#978 did), in the app if the bar really drops a part. Never loosen the check's meaning or add a
retry; if it guards one of Eric's rules (`docs/rules/eric.md`), flag it. Prove it: `--repeat-each 15 --project desktop -g "split bar as an
accordion"` in CI's image (`mcr.microsoft.com/playwright:v1.56.1-noble`) under the shared e2e lock, with load alongside (a second
container running the town specs). `.pr-body.md` (cause, fix, checks changed old → new), commit and push it and an empty `.done`, stop.
About 45 minutes. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By.
