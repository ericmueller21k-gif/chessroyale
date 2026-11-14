# Flaky round 4: the causes (Nov 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Each test asked first: is the game wrong, or the test?

- **Test, shared: a town tap read from one frame and landed on another** (sound:61, town.spec's bot and table taps). A spec read a
  figure's point (`__townAt`), then clicked through two or three more round trips; a figure walking about moved off it first. Logged:
  Big Boy read at x 117 in his box 57 to 177, tapped as he stood at 127 to 247, so the tap opened "Big Boy's Crib". Main 5 of 12 failed
  locally (`--repeat-each 12`), now 12 of 12 pass. `townTap` (e2e/helpers.ts) holds the town's frames (`__townHold`, the existing switch)
  in the frame its point is read, taps, and lets them go: the frame on screen is the one the point came from. `tapInTown` uses it.
- **Game (test hook): a tap point on the edge of what's clear** (found by the above). `__townAt` gave Glim's point 0.2 px above your
  pawn's box; the tap's whole pixel landed on your pawn and nothing opened. With the frames held it failed every time (6 of 6). The
  hook's points now keep 2 px of room on their target (`clearAt` in render.ts); 4 of 4 pass.
- **Game: a card painted before it was placed** (town:1055 "card stays put", found by the held frames). A card's place was set only in
  the town's next frame, so as it opened it showed for a frame where the last card was (or at the box's top-left), then jumped: what a
  busy phone shows too. The screen now places it in a layout effect as it opens (`placeCard`).
- **Test: the bot across held after its 4 s were up** (town:701, new on main 5ff1663). After a reload the bot across your table gets
  up `botLeaveAfterGameMs` after the town's first frame; the test held it after the attribute poll and an evaluate (1 to 1.3 s locally,
  more on CI). It's now held from the page as that frame is drawn. Proof: a 3.5 s pause added after the ready wait fails the old test
  2 of 2 (the bot at 16,27 and 21,27) and passes the new one 2 of 2.
- **Game: a Go up tapped twice** (found reading hidden-boss-room:313's path). A Go up tapped again while the server answered the walk-up's
  top floor was kept (`passNext`) and went through to the top again as the top faded in, or after "The door is locked." at the next
  room's fade. That second tap is the same climb now, and a way through to the room you've just come into is dropped.
- **Test: the walk-up's door read once, never glided back** (town-street:528): a missed tap walked you off and every later look found
  it off screen. It taps through `tapInTown`, as Meadow Street's homes now do. Meadow Street's 500 (town-street:155) names its address
  from now on; which request it was isn't known.
- Not done, listed in the PR: alfil:247, town-chat:1370, fairplay:65 (a guard), shop:238, and town:1049 (not reproduced, 6 of 6 locally;
  likely the same walker in front: its tap now waits for a clear point).
