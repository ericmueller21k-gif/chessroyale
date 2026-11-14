# The Hidden Boss's transformation, mockup round 2 (Eric, Nov 14): then build it

Effort high (animation, lighting, sprite art). Boss lane. Continue on branch `claude/recluse-transform-book` (round 1's mockup lab:
`packages/app/src/dev/recluse-transform-lab.tsx`, `scripts/preview-recluse-transform.mjs`; round 1's stills, GIFs and README with the
beat timing on branch `stills/recluse-transform-book`). Read round 1's README first, then `docs/areas/bosses.md`, `.claude/LESSONS.md`,
CLAUDE.md "Simple beats flashy". Never write the Hidden Boss's name in player text, commits or PRs.

Eric's notes on round 1 (his words, Nov 14):
1. **Arms:** "his arms like this need to change… his arms should just be in a more relaxed position to his side the whole time" (no
   raised arms at any point).
2. **Eyes:** "make his eyes totally white like he's possessed" as the light takes him.
3. **The light:** "the light needs to keep emitting more and more until it totally engulfs him and shoots up, even off the board,
   off the screen… it radiates in all directions and totally flashes and whites out the whole screen… a way cooler build-up." The
   light still pushes his hair back, as now.
4. **The change happens unseen:** "don't make him a cyborg until after that. Make the transformation happen when you can't even see
   it" (during the white-out).
5. **His final form, redone (no cyborg, no half robot):** "put a cool visor on him that looks really robotic, and you can see little
   matrix-style text flowing on it." A futuristic visor across his eyes: an original design (Eric: "not really like" a famous anime
   scouter; don't copy any known design). The flowing text: tiny glyphs/code scrolling across the visor's glass, cheap to draw (a few
   pixels per column, looping). This is his look for the rest of the fight: his figure, the boss bar's bust, the four boards' figure,
   anywhere his phase-2 look shows today (the engine eye overlay `EngineOverlay`/`placeEngine` in `components/Recluse.tsx` is the
   current per-frame head overlay: the visor can ride on the same mechanism).
6. **The reveal:** "then it comes back down… it dies back down to the center, and then it shows him [with the visor]. And then
   that's when he says the thing about the computer and the creativity" ("Computation without creativity is nothing. Now I have
   both." after the reveal, not during the build-up).
7. **A bug to fix in the build:** "the back of the chessboard should be gone the moment the board starts splitting. You should never
   see that big chessboard like that. You can see it hiding behind the 4" (his screenshot: the full board visible behind the four
   splitting boards). The single board is hidden from the split's first frame.
Keep from round 1: the book opening at his feet and its light (the summoning's look), the ghost kid beside him until the reveal (fade
him in the white-out), the lens/vignette until the reveal, the jump and the split landing on `recluse-phase3`'s drop, no God King
absorption (he stays in his place, greyed in phase 2, as #703 left him).

**Mockup first:** update the lab, then a GIF per platform (phone, computer) from the cutscene's last line to PHASE 2, stills of the
key beats (relaxed arms + white eyes, the light at full, the white-out, the reveal with the visor, the visor close-up with its
flowing text, the split's first frame with no big board behind), and the beat-by-beat timing (lined up with `recluse-phase3`'s intro
and drop). Push them to `stills/recluse-transform-book` (replace round 1's, keep its README's history), write `.mockup` (content: "round
2") to `claude/recluse-transform-book`, and wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/recluse-transform-book && git show origin/claude/recluse-transform-book:.go 2>/dev/null | grep -q round2; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go` (it will contain "round2" and any notes).
**On go:** pull main, build it in the game (solo and online, phone and computer), remove the King's absorption (server/protocol pieces
too, if any: list them), keep the boss kit and the split-on-the-drop test green; watch it frame by frame with real taps
(`npm run frames:boss`); one still per platform of the reveal; `.pr-body.md` (what changed, player-visible, checks old -> new);
`.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only).
