# Brief: root-cause the rides test's "beside you" failure (Opus high)

Worktree `/home/user/cr-besideyou`, branch `claude/fix-beside-you`, from main f5e73337 (#504 merged). Ports 8994, inspector 9494.
Include notes/briefs/rules-common.md.

## The failure
Main's push run 42076937566 (f5e73337), job "the town on WebGL, webgl-phone" (SPECS: town-desktop, town-tags, town-webgl, town;
env VITE_TOWN_GL=1, TOWN_GL_BUILD=1), failed both tries:

    [phone] e2e/town.spec.ts:1355 rides (...)  Error: beside you: 23,17   Expected [23,17]  Received [22,17]   (town.spec.ts:1421)

A tap on the square right beside you (c0+1) didn't walk you there within 5 s. The PR run of the same head (a119de03) passed it, and
#503's main run passed it. The same test failed the same way on Nov 1 (60975fa, "beside you: 22,17", phone both tries); the rides v2
PR (#442) put it down to the camera settling and changed the test. It's back, so that wasn't the whole cause.

#504 is the street town (admins only, `STREET_TOWN`). Its diff to the regular town's input path is `look.release()` in onUp/onCancel
(inert unless grabbed). I don't think #504 caused it, but prove it either way.

## Do
1. Reproduce it: run that test on the WebGL phone build (as CI's shard does) repeatedly, under load like CI's (the shard's other specs,
   or CPU throttling). Also try main's previous head 6ce41d19.
2. Find the real cause: why a tap on the square beside you can fail to walk you there. Candidates to check, not conclusions:
   - the tap landing on your pawn's or ride's box (taps take the pawn's box) on the phone's WebGL view;
   - `squareSettled` reading a position before the camera, zoom or ride frames settle;
   - press/drag threshold or a tap swallowed during a card's close;
   - a bot or rider claiming the square.
3. Fix the cause. If it's in the app, fix the app; if it's only in the test, make the test aim correctly, not wait longer.
   Never skip, loosen or quarantine the check.
4. Show it passing repeatedly (e.g. 20 of 20) on the WebGL phone build, and the town area's e2e still green on phone and computer.

## Done
- Report: the cause (with the evidence), the fix, the runs, and the changed checks old → new.
- PR body in `docs/pr-bodies/fix-beside-you.md` (lane: full e2e if app code changes, else the town area). Don't open the PR.
