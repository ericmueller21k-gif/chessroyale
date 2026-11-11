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

## Batch 2 (same day, branch `claude/flaky-nov11b`, on top of batch 1)

Each fixed at its cause; no retries, skips or sleeps added. One wait added, for a real thing: the camera at rest (shop) and the layout
after a resize (boss-dock), each capped.

| Test | Cause | Fix |
| --- | --- | --- |
| boss-dock:54 [phone] (row at 844×390, 122 px off) | **Test race.** The row is lined up with the board by a ResizeObserver, which runs before the turned screen's first paint; the God King stepping beside the row shrinks the board a frame later. Read straight after `setViewportSize`, a forced layout saw the row where it stood upright (122 px, CI's number exactly; 2 of 3 locally with a frame sampler). The first painted frame is right. | Measure once the board's, row's and God King's boxes hold for three painted frames (`settled`, at most 2 s). |
| zebra:84 [desktop] (dough timer 4, wanted 3) | **Test race.** Your move's minute comes off in `finishRound`, once the judge has scored the move: over 5 s on CI's desktop, past the poll's default 5 s. | The spec's per-frame watcher records the first lump's minutes as they change; after his move, they read exactly `[4, 3, 2]` (stricter: the order, every frame). |
| boss-powers:144 [phone] (`p4.allowed` null) | **Test assumption.** `allowed` is null by design when the powers take no legal move away (`crowdAllowed`): after the first thaw the pieces still iced had no moves. | `mayPlay`: null reads as every legal move, and the same checks hold against those (also for the freeze and the blizzard). The guarded banner checks (Eric's rule, Nov 5) are untouched. |
| shop:1124 [desktop] (`goIn`: home not drawn for 20 s) | **Test race.** The first tap was aimed while the camera still moved (gliding to Hollow Peak, zooming back after a room): the point moved 30 to 180 px in 100 ms, the tap missed, walked you off, the camera followed you and the home left the screen for good. Also the older list's shop:1094. | `homeStill`: a home's tap point once it has held for three painted frames (at most 3 s). The guard's own checks are untouched; the helper is in a guard's file, so Eric's OK is asked in the PR. |
| timber:79 (profile without `user`) | **App bug.** `api()` turned a 2xx body it couldn't read (cut off: the local server logged a broken connection 25 s before) into `{}`, and `{}` became your profile: every read of `profile.user` threw. | `api()` fails an unreadable answer like a server error (502): the profile is asked again once, and never replaced by one without its user. Unit tests (both fail on the old code). |
| 8 pop-ups' `useEffect` key listeners | **App bug** (batch 1's): an Escape pressed as the pop-up opened was lost. | Layout effects: claw machine, friends invite sheet, global chat gear menu, crate reveal, Home's boss picker and its sheet, public profile's sheet, the town's large map, and the walkthrough (found by a scan; BossParty already had one). No new spec checks. |

Left open:
- **boss-challenge:155** (empty town chat after Back to town): still not reproduced. Read and ruled out more: the account (the chat
  re-reads `mayReadTownChat` on every account change), the server's answer (it holds the lines). Three ways the log can stay empty
  remain: the live poll's request never answering (`live.ts` had no timeout, and `poll()` is skipped while one is in flight, so a stalled
  request stopped the town chat for good: **an app bug, fixed here** whatever this flake's cause, given up after
  `FRONT_DOOR.liveTimeoutMs`, 10 s, with a unit test that fails on the old code), a stale `last` from a rider removed while its request
  was out (`feed.take` is shared), or the server's `townSlice` failing (`.catch(() => null)`). The spec now records every `/api/live` request, answer (its town slice) and
  failure, and prints them with the chat log's lines if the server's lines don't show: the next CI failure says which.
