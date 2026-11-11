# Flaky batch, Nov 11

Main's full run went red 4 runs in a row on tests that passed only on their retry (brief: `notes/briefs/flaky-batch-nov11.md`).
Each fixed at its cause; no retries, skips or sleeps added.

| Test | Cause | Fix |
| --- | --- | --- |
| town-chat:1410 (name tap menu) | **App bug.** The line menu's Escape and tap-away listeners were in a `useEffect`, which waits for a paint: an Escape straight after the menu opened was lost. | Layout effect (`TownChat.tsx` LineMenu). The spec now also presses Escape the moment the menu is in the page (fails on the old build, passes now). |
| shop:1480 (Shop tab page) | **App bug**, the same: the pop-up's Escape listener was a `useEffect`. | Layout effect (`Shop.tsx` ShopPop). The spec presses Escape the moment the pop-up is in the page (fails on the old build on both projects, passes now). |
| squads-play:304 (party sheet Escape) | **Test race.** Its watcher fired on any `[role="dialog"]`, and `index.html` always holds one (the hidden "Turn your phone upright"), so any change to the page before the sheet opened sent the Escape too early. | The watcher waits for the sheet itself (`.sq-party`). |
| squads-replay:125 (Relay replay) | **Test race.** A replay of one move lasts 0.5 s; its name tag came and went between two looks of `toBeVisible` (CI's snapshot: replay over, "free 0.8"). | Read from the spec's own 40 ms watcher (running from before the replay), now counting only visible tags inside `.rp-over`. The three looks before it (the replay's board, "replay x of y", the replay icon) had the same race (one failed locally, desktop): the watcher records them too, and one sample must show all three together. |
| panel:82 (panel never empty) | **Test race.** After a reload the match is on `window` before its screen is drawn; the first look read `.screen.game` as null and threw. | A look with no game screen sees no layout, and the check looks again (the assertions still need the wanted layout). |

Left open:
- **boss-challenge:155** (server's lines after Back to town): not reproduced (6 of 6 locally). On the failing try the town's chat log was
  empty for 15 s while the server held both lines (the retry's first `/api/live?town=0` had them). It came with #635 (friends page:
  `?doing=` and `setLiveDoing`'s immediate poll in `live.ts`) on both its PR run and main's merge run, and #639 (town loading) has
  since changed how the town opens. Read and ruled out: the server's read cache, the feed's room/`last` logic, a second chat mount, an
  account change. Next: log the feed's `take` (sink set or not, the slice) in the page on CI.
- **timber:79**: page errors "Cannot read properties of undefined (reading 'signedIn' / 'name')": a profile without `user`
  (`account().profile?.user.signedIn` throws on `{}`). `api()` turns an unreadable 2xx body into `{}`; the spec's `asAdmin` route
  rewrites `/api/me`. 25 loads through `asAdmin` locally: no error. Not fixed.
- The older list (brief) not reached. town-chat-history:57 is #639's.
- Eight more pop-ups add their keydown listener in a `useEffect` (ClawMachine, BossParty, Friends, GlobalChat, Crates, Home ×2,
  PublicProfile, TownMap): the same lost-Escape bug. Not changed here (untested paths); a small follow-up.
