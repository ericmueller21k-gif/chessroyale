Title: Start zoomed out inside a home and at a challenge; sound comes back after switching apps on iPhone

## What changed

**1. Inside a home: the further-out camera by default (Eric, Nov 3).** This reverses Nov 2's "Close is the default".
- Going into any home (Babur's, Puddles', Alfil's, Big Boy's) starts at the town's zoomed-in camera (`SHOP_FEEL.startZoom` 1).
  The − button shows pressed. + still takes you to Close, and − brings you back.
- A challenge's camera (`CHALLENGE_FEEL.cam`) is now at zoom 1 too (across was 0.8, facing 0.6; facing isn't used by any room). Its
  aim is kept. You, the boss, the table and both stools are in view on a phone and a computer (stills below).
- docs/decisions/2026-11-03-home-zoom-out.md; docs/areas/town-square.md updated.

**2. iPhone: no sound after switching to another app and back (Eric, Nov 3).** Eric then confirmed it from outside Big Boy's
Crib with no challenge involved, so the cause is the app switch. I checked the challenge path (town → challenge → battle →
result → Back to town → challenge again). Nothing there mutes, suspends, closes or replaces the audio context. There is only
one context, and `setMuted` is called only by the mute toggles.
- iOS suspends or "interrupts" the Web Audio context while the page is hidden, and doesn't always let `resume()` bring it back.
- `sound.ts`: when the page comes back (`visibilitychange` to visible, `pageshow`, `focus`) it tries `resume()`. On the **first
  tap or key** after that (`wakeAudio`, now a capture listener in main.tsx so it runs before the page's own handlers), if the
  context isn't running with its clock moving (suspended, interrupted, closed, or "running" with a stopped clock), it is
  replaced:
  - a new context and master chain are made inside that tap, and the old one is closed;
  - the boss sounds are warmed again (the cache is keyed by sample rate);
  - the decoded sound files are reused, since an AudioBuffer works in any context;
  - that tap's own sound plays as the new context wakes.
- Nothing plays while the page is hidden, so nothing bursts out on the way back.
- `<audio>` sounds: the only HTMLMediaElement sound is the Colosseum's streamed ambience. An element stays wired to its first
  context for good, so after a rebuild it moves to a new element at the same point (`onAudioRebuilt`). The piece sounds in
  public/sounds/ are fetched and decoded as buffers, not elements, so they recover with the context.
- docs/decisions/2026-11-03-sound-after-app-switch.md; docs/areas/hub.md updated.

**What couldn't be verified without a real iPhone:** whether iOS reports the dead context as suspended, interrupted, closed or
"running" with a stopped clock. The fix covers all four. What it can't detect is a context that says "running", has a moving
clock, and is still silent. The e2e simulates the switch in Chromium (visibility switched by hand, the context suspended or
closed), so Eric's phone test is the real check: switch to another app and back, tap once, and the next sound should play.

## Player-visible changes
- Inside any home you start zoomed out (− pressed); + zooms into Close.
- A boss challenge plays at the further-out camera.
- After switching apps and coming back, the first tap brings sound back (no reload, no settings toggle).
- No new text.

## Changed checks (old → new)
- `e2e/shop.spec.ts`, "Babur's tent: Go in, start in Close, …" → "…, start zoomed out, …". On entering, `zoom` 0 → 1. "Zoom in"
  aria-pressed true → "Zoom out" aria-pressed true. The switch order changes from − (to 1) then + (to 0) to + (to 0) then −
  (to 1). Added a `SHOP_SHOTS` still of the first view.
- `e2e/shop.spec.ts`, "inside, a drag looks around …": the zoom on entering 0 → 1.
- Added: `e2e/sound.spec.ts`, "coming back from another app, sound is back on the first tap …". In the town at Big Boy, a
  suspended context resumes, a closed one is replaced on the first tap, and `bigboyClack:running` is logged after.
- Added: `packages/app/test/sound-return.test.ts` (9 tests, fake AudioContext): suspended → resumed (same context);
  interrupted, still suspended, closed, or a stopped clock → a new context on the first tap, its sound started; a tap too soon
  to judge waits; boss sounds re-warmed at the new sample rate; nothing plays while hidden; never unlocked → the usual first tap.
- None of these guard a rule in docs/rules/eric.md.

## Stills
- docs/zoom-audio/shop-first-view-phone.png: Babur's Circus as you go in (zoomed out).
- docs/zoom-audio/challenge-table-phone.png and challenge-table-desktop.png: Big Boy's challenge at the table.

## Lane
Targeted (sound logic, the room's camera numbers). Run locally (phone and desktop): `e2e/sound.spec.ts` (the new test),
`e2e/shop.spec.ts` (the two changed tests), `e2e/boss-challenge.spec.ts` (Big Boy's challenge, for the camera), all 8 passed;
`sound-return.test.ts` 9 passed; typecheck clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
