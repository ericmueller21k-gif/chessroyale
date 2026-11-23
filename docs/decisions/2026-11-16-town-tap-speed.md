# Town specs' time and flakes: their causes (Nov 16, 2026)

Audit T1/T3 (`claude/director-notes`, pipeline-audit-2026-11-16.md): shop, town-chat, town-afk and boss-challenge grew 50 to 90 % with no
new tests. Profiled from traces (shop and town-chat on a phone, locally): the time is the WebGL street town itself, not the tap helper's
checks. Since Nov 13 every spec's town is the street town (the old Canvas 2D town is gone), and on software WebGL a frame takes 70 to
220 ms with the GPU process busy, so a town load takes 5 to 9 s and every round trip to a page with a town waits for it.

- **Test: `tapInTown`'s first try waited 3 s for a home off the screen.** 22 of shop's 25 taps missed it (3.3 s each) before the glide
  that brings it in. Now the first try gives up after 6 drawn frames with no tap point (`townTapPoint`'s `gone`; only where a glide
  follows). The read from a still view, the tap on the held frame and every check are as before. (The rest of a tap's time is the
  glide, about 2.5 s, and the walk, about 1.3 s: the game's own.)
- **Test: a signed-in town opened twice** (town-chat's `openSignedIn`, town-afk's `openIn`): as a guest's, then signed in. The account
  is now made by the page's own first `/api/me` before the town opens (`pageAccountId` already did this for a blank page). The test
  whose subject is that race ("signing in a page whose own first /api/me answers after the town shows") keeps the old steps.
- **Test: a pause read and sent in two round trips** (town-afk:116, reproduced on main locally): its 100 ms margin was shorter than the
  round trips; now 1 s, still well inside the 4 s it tests.
- **Test: a drag "without the hold" became a carry** (town-chat:1216 desktop, locally on main): the press and its first move were two
  round trips apart, past the 400 ms hold; they now go together (CDP), as the town's own drags do.
- **Test: shop:238's floor of 5 fps going out** failed a right reading (CI's street town drew 4 frames a second). It now checks what the
  bug did: no reading going out reaches back past the readings inside (each reading's window is the time back to the update two before).
- Not timing in the town, written up only: chat:80 [desktop] (an Eric guard; the phone's tapped move not picked in 5 s, a match board),
  hopper:212 (the battle not over 60 s after the loop). Not seen on main since Nov 14: town-leave:148, dash:241, town-chat:1054 and
  1367/1370 (fixed by Nov 14's notes and #747).
