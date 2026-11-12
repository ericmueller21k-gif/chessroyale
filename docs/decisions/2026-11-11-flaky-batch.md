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

## Batch 3 (Nov 12, branch `claude/main-red-nov12`)

Each fixed at its cause; no retries, skips or sleeps added. Proved with `--repeat-each 5`, both projects, under the e2e lock.

| Test | Cause | Fix |
| --- | --- | --- |
| zebra-home:93 [desktop] ("the guard is drawn": null; failed both tries on main's b7cb743 run and on #646) | **Test hook.** `__shopAt("guard-b")` gave the guard's middle, null when off screen. On a computer, with the camera at rest on you at (10,13), both guards' feet are below the room's bottom edge, so his middle was off screen while a finger could still tap his head and chest (`guardAt`'s box). It passed only while the camera still glided after your walk (CI's trace: null for 20 s from the first look; locally null after a 4 s wait). Not #641's floor change or #643's music. | The hook gives the middle of the on-screen part of his tap box (null only when under 12 px of him shows). The spec taps once the camera rests on you (stricter: fails on the old build, passes now). 10/10. |
| boss-challenge:155 [phone] (the server's lines after Back to town) | **Test environment.** Batch 2's recorder showed it: after the second battle the town came back in a new room (`181310af`, empty) while the old one (`7957c1db`) held the challenge line. The town's chat lives in the live hub's memory, and a restart opens a new room (by design, docs/areas/chat.md). The local server frees an idle Durable Object within seconds (11 s on CI); on Cloudflare every app's 30 s heartbeat keeps the hub in use (eviction there is after 70 to 140 s idle). Reproduced locally: 45 s on the result screen gave a new, empty room. | A reader asks `/api/live?town=0` every 1.5 s for the whole test, as the town's other visitors would; the same 45 s wait then passes. 10/10. |

Read, not fixed (left for the next batch):
- **boss-bar:204 [phone]**: `animationName` read as `""`, which `getComputedStyle` gives only for an element out of the page: the level
  badge was replaced between the locator's find and its read. The badge is keyed by direction (`Boss.tsx` `BossLevel`, `key={dir}`), so a
  replacement while lifted means the level flickered (lifted, its own, lifted) or the bar remounted: either replays the gold "pop"
  mid-Moon, which a player would see. Next: watch `data-level` and the badge's node every frame through the Full Moon.
- **autochess-board:248, :274, :373 [desktop]**: `.ac-root` not in the page 5 s after `goto`, three tests in a row on one worker, then
  each passed on its retry: the page or the server was stalled for that stretch, not the tests. No trace kept.
- **shop:870 [phone]** (Ginger Igloo, ArrowLeft never reached 10,4 in 10 s): the kept trace is the passing retry's; nothing to read.
- **multiplayer:18 [desktop]**: the power-up showed 2 hints (13 looks), then 0 (the phase moved on), wanting 3. `hintsFrom` shows
  the search's top 3: the search returned 2 lines. Its trace is 742 MB; not read.
- town-leave:148 and global-chat:46 (PR runs only): not reached.


## Batch 4 (Nov 12, branch `claude/main-red-batch4`)

Each fixed at its cause; no retries, skips or sleeps added. Two of the four are **app bugs** a player would meet. One wait made longer,
for a real thing (a chat line that waits its turn, below). Proved with `--repeat-each`, under the e2e lock.

| Test | Cause | Fix |
| --- | --- | --- |
| boss-bar:204 [phone] (`animationName` `""` mid-Moon) | **App bug.** The match's screens are one component per phase, so the boss bar and its level badge are put in the page anew twice a move. The lifted badge's gold pop (560 ms) replayed at each: about nine times in one Full Moon (logged by a MutationObserver, with the phase). The test's `locator.evaluate` could also land on a badge just replaced (a detached element's computed style is empty). | The badge carries on its animation from when the lift or slash began (`levelSince` in `Boss.tsx`: a negative `animation-delay`), so it plays once. The spec records every lifted badge put in the page and fails if one drawn after the pop is over plays it again (fails on the old build: 9 replays; passes now, 5/5), and reads the reduced-motion style in one `page.evaluate`. |
| town-leave:148 [phone] (still in the room after Back) | **App bug.** `goOut` returned at once while the door was busy, and it stays busy until the room's warm-up frames and the 260 ms fade are done (up to about 1.3 s after the room is drawn): a Back or Go out tapped then was lost (CI's snapshot: Back focused, still in Babur's Circus). | The tap waits for the room, then goes out (`outNext` in `Town.tsx`; not while already going out; cleared when a new way in starts). The spec, on a phone, taps Back from the page the moment the room is drawn: fails on the old build, 6/6 now; the whole spec passes on both projects. |
| global-chat:116 [desktop] ("Chat is busy" never showed) | **Test timing.** The test chat's cap was one line a second with a 2 s line: three rushes fill it and a fourth is busy only if it reaches the server within 1 s of the first. On CI it came later and was queued (its snapshot: "me too" shown fourth). With the Enter delayed 1.2 s it fails locally every time. | The test chat (test switches only) is one line every 3 s with a 6 s line (`TEST_GLOBAL_CHAT`): the same four players, a 3 s margin. Passes with the 1.2 s delay. The young-device check (:141) now waits 10 s for its own line: it can queue behind Ann's (up to 3 s), and a line that queued comes with the next live poll (every 5 s). Unit test updated (`[0, 3000, 6000, "busy"]`). 12/12. |

Read, not fixed:
- **autochess-board:248, :274, :373 [desktop]** (run 43115844651, shard 8): `.ac-root` never in the page; CI's snapshot shows the computer's
  front door with its column headed AUTO CHESS and an empty `main`: the screen's lazy chunk hadn't come. The job log has
  `ProxyWorker: GET /assets/AutoChess-….js recovered on attempt 2 after a dropped connection to the UserWorker` right after the first,
  and the same for `/autochess`, `/`, `sw.js` and the Stockfish wasm round the other two, among 24 broken-pipe or reset errors from
  workerd in that shard. The local server (wrangler dev) dropped its connections to the app's worker for those seconds: the test server,
  not the app on Cloudflare. Retries loaded in 0.1 to 0.4 s. Not reproduced locally. Next, if it keeps coming: the wrangler version, or
  what closes those connections (the broken pipes follow pages closed mid-response). Seen in passing: `lazyGroup` (`lazy.tsx`) shows a
  blank screen until its chunk comes and, if the import fails, doesn't ask again while that screen stays: a lost chunk on a bad
  connection leaves the screen blank until you leave it. A small follow-up (ask again after a second, a few times).
- **global-chat:266 [desktop]** (the right column at 1920 × 1080; seen here once in 9 local runs, not on CI's list): its tap on Babur's
  home missed (the home's point moved 225 px between looks: the camera gliding). Batch 2's `homeStill` (three still frames) never
  succeeded at 1920 × 1080 locally: a frame took 400 to 600 ms there and the point kept moving (125 to 179 px, undrawn between).
  Reverted; needs its own look.
- **global-chat:46**: passed 7 of 7 locally (no CI trace kept).
- **shop:870, multiplayer:18**: not reached.
