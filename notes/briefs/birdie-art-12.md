# Birdie's lobby, round 4 (Nov 23). Art session, paid runner only

The runner's brief is written already: `scripts/boss-art/briefs/shop-birdie-interior-4.md` on `claude/boss-art`. **Don't rewrite it** (each
rewrite lost Eric's words before); you may only fix a path in it. Read it all. Eric's own marked screenshot is already in
`scripts/boss-art/refs/shop-birdie-interior-4/eric-marks.png`.

Eric already said for this lobby "Just finish it don't care the cost"; still say the spend once here (one run, cap $8) and go on unless he
says stop. Follow `notes/RULES.md` on `claude/director-notes` on art (the paid API draws; never by hand; never print the key). Start:
`git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`; `git pull --rebase` before you push; never force-push.

1. Add two reference pictures to `scripts/boss-art/refs/shop-birdie-interior-4/` (render them with a small script, as the token run did;
   delete the script after): `lobby-first-frame.png` (`SHOP_BIRDIE_INTERIOR_3`'s idle frame 0 at scale 1, from
   `scripts/boss-art/out/shop-birdie-interior-3/shop-birdie-interior-3.ts`) and `park-table.png` (`PARK_TABLE` from
   `packages/app/src/town/houses/park.ts`, idle frame 0, at 3x).
2. Run: `BOSS_ART_CAP_USD=8 npm run boss-art -- shop-birdie-interior-4 scripts/boss-art/briefs/shop-birdie-interior-4.md scripts/boss-art/refs/shop-birdie-interior-4`
   (check `scripts/boss-art/README.md` for a room's exact form and effort, as rounds 2 and 3 ran; use the same).
3. Stills on a new orphan branch `stills/birdie-12`: `lobby-first-frame.png` (the new room, frame 0), `compare.png` (Eric's marked
   screenshot beside the new room), `gates.png` (both gates: idle, lower frames, down, at 4x), `table.png` (the chess table and its stools on
   the tracks, 4x), `bar-arms.png` (both raised arms and their stools, 3x). `NOTE.md`: the spend, and the run's own 8-line check against
   the brief's 8 changes, copied. Commit the drawing on `claude/boss-art`. `.done` on the stills branch, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Never write the Hidden Boss's name.
