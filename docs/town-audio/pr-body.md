Eric, Nov 3, Safari on his iPhone, no switching apps: in the town he tapped Timber (he chittered), closed his card, walked to
Alfil and tapped him: no sound. He then played Alfil's challenge: no sound, and it never came back.

## Why

The sound was checked only when the page came back from another app (#471's fix: `audioReturned`, then the first tap). iOS can also
stop the audio **with the page on screen** (its media process restarting, memory, another sound taking over): the audio context says
"interrupted" or "suspended" and every tap's `resume()` waits for ever, or it says "running" with its clock stopped. Nothing checked
for that while the page stayed, so one stop was silence for the rest of the visit.

## What changed

- `wakeAudio` (every tap and key, before the page's handlers) now also checks the sound on every tap while the page stays
  (`checkStillOn`): a context seen running that isn't running now (interrupted, suspended, closed), or one "running" whose clock
  stood still between two taps 1 to 60 s apart (it moved less than a quarter of the time), is replaced inside that tap, as coming back
  from another app already did (old one closed, boss sounds made again for it, the Colosseum's ambience told). The tap's own sound
  plays on the new one (Alfil's line in Eric's steps).
- The clock check uses the taps' own event time stamps (the device's clock), so a test's fake clock jumping can't trigger it. Taps
  under 1 s apart (one tap's pointerdown, touchend and click) aren't judged.
- At most one replacement every 2 s while it keeps dying (iOS during a phone call interrupts each new one).
- Before sound was ever switched on, nothing changes: the first tap switches it on as before.
- A replacement is logged as `audio:rebuilt` in the test log (`window.__soundLog`).

No player-visible text changed.

## Checks

- `packages/app/test/sound-return.test.ts`: 8 new tests (Eric's steps: interrupted, suspended, closed with resume hanging; running
  with its clock stopped vs moving; taps under 1 s apart not judged; the event time stamp used over a jumped fake clock; never
  switched on: no new context; at most one every 2 s). The 9 existing tests unchanged and passing (17/17).
- Checked that headless Chromium's running context clock moves in real time (0.40 s → 1.90 s over 1.5 s), so e2e runs don't trip it.
- `tsc -p packages/app --noEmit` clean.

## Lane

Targeted: the app's sound (`packages/app/src/sound.ts`, `main.tsx` comment), its unit test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
