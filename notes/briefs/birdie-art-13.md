# Birdie's fall, a happy free fall (Nov 23). Art session, paid runner only

The runner's brief is written: `scripts/boss-art/briefs/arena-birdie-fall-fun.md` on `claude/boss-art`. **Don't rewrite it** (you may only
fix a path). Its starting drawing is already in place: `scripts/boss-art/out/arena-birdie-fall-fun/arena-birdie-fall-fun.ts` (a copy of the
approved third pass, id renamed). Follow `notes/RULES.md` on `claude/director-notes` on art (the paid API draws; never by hand; never print
the key). Ask Eric once for the spend (one run, cap $4) and go on when he says yes. Start: `git fetch origin claude/boss-art && git checkout
claude/boss-art && git pull`; `git pull --rebase` before you push; never force-push.

1. Render three reference pictures into `scripts/boss-art/refs/arena-birdie-fall-fun/` with a small script (delete it after):
   `fall-now.png` (the third pass's `fall`, all 5 frames side by side, 2x, from `scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts`),
   `approach-now.png` (its `approach`, all 9 frames, 1x), `birdie-joy.png` (`BOSS_BIRDIE`'s `victory` frame 0, 4x, from
   `packages/app/src/characters/birdie.ts`). Refs stay local (the folder is git-ignored; the runner reads them from disk).
2. Run: `npm run boss-art -- arena-birdie-fall-fun scripts/boss-art/briefs/arena-birdie-fall-fun.md scripts/boss-art/refs/arena-birdie-fall-fun`
   with the same effort and a cap of $4 (`BOSS_ART_CAP_USD=4`; see `scripts/boss-art/README.md` for how the third pass ran).
3. Stills on a new orphan branch `stills/birdie-13`: `fall-before-after.png` (the third pass's `fall` frame 0 beside the new one, 3x),
   `fall-new.gif` (the new `fall` loop), `approach-new.png` (all 9 frames). `NOTE.md`: the spend and the run's own notes. Commit the
   drawing on `claude/boss-art`. `.done` on the stills branch, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Never write the Hidden Boss's name.
