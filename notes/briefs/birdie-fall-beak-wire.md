# Birdie's happy fall: the beak fix wired (Nov 23). Opus medium, boss lane

Eric (Nov 23): "his mouth is all [messed up] in the free fall, leave it open but shouldn't be red like that, should be able to see through it
like a normal open beak." The fix is drawn: `claude/boss-art` commit 7f944063f,
`scripts/boss-art/out/arena-birdie-fall-beak/arena-birdie-fall-beak.ts` (only the beak changed from the happy fall; stills `stills/birdie-14`).

Start: `git fetch origin main && git checkout -B claude/birdie-fall-beak origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`. Effort medium: a copy and a re-bake, as #912 did.

1. Copy the drawing into `packages/app/src/characters/birdie-cutscene-fall.ts` the way #912 did (its header names the source and the new
   commit; the `build` wrapper kept; the game's id `arena-birdie-fall` kept). Re-bake the sheet (`scripts/bake-birdie-cutscene.ts`:
   `birdie-cutscene.png` and its hash in `birdie-cutscene-sheet.ts`). Check by pixels that only the beak's region changed in the `fall` and
   `approach` frames of the sheet (a short script; say the changed box in the PR body), and that the bake reproduces byte for byte.
2. Prove: typecheck; `app/test/birdie.test.ts` (the sheet's hash); `e2e/birdie.spec.ts` "Birdie's fall" (phone). One still on a new orphan
   branch `stills/birdie-fall-beak`: the cutscene's fall in the game (phone). Decision note of about three lines. PR body in `.pr-body.md`
   (what changed, player-visible, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. American English.
