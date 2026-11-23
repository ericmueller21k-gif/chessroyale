# Birdie's happy fall, beak fix (Nov 23). Art session, paid runner only

The runner's brief is written: `scripts/boss-art/briefs/arena-birdie-fall-beak.md` on `claude/boss-art`. **Don't rewrite it** (you may only
fix a path). Its starting drawing is in place: `scripts/boss-art/out/arena-birdie-fall-beak/arena-birdie-fall-beak.ts`. Follow `notes/RULES.md`
on `claude/director-notes` on art. Eric said "Yes ok to spend" for this in the director's session (Nov 23); if your rules need his yes
directly, ask him once (one run, cap $3) and go on when he says yes. Start: `git fetch origin claude/boss-art && git checkout claude/boss-art
&& git pull`; `git pull --rebase` before you push; never force-push.

1. Render two reference pictures into `scripts/boss-art/refs/arena-birdie-fall-beak/` (a small script, deleted after; refs stay local):
   `fall-fun-now.png` (`arena-birdie-fall-fun`'s `fall` frame 0 at 3x, from `scripts/boss-art/out/arena-birdie-fall-fun/arena-birdie-fall-fun.ts`)
   and `birdie-beak.png` (`BOSS_BIRDIE` from `packages/app/src/characters/birdie.ts`: a frame of `victory` or `capture` with his beak open,
   cropped to his head, 4x).
2. Run: `BOSS_ART_CAP_USD=3 npm run boss-art -- arena-birdie-fall-beak scripts/boss-art/briefs/arena-birdie-fall-beak.md scripts/boss-art/refs/arena-birdie-fall-beak`
   (the same effort as the happy fall's run).
3. Stills on a new orphan branch `stills/birdie-14`: `beak-before-after.png` (the happy fall's `fall` frame 0 beside the new one, 3x, and a
   close-up of the head before/after at 6x), `fall-beak.gif`. `NOTE.md`: the spend and the run's notes. Commit the drawing on
   `claude/boss-art`. `.done` on the stills branch, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Never write the Hidden Boss's name.
