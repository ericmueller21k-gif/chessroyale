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

**UPDATE, Eric ~22:40 UTC (now the top job; it happened twice in a row):** "I just triggered to beat him [the Stranger, his tower
floor], and then it reloaded the game right after ... I hit back to the battle tower, and then I tried to move for a second, it just
glitched and it reloaded the game again. ... we need to see why this is getting redrawn so much, or where the bugs are happening when
you exit from the end game and try to get back into the battle tower. Maybe it needs its own unique load ... it looks and says, okay,
you are on floor whatever, and then it actually does a full reload onto that thing, so you're not running into these glitchy situations."
- He's on a phone (iPhone Safari likely). "Reloaded the game" on its own, twice, right after a boss battle and again on moving in the
  town, smells like the tab being killed for memory (iOS reloads a page that ran out of memory) or an uncaught error that resets the app.
  Rule each in or out with evidence: measure memory across a tower floor (a boss with big art: the Stranger's storm sheets ~19.5 MB,
  released on unmount since #1023; Big Boy) → end screen → Back to the tower → walking (the town's atlas pages are 16 MB each); look
  for anything not released (boss art caches, canvases, ImageBitmaps, the town's atlases kept while a battle runs, listeners). Also any
  error path that reloads the page (`location.reload`, an error boundary, a service worker update) after a battle.
- Fix the causes. Eric's idea, which you should build: going back to the tower from a floor's end screen is its own clean entry,
  "you are in the Battle Tower on floor N", that tears the battle down first and loads the tower inside directly (in front of the
  clerk), never via the plaza and never twice. Prove: a test that the town/tower loads once; a memory number before/after on a slowed
  phone profile (heap and decoded images) across battle → tower → walk, twice in a row.
Effort high. The ranked tables job is paused for this.

**Eric, ~22:50:** both times he'd left mid-battle (app switch; then a full browser close). The cold load resumed straight into the
battle (good). He finished, "Back to Battle Tower" showed the tower, and on his FIRST tap to walk the game reloaded. Suspect: a page that
cold-loaded into a battle never set the town up, and the return is a shortcut assuming it. Eric's call (and the director's): "Back to
Battle Tower" is a clean, verified entry (tear down, load the tower fresh like a cold load into it, show it when ready; a real page
navigation if that's simplest), plus fix the first-tap reload's cause. e2e: that exact sequence.
