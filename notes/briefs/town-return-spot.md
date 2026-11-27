# Back to town lands you where you were (the Battle Tower), and the town never loads twice (Eric, Nov 27 ~22:25 UTC). Opus, high. Targeted

Read `notes/briefs/rules-common.md` first, then `docs/areas/town-square.md` and `docs/areas/battle-tower.md` (entering the tower from the
town, its clerk, a floor's end screen and its buttons) and `.claude/LESSONS.md`. Branch `claude/town-return` from `origin/main`.
**Eric:** "after I fought Big Boy [floor 9], and I did the early end just so I could get past it ... when I hit back to town, it kind of
choked up and it loaded the town twice, and then it didn't bring me back to the battle tower. ... keep a save on someone's account ...
when it reloaded the town, it should have just put me right back in front of the clerk at the battle tower inside. That way I don't
feel like the game crashed ... if the last spot you were was in the battle tower and you closed out of it, then the next time you load
into the town, it should take you right back there."
1. **Find why the town loaded twice** after a tower floor's early end + "Back to town" (reproduce it: a floor, the early end, the button),
   and fix that cause (a double navigation, a remount, two loads racing). Prove it with a check that the town's load runs once.
2. **Back to town from the tower** puts you inside the Battle Tower in front of the clerk (as when you walked in), never the plaza.
3. **Remember the last town spot:** the room you were in (the tower's inside, a shop, a home...) and where, saved as you move between
   rooms (not every step); the next town load (a reload, closing and coming back) starts you there. Signed in: saved to the account
   (server, a small field with the profile; no new table if one fits; a migration only if truly needed, then say so: full lane) so it
   follows you across devices; a guest: this device only. A room that no longer exists or can't be entered: the plaza, as today.
Tests: unit tests for the saved spot (save, load, a bad spot), one e2e (a tower floor's end → Back to town → in the tower at the clerk,
town loaded once; a reload → still there). `.pr-body.md` (at most 40 lines), a short decision note, area pages, `.done`. Commits end only
with your Claude-Session line.
