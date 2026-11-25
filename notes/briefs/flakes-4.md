# Fix main: town-afk.spec:83 retry-pass (Nov 25). Opus high, town lane, targeted. Branch `claude/fix-flakes-4` from origin/main

Main e2e4127c (#947), run 45599472319, shard 15: [desktop] `e2e/town-afk.spec.ts:55` "after the zzz wait with no input a zzz floats over
your pawn…" passed only on its retry. Line 83: after `expect.poll(them(bo, annId).zzz).toBe(false)` passed (Ann's zzz cleared on Bo's
screen), `expect(them(bo, annId).drawn).toBe(false)` read `true`: Bo's last frame still drew her zzz.
Decide which it is, with evidence, and fix THAT (CLAUDE.md: fix the cause; never hide a flake):
- (a) a test race: `drawn` is the last frame's and the next frame simply hadn't run yet (then poll `[zzz, drawn]` together as lines 70-73
  already do for the zzz coming on); or
- (b) a real drawing bug: the town skips frames when nothing moves (idle/dirty-frame logic), so a zzz cleared by a server beat with no
  other change isn't redrawn and stays on screen for a player. Check the frame loop's redraw triggers for a remote player's `zzz` change
  (town/render.ts, paint-gl.ts, the state the beat updates). If (b), it's a player bug: fix the redraw, and the test as is should then pass.
Reproduce first (repeat the test, desktop project; try CPU slowdown). PR body (`.pr-body.md`): cause with evidence, fix, player-visible
changes, checks changed old → new, tests run; a short decision note. No eric.md guard edited. Push at each real step, write `.done`, stop.
Don't open PRs or wait on CI. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
(no Co-Authored-By). Budget about 45 minutes. Another helper is working in town loading (`claude/town-atlas-pages`: keep-pictures.ts,
paint-gl.ts kept pages, render.ts restore): stay out of those parts unless the cause is there, and say so if it is.
