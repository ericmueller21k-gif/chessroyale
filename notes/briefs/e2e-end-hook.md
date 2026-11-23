# e2e: end a battle by a test hook, not by playing it out (the Nov 23 sweep's N5). Opus high, targeted lane

Read `notes/pipeline-audit-2026-11-23.md` on `claude/director-notes`, section N5, then CLAUDE.md, `.claude/LESSONS.md`,
`docs/areas/ops.md` ("CI e2e") and `e2e/helpers.ts`. Branch: `git fetch origin main && git checkout -B claude/e2e-end-hook origin/main`.

The cause (no new checker): specs that test a screen *after* a battle play real moves and assume how long the battle lasts; any engine
or boss change ends it a move early or late ("play" vs "results": hopper:236, recluse:951, smudgy:189, xp:376, xp:382,
squads-replay:125). Fix:
1. One helper in `e2e/helpers.ts` that ends the current battle with a chosen outcome (win / loss, and draw if it exists) the way the
   admin "Win this match" button (#846) does, through the same code path a real end takes (results, XP, rewards, the kept game cleared).
   Find how #846 does it; reuse it; add a loss if needed (test-only, behind the same guard the admin button uses, never reachable by a
   player; if it needs a server/protocol change, stop and write `.question`).
2. Move the end-screen specs onto it: the xp tests, hopper:236, recluse:951, smudgy:189, squads-replay:125 if it fits (say if not).
   Specs that test *playing* a battle keep playing it. Each moved test keeps what it checks after the battle; say per test, old → new.
3. Say it in `e2e/helpers.ts`' header and a rule in `.claude/LESSONS.md` (and `docs/areas/ops.md`): "a test of what comes after a
   battle ends it with the hook; only a test of playing plays".
4. Prove: typecheck; run each moved spec locally (phone) 3 times; measure the time saved. `e2e/helpers.ts` is shared, so CI runs
   everything. A short decision note. PR body to `.pr-body.md` (changed checks old → new: this changes how tests reach their screens,
   not what they check; no guard test in `docs/rules/eric.md` may change: if one would, `.question`). `.done`, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
