# The Stranger's farewell in the tower lobby, after you first beat him (Eric, Nov 27 ~23:00 UTC). Opus, high. Town + boss lane

Read `notes/briefs/rules-common.md` first, then `docs/areas/battle-tower.md` (the tower's inside: the clerk, the elevator, where the
floor's boss stands/walks), `docs/areas/bosses.md` (the Stranger), `notes/briefs/stranger-polish.md` (item 5: the blue "now available in
Boss Battle" pop-up) and `.claude/LESSONS.md`. Branch `claude/stranger-farewell` from `origin/main` (after `claude/town-return` and
`claude/stranger-polish` have merged: build on both).

**Eric:** "when you beat the Stranger for the first time and it goes back to the lobby, I want him to still be there ... even if you
exited completely and went back in, he would still be there until he stands there and says something like 'I hope you don't think that
was my real strength', and then pauses for a second, and then as he turns and walks out ... instead of walking back upwards, he goes
down the other way, the way we exit, and right before he disappears at the door, he says 'I'm looking forward to our next battle.'"
1. A pending farewell, kept server-side with his unlock (`boss_unlocks`: a "farewell seen" time, or the account's notice flags the
   Welcome Crate's notice uses: reuse whichever is already there; a migration only if needed, then full lane), set when you first beat
   him on a tower floor, cleared once the farewell has played to its end. Survives reloads, closing the app, another device.
2. In the tower lobby, while it's pending: he stands in the lobby (where a floor's boss is shown), says line 1 (Eric's, in his voice:
   "Don't think that was my real strength."), a beat (~1 s), turns and walks out DOWN toward the lobby's exit door (the way the player
   leaves), and just before he vanishes at the door says line 2 ("I look forward to our next battle."). Then the blue pop-up "The Stranger
   is now available in Boss Battle" (move it here from the end screen if stranger-polish put it there, so it shows once, after him).
   About 8-10 s; your walking isn't blocked; lines in his voice style (two rows at 320 px, under 48 characters).
3. Only the first time (the first unlock). Admins testing can replay it with a test switch.
Tests: unit (the flag set on the first win only, cleared after the scene), one e2e (beat him on his floor via the test switch → Back to
the tower → he's there, the two lines, he leaves by the exit, the pop-up; a reload in the middle: it plays again from the start).
A GIF for Eric (orphan `stills/stranger-farewell`). `.pr-body.md` (at most 40 lines), decision note, area pages, `.done`.
