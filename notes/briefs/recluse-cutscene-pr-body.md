# The Hidden Boss's cutscene, wired into his fight

**Boss lane** (animation and timing; the scene, its poses and its timing, app side). Includes `origin/claude/hidden-boss-cutscene`
(the mockup) and `origin/claude/recluse-online-phase2` (#677, not merged yet: **merge #677 first**, or this PR carries it). Runs the
whole e2e suite: `playwright.config.ts` changed (the e2e server's `CUTSCENE_HOLD_MS`).

## What changed
- **The cutscene plays after his adult form is beaten and before his transformation, solo and online.** His fall (1.8 s), then the
  scene (104.085 s, `RECLUSE_CUTSCENE.holdMs`), then the phase change exactly as before (its timing untouched, so the music's cut
  and the server's `changeMs` hold): everything dims but the soft spotlight on the board's middle; he kneels in it; the ghost child
  poofs in above the board, drops, his knees buckle; Eric's 17 lines, each its own typed box (two sentences: type, 1 s, type); the
  child fades; the man alone a moment; the light lifts (`outMs`, 0.6 s, new) and the phase change carries on.
- **Solo:** `SoloMatch.cutscene` from the fall's end; the phase change starts as it ends. **Online:** from the server's
  `recluseCutscene` (`NetMatch.cutscene`, #677's `OnlinePhase2.cutscene`), everyone at once; `holdMs` is now the scene's length.
- App draws it over the fall's screen (`components/RecluseCutscene.tsx`, lazily in the game chunk). While it plays his figure in
  its place is hidden (`body.cs-on`) and both voices are quiet (`Voice.hush`: his fall's mumbling and the God King's remarks would
  talk over the scene).
- **His kneeling pose** in his sprite set (`kneel`, both drawings): quiet on his knees after the scene, a long look up where the
  child stood; his place in the phase change until he seizes the power (was the fall's mumbling `collapseLoop`).
- **Music:** his beaten theme (`recluse-beaten`, intro then its loop) plays on through the scene (`recluseMusic` already keys it on
  the fall with `toPhase2`); the transformation's theme comes in with the phase change as before.
- **His absorb line is paged** as the chant's lines are (`absorbPaced`): a sentence a page on the phone's bar, the chant's 1 s
  pause, gone by the same moment as before.
- **No skip**; the admins' 🏆 doesn't skip it. The name appears nowhere.
- Drawn ahead with his phase change (`prewarmRecluse`): the scene's arrival frames and his kneel.
- Tests only: a shorter hold plays the scene sped up to fit (`fitCutscene`: the child's frames as they are, the paced times
  shrunk by one factor; at its own hold it's unchanged): solo `?cutscene=SECONDS`, a test server's `CUTSCENE_HOLD_MS` (only with
  `TEST_SWITCHES`; the e2e's 12 s). docs/areas/ops.md lists both.
- `scripts/frames-recluse-cutscene.mjs`: the real fight frame by frame through the arrival and from the scene's end into the kneel.

Decision: `docs/decisions/2026-11-13-recluse-cutscene-wired.md`. Area page: `docs/areas/bosses.md` ("His cutscene").

## Player-visible
- After beating his adult form: the ~1:44 scene, then the transformation. Phone and computer.
- His absorb line on a phone's bar: two pages instead of one cut-off line.
- After the scene, he kneels quietly in his place (no mumbling) until he seizes the God King's power.

## Checks (old → new)
- `e2e/recluse.spec.ts`, "the admins' Win this form": now `cutscene=30` and watches the scene (the light, the child's figure, his
  place hidden, line 1 "Why are you on the floor?" and line 17 typed in full), the phase held at `boss` through it, then the phase
  change and the scene gone.
- `e2e/recluse.spec.ts`, "beaten in phase 1": `win=1` → `win=1&cutscene=6`; `absorbLine` (the whole line in one box) → its first
  page, plus `absorbLineB` (its second page).
- `e2e/recluse.spec.ts`, "the board keeps its size": `win=1` → `win=1&cutscene=6` (the scene's frames are watched too).
- `e2e/crowd-hidden.spec.ts`, solo Crowd: `+cutscene=6`.
- Online specs (`hidden-boss-room.spec.ts`, `crowd-hidden.spec.ts` online): unchanged; the e2e server's hold is 12 s.
- `packages/app/test/recluse-phase2.test.ts`: `phaseChangeRun`'s `before` `collapseLoop` → `kneel`.
- `packages/app/test/recluse-cutscene.test.ts`: new: the timeline's total = `holdMs` (and its parts from the settings), `fitCutscene`,
  the absorb line's pages, the kneel loop.
- No guard test of docs/rules/eric.md touched.

## Run here
- Typecheck; unit tests of app, server and core (292 files, 3982 tests) pass.
- e2e (phone) locally: recluse "beaten in phase 1", "Win this form", "keeps its size"; crowd-hidden (all three); hidden-boss-room
  (room challenge online through the scene into phase 2): all pass.
- Frames (`node scripts/frames-recluse-cutscene.mjs <dir> phone cutscene=20`, the real fight, a paused clock moved 40 ms a frame):
  the fall, then the light (dim from 1.84 s), the poof above the board, the drop, the landing with his knees buckling beside the
  kneeling man, line 1; and from line 15 to the end: the child's fade, the light lifting, then the phase change with him on his
  knees (`kneel`) in his place, the God King's line back. His place stays hidden from the scene's start until the phase change
  replaces the screen (a first run showed his fall's mumbling for 0.5 s in the sped-up test window's gap: fixed). No page errors.
  The computer layout wasn't framed (the scene's layout is the mockup's, reviewed by Eric on both).
- Not run: `packages/chess` unit tests (only #677's protocol change touches chess; CI runs them).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRrgyEXVs6KoeQYaGwX
