# Birdie: no tail on his armored figure; his train smooth on the board (Nov 23). Opus high, boss lane

Eric (Nov 23, with a screenshot of the battle's boss panel, the armored Birdie at "BOSS · move 5", a long brown tail hanging between his legs
to our left): "Why does he have a tail all of a sudden in this picture? ... birds don't have tails like this. So he looks like he has a
full-grown tail, so send that back to get removed." And: "the GIF in the game, like the animation for the train part, it's really like
choppy. ... It looks like it's like 5 frames when it should be closer to ... at least it needs to feel smoother than that. ... If we need
to draw more frames, then that's fine. I don't think it should cost that much from a performance standpoint."

Start: `git fetch origin main && git checkout -B claude/birdie-tail-smooth origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, Birdie's area page. Effort high: drawings and animation timing.

1. **The tail goes.** Remove the `tail` layer from his armored figure (`packages/app/src/characters/birdie-armored.ts` ~294 and its `L("tail")`
   ~341) in every animation, and from the armored cutscene (`birdie-cutscene-armored.ts` ~389, `tailName` in `HIM` ~648). This removes a
   part of the art; it draws nothing new (no paid run needed). Check nothing was hiding behind it that now shows a hole, and that the
   boss panel's portrait (`portraits.gen.ts`, if it's generated from the figure, regenerate it with the repo's own script) loses it too.
   Leave the plain dove's town sprite and his fall cutscene as they are (a normal bird's tail there; the director tells Eric they can go too).
2. **The train smooth.** Find every place his train crosses the board: his ordinary move if a train carries his piece, and his power's
   ride ("his train's ride: he ducks in and it pulls away ... while it crosses the board", kits.ts ~1170-1210, `Birdie.tsx`,
   `effects/birdie.ts`). Measure what makes it choppy (frames per second of its movement on screen: is its position stepped with the
   sprite's frames instead of moved every animation frame? too few sprite frames? a long `ms` per frame?). Fix the cause: its position
   moves every display frame (smoothly eased), and its own wheel/smoke loop runs at least as many frames as the town's Birdie's Train ride
   does. If the art truly has too few frames, say so in the PR body with the numbers and the director orders a paid art run; don't draw
   frames by hand. Watch it frame by frame with real taps (`npm run frames:boss`; if it can't pick an admins-first boss, note it and use
   whatever the boss kit's preview offers), phone and computer, and keep the frame rate (one `@perf` run if the drawing or frame loop changed).
3. Prove: typecheck; the unit tests you touched; the boss kit (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts` for Birdie);
   stills on a new orphan branch `stills/birdie-tail-smooth`: the boss panel before/after (no tail), and a strip of 8 consecutive display
   frames of the train crossing before and after (phone). `NOTE.md`. Decision note of about five lines. Area page. PR body in `.pr-body.md`
   (what changed, player-visible, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name. American English.
